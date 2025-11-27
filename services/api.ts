
import { supabase } from './supabaseClient';
import { User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan, UserRole, RepTask } from '../types';

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  // In a real app, you might want to log this to a service like Sentry
  throw new Error(error.message || `An unknown error occurred in ${context}`);
};

export const api = {
  // --- CONNECTION TEST ---
  testSupabaseConnection: async (): Promise<boolean> => {
    try {
      // A lightweight query to check if keys are valid and table exists.
      const { error } = await supabase.from('regions').select('id', { count: 'exact', head: true });
      if (error) {
        console.error("Supabase connection test failed:", error.message);
        if (error.message.includes("Invalid API key") || error.message.includes("JWT")) {
          throw new Error("Connection failed: Invalid Supabase URL or Anon Key.");
        }
        throw new Error(`Connection test failed: ${error.message}. Make sure the database schema is set up correctly.`);
      }
      return true;
    } catch (e: any) {
      console.error("Supabase connection error:", e.message);
      throw new Error(e.message || "Connection failed: Please check the Supabase URL format.");
    }
  },


  // --- AUTH & USER PROFILE ---

  login: async (username: string, password: string): Promise<User> => {
    // The 'username' field is now always treated as the user's email address.
    const email = username;

    // Supabase auth uses email for signInWithPassword.
    const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error || !authUser) {
      console.error('Login error:', error?.message);
      if (error && (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed'))) {
        throw new Error('email_not_confirmed');
      }
      throw new Error('incorrect_credentials');
    }

    // After successful auth, fetch the user profile from our public.profiles table.
    // This step is crucial for getting user metadata (like role, name).
    // A failure here is critical, so we catch it, logout the partially-authed user, and re-throw.
    try {
      const profile = await api.getUserProfile(authUser.id);
      return profile;
    } catch (e: any) {
      console.error("Critical error: Failed to get profile immediately after login. Logging out.", e);
      await api.logout();
      // Throw a specific, translatable error key to the UI.
      throw new Error('profile_not_found');
    }
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) handleSupabaseError(error, 'logout');
  },

  getUserProfile: async (userId: string): Promise<User> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Database error fetching user profile:", error);
      if (error.message.includes('violates row-level security policy')) {
        // Throw a specific error for the UI to catch and display a helpful message.
        throw new Error('rls_error');
      }
      handleSupabaseError(error, 'getUserProfile');
    }

    if (!data) { // Explicitly handle profile not found
      console.error(`Profile not found for user ID ${userId}. The user exists in authentication but not in the profiles table.`);
      throw new Error('profile_not_found');
    }

    return { ...data, password: '' } as User;
  },

  updateUserPassword: async (newPassword: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      handleSupabaseError(error, 'updateUserPassword');
      return false;
    }
    return true;
  },

  // --- USER MANAGEMENT (MANAGER) ---

  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) handleSupabaseError(error, 'getUsers');
    return (data || []).map(u => ({ ...u, password: '' }));
  },

  addUser: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    // The 'username' field from the UI is now always treated as the user's email address.
    const email = userData.username;

    // Step 1: Save the manager's current session to prevent it from being overwritten.
    const { data: { session: managerSession } } = await supabase.auth.getSession();

    // Step 2: Create the new user in Supabase Auth. This action temporarily signs in the new user.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: userData.password,
      options: {
        data: {
          name: userData.name, // Pass name to be used by the 'on_auth_user_created' trigger (if configured)
        }
      }
    });

    if (authError) {
      // More specific error handling for common signUp errors
      if (authError.message.includes('user already registered') || authError.message.includes('email already registered')) {
        throw new Error('user_already_exists');
      }
      if (authError.message.includes('error sending confirmation mail')) {
        throw new Error('error_smtp_not_configured');
      }
      handleSupabaseError(authError, 'addUser (signUp)');
    }
    if (!authData.user) {
      // This case should ideally be covered by authError, but as a safeguard.
      throw new Error('database_error_creating_new_user');
    }

    // Step 3: Update the new user's profile with role and original username (email).
    // NOTE: This assumes a Supabase trigger (e.g., 'on_auth_user_created') has ALREADY created a basic profile entry.
    // If no trigger is configured, this 'update' will fail because the row does not exist.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({ role: userData.role, username: userData.username }) // 'username' column stores the email
      .eq('id', authData.user.id)
      .select()
      .single();

    // Step 4: Restore the manager's original session. This is critical.
    if (managerSession) {
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: managerSession.access_token,
        refresh_token: managerSession.refresh_token,
      });
      if (restoreError) {
        console.error("CRITICAL: Failed to restore manager session. A page refresh may be required.", restoreError);
      }
    } else {
      // If the manager wasn't logged in (e.g., first user setup), sign out the newly created user.
      await supabase.auth.signOut();
    }

    // After restoring the session, handle any errors from the profile update.
    if (profileError) {
      // If the profile row wasn't created by a trigger, this update will fail.
      if (profileError.message.includes('violates row-level security policy')) {
        throw new Error('error_permission_denied');
      }
      // Specific error for trigger failure if profile doesn't exist.
      // Supabase error code for "no rows affected" (if the profile wasn't created by trigger)
      if (profileError.code === 'PGRST116') {
        throw new Error('error_db_trigger_failed');
      }
      handleSupabaseError(profileError, 'addUser (profile update)');
    }

    return { ...profileData, password: '' };
  },

  updateUser: async (userId: string, updates: Partial<Pick<User, 'name' | 'role'>>): Promise<User | null> => {
    // NOTE: Updating another user's username (email) or password requires admin privileges
    // and should ideally be a server-side operation for security reasons.
    // In this client-side demo, we're preventing email changes for existing users via the UI.

    // Update non-auth fields in profiles table
    const { name, role } = updates;
    const { data, error } = await supabase
      .from('profiles')
      .update({ name, role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      // More specific error handling for common RLS issues when updating another user
      if (error.message.includes('violates row-level security policy')) {
        throw new Error('error_permission_denied');
      }
      handleSupabaseError(error, 'updateUser (profile)');
      return null;
    }

    return data ? { ...data, password: '' } : null;
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    // Deleting a user requires admin privileges in Supabase Auth.
    // This functionality will NOT work with just the anon key unless an RPC is configured with 'security definer'.
    // For a secure, production-ready solution, consider calling a serverless function.
    console.warn("Attempting to delete user. This typically requires admin privileges or an RPC in Supabase.");
    // Example of an RPC call if you have a custom function to delete:
    // const { error: rpcError } = await supabase.rpc('delete_user_and_profile', { p_user_id: userId });
    // if (rpcError) handleSupabaseError(rpcError, 'deleteUser RPC');

    // Direct client-side admin.deleteUser is usually not enabled for anon key.
    const { error } = await supabase.auth.admin.deleteUser(userId); // This will likely fail with anon key
    if (error) {
      // Log a more descriptive error if it's a permission issue from admin.deleteUser
      console.error("Failed to delete user with admin privileges:", error.message);
      throw new Error('error_permission_denied_delete_user'); // Custom error for UI
    }
    return true;
  },

  sendPasswordResetEmail: async (username: string): Promise<void> => {
    // The 'username' field is now always treated as the user's email address.
    const email = username;

    // Supabase will send a reset email to this address.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // Redirects back to the app after reset
    });

    if (error) {
      // For security, avoid exposing whether an email exists or not.
      // We log the error internally but the UI will show a generic message.
      console.error('Password reset request error:', error.message);
    }
    // We don't throw here; the UI will always show a generic success message
    // to prevent leaking information about which emails are registered.
  },

  // NEW: Function to reset a representative's visits and plan
  resetRepData: async (repId: string): Promise<void> => {
    // Call the RPC defined in Supabase to handle the deletion and plan reset
    const { error } = await supabase.rpc('reset_rep_data', { p_rep_id: repId });
    if (error) {
        // Provide specific error feedback if it's a permission issue, otherwise generic.
        if (error.message.includes('permission denied') || error.message.includes('violates row-level security policy')) {
            throw new Error('error_permission_denied');
        }
        handleSupabaseError(error, 'resetRepData');
    }
  },


  // --- CORE DATA FETCHING ---

  getRegions: async (): Promise<Region[]> => {
    const { data, error } = await supabase.from('regions').select('*');
    if (error) handleSupabaseError(error, 'getRegions');
    return data || [];
  },

  // Fetch assigned regions for a specific rep
  // fallbackToAll: If true, returns ALL regions if no specific regions are assigned (default behavior for Rep View)
  //                If false, returns empty array if no regions assigned (behavior for Manager Edit View)
  getRegionsForRep: async (repId: string, fallbackToAll: boolean = true): Promise<Region[]> => {
    // 1. Try to fetch specifically assigned regions
    const { data, error } = await supabase
      .from('user_regions')
      .select('regions (id, name)')
      .eq('user_id', repId);

    if (error) {
        // Log error but continue to fallback. 
        console.warn('Error fetching user_regions, falling back to all regions:', error.message);
    }
    
    const assignedRegions = (data || []).map((item: any) => item.regions).filter((r: any) => r) as Region[];

    // 2. Fallback: If the user has NO specific regions assigned (empty list), 
    // allow them to see ALL regions by default IF fallbackToAll is true.
    if (assignedRegions.length === 0 && fallbackToAll) {
        return await api.getRegions();
    }

    return assignedRegions;
  },

  updateUserRegions: async (userId: string, regionIds: number[]): Promise<void> => {
    // 1. Delete all existing regions for this user
    const { error: deleteError } = await supabase
      .from('user_regions')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) handleSupabaseError(deleteError, 'updateUserRegions:delete');

    // 2. Insert new selections
    if (regionIds.length > 0) {
      const { error: insertError } = await supabase
        .from('user_regions')
        .insert(regionIds.map(rId => ({ user_id: userId, region_id: rId })));

      if (insertError) handleSupabaseError(insertError, 'updateUserRegions:insert');
    }
  },

  addRegion: async (regionName: string): Promise<Region> => {
    if (!regionName) {
      throw new Error("Region name cannot be empty.");
    }
    const { data, error } = await supabase
      .from('regions')
      .insert({ name: regionName })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation if region already exists (race condition)
      if (error.code === '23505') { // unique_violation
        console.warn(`Region "${regionName}" already exists, fetching it instead.`);
        const { data: existingData, error: fetchError } = await supabase
          .from('regions')
          .select('*')
          .eq('name', regionName)
          .single();
        if (fetchError) handleSupabaseError(fetchError, 'addRegion (fetch existing)');
        if (!existingData) throw new Error(`Failed to fetch existing region "${regionName}" after unique constraint violation.`);
        return existingData as Region;
      }
      handleSupabaseError(error, 'addRegion');
    }
    if (!data) throw new Error("addRegion did not return the new region data.");
    return data as Region;
  },

  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) handleSupabaseError(error, 'getProducts');
    return data || [];
  },

  getAllDoctors: async (): Promise<Doctor[]> => {
    const { data, error } = await supabase.from('doctors').select('*');
    if (error) handleSupabaseError(error, 'getAllDoctors');
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  getDoctorsForRep: async (repId: string): Promise<Doctor[]> => {
    const { data, error } = await supabase.from('doctors').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getDoctorsForRep');
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  getAllPharmacies: async (): Promise<Pharmacy[]> => {
    const { data, error } = await supabase.from('pharmacies').select('*');
    if (error) handleSupabaseError(error, 'getAllPharmacies');
    return (data || []).map(p => ({ ...p, regionId: p.region_id, repId: p.rep_id }));
  },

  getPharmaciesForRep: async (repId: string): Promise<Pharmacy[]> => {
    const { data, error } = await supabase.from('pharmacies').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getPharmaciesForRep');
    return (data || []).map(p => ({ ...p, regionId: p.region_id, repId: p.rep_id }));
  },

  // --- VISITS & REPORTS (using RPC) ---
  addDoctorVisit: async (visit: Omit<DoctorVisit, 'id' | 'date'>): Promise<DoctorVisit> => {
    const { data, error } = await supabase.rpc('add_doctor_visit_with_products', {
      p_doctor_id: visit.doctorId,
      p_rep_id: visit.repId,
      p_region_id: visit.regionId,
      p_visit_type: visit.visitType,
      p_doctor_comment: visit.doctorComment,
      p_product_ids: visit.productIds,
    }).single();
    if (error) handleSupabaseError(error, 'addDoctorVisit');
    if (!data) {
      const errorMessage = 'RPC call "add_doctor_visit_with_products" returned no data.';
      handleSupabaseError({ message: errorMessage }, 'addDoctorVisit');
      throw new Error(errorMessage);
    }

    const visitData = data as any;
    return { ...visitData, doctorId: visitData.doctor_id, repId: visitData.rep_id, productIds: visit.productIds, regionId: visitData.region_id, visitType: visitData.visit_type, doctorComment: visitData.doctor_comment };
  },

  addPharmacyVisit: async (visit: Omit<PharmacyVisit, 'id' | 'date'>): Promise<PharmacyVisit> => {
    const { data, error } = await supabase.from('pharmacy_visits').insert({
      pharmacy_id: visit.pharmacyId,
      rep_id: visit.repId,
      region_id: visit.regionId,
      visit_notes: visit.visitNotes,
    }).select().single();
    if (error) handleSupabaseError(error, 'addPharmacyVisit');
    return { ...data, pharmacyId: data.pharmacy_id, repId: data.rep_id, regionId: data.region_id, visitNotes: data.visit_notes };
  },

  getVisitReportsForRep: async (repId: string): Promise<VisitReport[]> => {
    const { data, error } = await supabase.rpc('get_visit_reports', { p_rep_id: repId });
    if (error) {
      if (error.code === '42804' && error.message.includes('UNION types text and specialization cannot be matched')) {
        console.error("Critical SQL Function Error: 'get_visit_reports' RPC failed due to UNION type mismatch.");
        throw new Error("error_get_visit_reports_sql_config");
      }
      handleSupabaseError(error, 'getVisitReportsForRep');
    }
    return data || [];
  },

  getAllVisitReports: async (): Promise<VisitReport[]> => {
    const { data, error } = await supabase.rpc('get_visit_reports');
    if (error) {
      if (error.code === '42804' && error.message.includes('UNION types text and specialization cannot be matched')) {
        console.error("Critical SQL Function Error: 'get_visit_reports' RPC failed due to UNION type mismatch.");
        throw new Error("error_get_visit_reports_sql_config");
      }
      handleSupabaseError(error, 'getAllVisitReports');
    }
    return (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getOverdueVisits: async (): Promise<ClientAlert[]> => {
    const { data, error } = await supabase.rpc('get_overdue_visits');
    if (error) handleSupabaseError(error, 'getOverdueVisits');
    return data || [];
  },

  // --- WEEKLY PLANS ---

  getRepPlan: async (repId: string): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').select('plan, status').eq('rep_id', repId).maybeSingle();
    if (error) handleSupabaseError(error, 'getRepPlan');
    return data || { plan: {}, status: 'draft' };
  },

  updateRepPlan: async (repId: string, planData: WeeklyPlan['plan']): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').upsert({
      rep_id: repId,
      plan: planData,
      status: 'pending',
    }, { onConflict: 'rep_id' }).select('plan, status').single();
    if (error) handleSupabaseError(error, 'updateRepPlan');
    return data as WeeklyPlan;
  },

  reviewRepPlan: async (repId: string, newStatus: 'approved' | 'rejected'): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').update({ status: newStatus }).eq('rep_id', repId).select('plan, status').single();
    if (error) handleSupabaseError(error, 'reviewRepPlan');
    return data as WeeklyPlan;
  },

  revokePlanApproval: async (repId: string): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').update({ status: 'draft' }).eq('rep_id', repId).select('plan, status').single();
    if (error) handleSupabaseError(error, 'revokePlanApproval');
    return data as WeeklyPlan;
  },

  getAllPlans: async (): Promise<{ [repId: string]: WeeklyPlan }> => {
    const { data, error } = await supabase.from('weekly_plans').select('rep_id, plan, status');
    if (error) handleSupabaseError(error, 'getAllPlans');

    const plansObject: { [repId: string]: WeeklyPlan } = {};
    (data || []).forEach(plan => {
      plansObject[plan.rep_id] = {
        plan: plan.plan,
        status: plan.status,
      };
    });
    return plansObject;
  },

  // --- TASK MANAGEMENT ---

  getPendingTasksForRep: async (repId: string): Promise<RepTask[]> => {
    const { data, error } = await supabase
      .from('rep_tasks')
      .select('*')
      .eq('rep_id', repId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false });

    if (error) handleSupabaseError(error, 'getPendingTasksForRep');
    return (data || []).map(task => ({
        id: task.id,
        repId: task.rep_id,
        createdBy: task.created_by,
        description: task.description,
        isCompleted: task.is_completed,
        createdAt: task.created_at,
        completedAt: task.completed_at
    }));
  },

  getAllTasks: async (): Promise<RepTask[]> => {
    const { data, error } = await supabase
      .from('rep_tasks')
      .select('*, profiles!rep_id(name)');
      
    if (error) handleSupabaseError(error, 'getAllTasks');
    
    return (data || []).map((task: any) => ({
        id: task.id,
        repId: task.rep_id,
        repName: task.profiles?.name || 'Unknown',
        createdBy: task.created_by,
        description: task.description,
        isCompleted: task.is_completed,
        createdAt: task.created_at,
        completedAt: task.completed_at
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createTask: async (repId: string, description: string): Promise<RepTask> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('rep_tasks')
      .insert({
        rep_id: repId,
        created_by: user.id,
        description: description,
        is_completed: false
      })
      .select('*, profiles!rep_id(name)')
      .single();

    if (error) handleSupabaseError(error, 'createTask');
    
    const taskData = data as any;
    
    return {
        id: taskData.id,
        repId: taskData.rep_id,
        repName: taskData.profiles?.name || 'Unknown',
        createdBy: taskData.created_by,
        description: taskData.description,
        isCompleted: taskData.is_completed,
        createdAt: taskData.created_at,
        completedAt: taskData.completed_at
    };
  },

  completeTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase
      .from('rep_tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) handleSupabaseError(error, 'completeTask');
  },

  deleteTask: async (taskId: string): Promise<void> => {
      const { error } = await supabase
        .from('rep_tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) handleSupabaseError(error, 'deleteTask');
  },

  // --- SYSTEM SETTINGS ---

  getSystemSettings: async (): Promise<SystemSettings> => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) handleSupabaseError(error, 'getSystemSettings');
    return data || { weekends: [], holidays: [] };
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    const { data, error } = await supabase.from('system_settings').update({
      weekends: settings.weekends,
      holidays: settings.holidays,
    }).eq('id', 1).select().single();
    if (error) handleSupabaseError(error, 'updateSystemSettings');
    return data as SystemSettings;
  },

  // --- BATCH IMPORTS ---
  addDoctorsBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<{ success: number, failed: number, errors: string[] }> => {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));

    const doctorsToInsert: { name: string; region_id: number; rep_id: string; specialization: string }[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 4 || row.every(cell => cell === null || cell === '')) continue;

      const Name = row[0];
      const RegionName = row[1];
      const Spec = row[2];
      const repEmail = row[3];
      const rowIndex = index + 2;

      if (!Name || !RegionName || !Spec || !repEmail) {
        result.failed++;
        result.errors.push(`Row ${rowIndex}: Missing required fields.`);
        continue;
      }

      let regionId = regionMap.get(String(RegionName).trim().toLowerCase());

      if (!regionId) {
        try {
          const newRegion = await api.addRegion(String(RegionName).trim());
          regionId = newRegion.id;
          regionMap.set(newRegion.name.trim().toLowerCase(), newRegion.id);
        } catch (e: any) {
          result.failed++;
          result.errors.push(`Row ${rowIndex}: Could not find or create region "${RegionName}". Error: ${e.message}`);
          continue;
        }
      }

      const repId = userMap.get(String(repEmail).trim().toLowerCase());

      if (!repId) { result.failed++; result.errors.push(`Row ${rowIndex}: Rep with email "${repEmail}" not found. Ensure this email exists in the system.`); continue; }

      doctorsToInsert.push({ name: String(Name).trim(), region_id: regionId, rep_id: repId, specialization: String(Spec).trim() });
    }

    const totalToInsert = doctorsToInsert.length;
    if (totalToInsert > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < totalToInsert; i += CHUNK_SIZE) {
        const chunk = doctorsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('doctors').insert(chunk);
        if (error) {
          result.failed += chunk.length;
          result.errors.push(`Database error on a batch: ${error.message}`);
          onProgress(100);
          return result;
        } else {
          result.success += chunk.length;
        }
        const currentProgress = Math.round(((i + chunk.length) / totalToInsert) * 100);
        onProgress(currentProgress);
      }
    } else {
      onProgress(100);
    }

    return result;
  },

  addPharmaciesBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<{ success: number, failed: number, errors: string[] }> => {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));

    const pharmaciesToInsert: { name: string; region_id: number; rep_id: string; specialization: Specialization.Pharmacy }[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 3 || row.every(cell => cell === null || cell === '')) continue;

      const Name = row[0];
      const RegionName = row[1];
      const repEmail = row[2];
      const rowIndex = index + 2;

      if (!Name || !RegionName || !repEmail) {
        result.failed++;
        result.errors.push(`Row ${rowIndex}: Missing required fields.`);
        continue;
      }
      let regionId = regionMap.get(String(RegionName).trim().toLowerCase());

      if (!regionId) {
        try {
          const newRegion = await api.addRegion(String(RegionName).trim());
          regionId = newRegion.id;
          regionMap.set(newRegion.name.trim().toLowerCase(), newRegion.id);
        } catch (e: any) {
          result.failed++;
          result.errors.push(`Row ${rowIndex}: Could not find or create region "${RegionName}". Error: ${e.message}`);
          continue;
        }
      }

      const repId = userMap.get(String(repEmail).trim().toLowerCase());

      if (!repId) { result.failed++; result.errors.push(`Row ${rowIndex}: Rep with email "${repEmail}" not found. Ensure this email exists in the system.`); continue; }

      pharmaciesToInsert.push({ name: String(Name).trim(), region_id: regionId, rep_id: repId, specialization: Specialization.Pharmacy });
    }

    const totalToInsert = pharmaciesToInsert.length;
    if (totalToInsert > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < totalToInsert; i += CHUNK_SIZE) {
        const chunk = pharmaciesToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('pharmacies').insert(chunk);
        if (error) {
          result.failed += chunk.length;
          result.errors.push(`Database error on a batch: ${error.message}`);
          onProgress(100);
          return result;
        } else {
          result.success += chunk.length;
        }
        const currentProgress = Math.round(((i + chunk.length) / totalToInsert) * 100);
        onProgress(currentProgress);
      }
    } else {
      onProgress(100);
    }

    return result;
  },
};
