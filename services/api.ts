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
    // Supabase auth uses email, but we can use the username field as if it were an email
    const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });

    if (error || !authUser) {
      console.error('Login error:', error?.message);
      if (error && (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed'))) {
          throw new Error('email_not_confirmed');
      }
      throw new Error('incorrect_credentials');
    }
    
    // After successful auth, fetch the user profile from our public.profiles table
    const profile = await api.getUserProfile(authUser.id);
    if (!profile) {
      // getUserProfile already logged the user out. Now we tell the UI why the login failed.
      throw new Error('profile_not_found');
    }
    return profile;
  },

  logout: async (): Promise<void> => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) handleSupabaseError(error, 'logout');
  },

  getUserProfile: async (userId: string): Promise<User | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
        console.error("Database error fetching user profile:", error);
        await api.logout();
        return null;
    }

    if (!data) { // Explicitly handle profile not found
        console.error(`Profile not found for user ID ${userId}. The user exists in authentication but not in the profiles table. Logging out.`);
        await api.logout();
        return null;
    }

    return data ? { ...data, password: '' } as User : null;
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
    return (data || []).map(u => ({...u, password: ''}));
  },

  addUser: async (userData: Omit<User, 'id' | 'role'> & { password: string }): Promise<User> => {
      const supabase = getSupabaseClient();
      // Step 1: Create the user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
          email: userData.username,
          password: userData.password,
          options: {
              data: {
                  name: userData.name,
              }
          }
      });
      if (authError || !authData.user) {
          handleSupabaseError(authError, 'addUser (signUp)');
          throw authError; // Rethrow to be caught by the UI
      }
      
      // Step 2: Insert into our public profiles table
      const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
              id: authData.user.id,
              name: userData.name,
              username: userData.username,
              role: UserRole.Rep,
          })
          .select()
          .single();
      
      if (profileError) {
          // If profile insert fails, we should delete the auth user to avoid orphans
          // This requires admin privileges, best handled by a database trigger/function in a real app
          console.error("Profile creation failed, cleaning up auth user is recommended.", profileError);
          handleSupabaseError(profileError, 'addUser (insert profile)');
          throw profileError;
      }

      return { ...profileData, password: '' };
  },

  updateUser: async (userId: string, updates: Partial<Pick<User, 'name' | 'username'>>): Promise<User | null> => {
    const supabase = getSupabaseClient();
    // Note: Updating username (email) or password for another user requires admin privileges 
    // and should ideally be a server-side operation for security.
    // We are preventing this on the client-side to avoid data desync.
    
    // Update non-auth fields in profiles table
    const { name, username } = updates;
    const { data, error } = await supabase
      .from('profiles')
      .update({ name, username })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
        handleSupabaseError(error, 'updateUser (profile)');
        return null;
    }

    return data ? { ...data, password: '' } : null;
  },
  
  deleteUser: async (userId: string): Promise<boolean> => {
      // Deleting a user requires admin privileges.
      // This function won't work with just the anon key.
      // A secure way is to call a serverless function or an RPC with security definer.
      // For now, we'll try and it will fail if RLS is restrictive, which is correct.
      alert("Note: Deleting users requires admin privileges and is disabled in this client-side demo for security reasons.");
      // const supabase = getSupabaseClient();
      // const { error } = await supabase.auth.admin.deleteUser(userId);
      // if (error) {
      //   handleSupabaseError(error, 'deleteUser');
      //   return false;
      // }
      return false; // Returning false as it's a mock of a failed attempt
  },


  // --- CORE DATA FETCHING ---

  getRegions: async (): Promise<Region[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('regions').select('*');
    if (error) handleSupabaseError(error, 'getRegions');
    return data || [];
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
    const { data, error } = await supabase.from('doctors').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getDoctorsForRep');
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
    const { data, error } = await supabase.from('pharmacies').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getPharmaciesForRep');
    // FIX: Corrected a typo from `d.rep_id` to `p.rep_id` to match the map variable.
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
    if (error) handleSupabaseError(error, 'getVisitReportsForRep');
    return data || [];
  },

  getAllVisitReports: async (): Promise<VisitReport[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('get_visit_reports');
    if (error) handleSupabaseError(error, 'getAllVisitReports');
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
      const { data, error } = await supabase.from('weekly_plans').select('*').eq('rep_id', repId).maybeSingle();
      if (error) handleSupabaseError(error, 'getRepPlan');
      return data || { plan: {}, status: 'draft' };
  },
  
  updateRepPlan: async (repId: string, planData: WeeklyPlan['plan']): Promise<WeeklyPlan> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('weekly_plans').upsert({
          rep_id: repId,
          plan: planData,
          status: 'pending',
      }, { onConflict: 'rep_id' }).select().single();
      if (error) handleSupabaseError(error, 'updateRepPlan');
      return data as WeeklyPlan;
  },

  reviewRepPlan: async (repId: string, newStatus: 'approved' | 'rejected'): Promise<WeeklyPlan> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('weekly_plans').update({ status: newStatus }).eq('rep_id', repId).select().single();
      if (error) handleSupabaseError(error, 'reviewRepPlan');
      return data as WeeklyPlan;
  },
  
  getAllPlans: async (): Promise<{ [repId: string]: WeeklyPlan }> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('weekly_plans').select('*');
    if (error) handleSupabaseError(error, 'getAllPlans');
    
    // Transform array to object, matching the old data structure for easier frontend integration
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
  addDoctorsBatch: async (rows: any[]): Promise<{success: number, failed: number, errors: string[]}> => {
    const supabase = getSupabaseClient();
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));
    
    const newDoctors: Omit<Doctor, 'id'>[] = [];

    rows.forEach((row, index) => {
        const { Name, Region, Specialization: Spec, 'Rep Username': repUsername } = row;
        if (!Name || !Region || !Spec || !repUsername) {
            result.failed++;
            result.errors.push(`Row ${index + 2}: Missing required fields.`);
            return;
        }
        const regionId = regionMap.get(String(Region).trim().toLowerCase());
        const repId = userMap.get(String(repUsername).trim().toLowerCase());
        const specValues = [Specialization.Pediatrics, Specialization.Pulmonology] as const;
        const validSpec = specValues.find(s => s.toLowerCase() === String(Spec).trim().toLowerCase());

        if (!regionId) { result.failed++; result.errors.push(`Row ${index + 2}: Region "${Region}" not found.`); return; }
        if (!repId) { result.failed++; result.errors.push(`Row ${index + 2}: Rep with username "${repUsername}" not found.`); return; }
        if (!validSpec) { result.failed++; result.errors.push(`Row ${index + 2}: Invalid specialization "${Spec}".`); return; }
        
        newDoctors.push({ name: Name, regionId, repId, specialization: validSpec });
    });

    if (newDoctors.length > 0) {
        const { error } = await supabase.from('doctors').insert(newDoctors.map(d => ({...d, region_id: d.regionId, rep_id: d.repId})));
        if (error) {
            result.failed += newDoctors.length;
            result.errors.push(`Database error: ${error.message}`);
        } else {
            result.success = newDoctors.length;
        }
    }
    
    return result;
  },

  addPharmaciesBatch: async (rows: any[]): Promise<{success: number, failed: number, errors: string[]}> => {
      const supabase = getSupabaseClient();
      const result = { success: 0, failed: 0, errors: [] as string[] };
      const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
      const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
      const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));

      const newPharmacies: Omit<Pharmacy, 'id'>[] = [];

      rows.forEach((row, index) => {
          const { Name, Region, 'Rep Username': repUsername } = row;
          if (!Name || !Region || !repUsername) {
              result.failed++;
              result.errors.push(`Row ${index + 2}: Missing required fields.`);
              return;
          }
          const regionId = regionMap.get(String(Region).trim().toLowerCase());
          const repId = userMap.get(String(repUsername).trim().toLowerCase());

          if (!regionId) { result.failed++; result.errors.push(`Row ${index + 2}: Region "${Region}" not found.`); return; }
          if (!repId) { result.failed++; result.errors.push(`Row ${index + 2}: Rep with username "${repUsername}" not found.`); return; }

          newPharmacies.push({ name: Name, regionId, repId, specialization: Specialization.Pharmacy });
      });

      if (newPharmacies.length > 0) {
          const { error } = await supabase.from('pharmacies').insert(newPharmacies.map(p => ({...p, region_id: p.regionId, rep_id: p.repId})));
          if (error) {
              result.failed += newPharmacies.length;
              result.errors.push(`Database error: ${error.message}`);
          } else {
              result.success = newPharmacies.length;
          }
      }

      return result;
  },
};