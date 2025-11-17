
import { getSupabaseClient, initializeSupabase } from './supabaseClient';
import { User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan, UserRole } from '../types';

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
      const supabase = getSupabaseClient();
      // A lightweight query to check if keys are valid and table exists.
      // We're checking 'regions' table as it's fundamental for the app.
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
      console.error("Supabase client initialization error:", e.message);
      throw new Error(e.message || "Connection failed: Please check the Supabase URL format.");
    }
  },


  // --- AUTH & USER PROFILE ---

  login: async (username: string, password: string): Promise<User> => {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) handleSupabaseError(error, 'logout');
  },

  getUserProfile: async (userId: string): Promise<User> => {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      handleSupabaseError(error, 'updateUserPassword');
      return false;
    }
    return true;
  },

  // --- USER MANAGEMENT (MANAGER) ---

  getUsers: async (): Promise<User[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) handleSupabaseError(error, 'getUsers');
    return (data || []).map(u => ({ ...u, password: '' }));
  },

  addUser: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('regions').select('*');
    if (error) handleSupabaseError(error, 'getRegions');
    return data || [];
  },

  addRegion: async (regionName: string): Promise<Region> => {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('products').select('*');
    if (error) handleSupabaseError(error, 'getProducts');
    return data || [];
  },

  getAllDoctors: async (): Promise<Doctor[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('doctors').select('*');
    if (error) handleSupabaseError(error, 'getAllDoctors');
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  getDoctorsForRep: async (repId: string): Promise<Doctor[]> => {
    const supabase = getSupabaseClient();
    console.log(`API: Fetching doctors for repId: ${repId}`);
    const { data, error } = await supabase.from('doctors').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getDoctorsForRep');
    console.log(`API: Raw doctors data from Supabase for repId ${repId}:`, data);
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  getAllPharmacies: async (): Promise<Pharmacy[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('pharmacies').select('*');
    if (error) handleSupabaseError(error, 'getAllPharmacies');
    return (data || []).map(p => ({ ...p, regionId: p.region_id, repId: p.rep_id }));
  },

  getPharmaciesForRep: async (repId: string): Promise<Pharmacy[]> => {
    const supabase = getSupabaseClient();
    console.log(`API: Fetching pharmacies for repId: ${repId}`);
    const { data, error } = await supabase.from('pharmacies').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getPharmaciesForRep');
    console.log(`API: Raw pharmacies data from Supabase for repId ${repId}:`, data);
    // Corrected type in map function (p.rep_id instead of d.rep_id)
    return (data || []).map(p => ({ ...p, regionId: p.region_id, repId: p.rep_id }));
  },

  // --- VISITS & REPORTS (using RPC) ---
  addDoctorVisit: async (visit: Omit<DoctorVisit, 'id' | 'date'>): Promise<DoctorVisit> => {
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
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
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_visit_reports', { p_rep_id: repId });
    if (error) {
      // Specific error handling for the 'UNION types' issue
      if (error.code === '42804' && error.message.includes('UNION types text and specialization cannot be matched')) {
        console.error("Critical SQL Function Error: 'get_visit_reports' RPC failed due to UNION type mismatch.");
        console.error("This usually means the 'specialization' column in your 'doctors' table is an ENUM type in the database, and the 'get_visit_reports' function is trying to UNION it with a TEXT or NULL type for pharmacy visits without explicit casting.");
        console.error("Solution: Edit your 'get_visit_reports' SQL function in Supabase. Ensure that the 'target_specialization' column for BOTH doctor and pharmacy visits is explicitly cast to 'TEXT' (e.g., `d.specialization::text` and `NULL::text`).");
        throw new Error("error_get_visit_reports_sql_config");
      }
      handleSupabaseError(error, 'getVisitReportsForRep');
    }
    return data || [];
  },

  getAllVisitReports: async (): Promise<VisitReport[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_visit_reports');
    if (error) {
      // Apply the same specific error handling for all reports as well.
      if (error.code === '42804' && error.message.includes('UNION types text and specialization cannot be matched')) {
        console.error("Critical SQL Function Error: 'get_visit_reports' RPC failed due to UNION type mismatch.");
        console.error("This usually means the 'specialization' column in your 'doctors' table is an ENUM type in the database, and the 'get_visit_reports' function is trying to UNION it with a TEXT or NULL type for pharmacy visits without explicit casting.");
        console.error("Solution: Edit your 'get_visit_reports' SQL function in Supabase. Ensure that the 'target_specialization' column for BOTH doctor and pharmacy visits is explicitly cast to 'TEXT' (e.g., `d.specialization::text` and `NULL::text`).");
        throw new Error("error_get_visit_reports_sql_config");
      }
      handleSupabaseError(error, 'getAllVisitReports');
    }
    return (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getOverdueVisits: async (): Promise<ClientAlert[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_overdue_visits');
    if (error) handleSupabaseError(error, 'getOverdueVisits');
    return data || [];
  },

  // --- WEEKLY PLANS ---

  getRepPlan: async (repId: string): Promise<WeeklyPlan> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('weekly_plans').select('plan, status').eq('rep_id', repId).maybeSingle();
    if (error) handleSupabaseError(error, 'getRepPlan');
    return data || { plan: {}, status: 'draft' };
  },

  updateRepPlan: async (repId: string, planData: WeeklyPlan['plan']): Promise<WeeklyPlan> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('weekly_plans').upsert({
      rep_id: repId,
      plan: planData,
      status: 'pending',
    }, { onConflict: 'rep_id' }).select('plan, status').single();
    if (error) handleSupabaseError(error, 'updateRepPlan');
    return data as WeeklyPlan;
  },

  reviewRepPlan: async (repId: string, newStatus: 'approved' | 'rejected'): Promise<WeeklyPlan> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('weekly_plans').update({ status: newStatus }).eq('rep_id', repId).select('plan, status').single();
    if (error) handleSupabaseError(error, 'reviewRepPlan');
    return data as WeeklyPlan;
  },

  revokePlanApproval: async (repId: string): Promise<WeeklyPlan> => {
    const supabase = getSupabaseClient();
    // Setting status back to 'draft' allows the rep to edit and resubmit
    const { data, error } = await supabase.from('weekly_plans').update({ status: 'draft' }).eq('rep_id', repId).select('plan, status').single();
    if (error) handleSupabaseError(error, 'revokePlanApproval');
    return data as WeeklyPlan;
  },

  getAllPlans: async (): Promise<{ [repId: string]: WeeklyPlan }> => {
    const supabase = getSupabaseClient();
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

  // --- SYSTEM SETTINGS ---

  getSystemSettings: async (): Promise<SystemSettings> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) handleSupabaseError(error, 'getSystemSettings');
    return data || { weekends: [], holidays: [] };
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('system_settings').update({
      weekends: settings.weekends,
      holidays: settings.holidays,
    }).eq('id', 1).select().single();
    if (error) handleSupabaseError(error, 'updateSystemSettings');
    return data as SystemSettings;
  },

  // --- BATCH IMPORTS ---
  addDoctorsBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<{ success: number, failed: number, errors: string[] }> => {
    const supabase = getSupabaseClient();
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    // NOTE: userMap now uses the 'username' field (which holds the email) for mapping.
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));

    const doctorsToInsert: { name: string; region_id: number; rep_id: string; specialization: string }[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 4 || row.every(cell => cell === null || cell === '')) continue;

      const Name = row[0];
      const RegionName = row[1];
      const Spec = row[2]; // Specialization from Excel
      const repEmail = row[3]; // Expecting a full email address now
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

      // NOTE: repId is found using the provided repEmail (username) from the import file.
      const repId = userMap.get(String(repEmail).trim().toLowerCase());

      if (!repId) { result.failed++; result.errors.push(`Row ${rowIndex}: Rep with email "${repEmail}" not found. Ensure this email exists in the system.`); continue; }

      // Specialization: Directly use the provided string from the Excel file
      // Assuming the database column 'specialization' is of type 'text' or 'varchar'
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
    const supabase = getSupabaseClient();
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    // NOTE: userMap now uses the 'username' field (which holds the the email) for mapping.
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));

    const pharmaciesToInsert: { name: string; region_id: number; rep_id: string; specialization: Specialization.Pharmacy }[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 3 || row.every(cell => cell === null || cell === '')) continue;

      const Name = row[0];
      const RegionName = row[1];
      const repEmail = row[2]; // Expecting a full email address now
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

      // NOTE: repId is found using the provided repEmail (username) from the import file.
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
