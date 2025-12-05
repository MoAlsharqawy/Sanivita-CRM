import { supabase } from './supabaseClient';
import { User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan, UserRole, RepTask, RepAbsence, LeaveStatus } from '../types';

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  throw new Error(error.message || `An unknown error occurred in ${context}`);
};

export const api = {
  // --- CONNECTION TEST ---
  testSupabaseConnection: async (): Promise<boolean> => {
    try {
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
    const email = username;
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

    try {
      const profile = await api.getUserProfile(authUser.id);
      return profile;
    } catch (e: any) {
      console.error("Critical error: Failed to get profile immediately after login. Logging out.", e);
      await api.logout();
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
        throw new Error('rls_error');
      }
      handleSupabaseError(error, 'getUserProfile');
    }

    if (!data) {
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

  // --- USER MANAGEMENT ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) handleSupabaseError(error, 'getUsers');
    return (data || []).map(u => ({ ...u, password: '' }));
  },

  addUser: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const email = userData.username;
    const { data: { session: managerSession } } = await supabase.auth.getSession();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: userData.password,
      options: { data: { name: userData.name } }
    });

    if (authError) {
      if (authError.message.includes('user already registered') || authError.message.includes('email already registered')) {
        throw new Error('user_already_exists');
      }
      if (authError.message.includes('error sending confirmation mail')) {
        throw new Error('error_smtp_not_configured');
      }
      handleSupabaseError(authError, 'addUser (signUp)');
    }
    if (!authData.user) throw new Error('database_error_creating_new_user');

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({ role: userData.role, username: userData.username })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (managerSession) {
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: managerSession.access_token,
        refresh_token: managerSession.refresh_token,
      });
      if (restoreError) console.error("CRITICAL: Failed to restore manager session.", restoreError);
    } else {
      await supabase.auth.signOut();
    }

    if (profileError) {
      if (profileError.message.includes('violates row-level security policy')) throw new Error('error_permission_denied');
      if (profileError.code === 'PGRST116') throw new Error('error_db_trigger_failed');
      handleSupabaseError(profileError, 'addUser (profile update)');
    }

    return { ...profileData, password: '' };
  },

  updateUser: async (userId: string, updates: Partial<Pick<User, 'name' | 'role'>>): Promise<User | null> => {
    const { name, role } = updates;
    const { data, error } = await supabase
      .from('profiles')
      .update({ name, role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.message.includes('violates row-level security policy')) throw new Error('error_permission_denied');
      handleSupabaseError(error, 'updateUser (profile)');
      return null;
    }
    return data ? { ...data, password: '' } : null;
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Failed to delete user with admin privileges:", error.message);
      throw new Error('error_permission_denied_delete_user');
    }
    return true;
  },

  sendPasswordResetEmail: async (username: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(username, {
      redirectTo: window.location.origin,
    });
    if (error) console.error('Password reset request error:', error.message);
  },

  resetRepData: async (repId: string): Promise<void> => {
    const { error } = await supabase.rpc('reset_rep_data', { p_rep_id: repId });
    if (error) {
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

  // Supports fallbackToAll parameter
  getRegionsForRep: async (repId: string, fallbackToAll: boolean = true): Promise<Region[]> => {
    const { data, error } = await supabase
      .from('user_regions')
      .select('regions (id, name)')
      .eq('user_id', repId);

    if (error) {
        console.warn('Error fetching user_regions, falling back to all regions:', error.message);
    }
    
    const assignedRegions = (data || []).map((item: any) => item.regions).filter((r: any) => r) as Region[];

    if (assignedRegions.length === 0 && fallbackToAll) {
        return await api.getRegions();
    }

    return assignedRegions;
  },

  updateUserRegions: async (userId: string, regionIds: number[]): Promise<void> => {
    const { error: deleteError } = await supabase.from('user_regions').delete().eq('user_id', userId);
    if (deleteError) handleSupabaseError(deleteError, 'updateUserRegions:delete');

    if (regionIds.length > 0) {
      const { error: insertError } = await supabase
        .from('user_regions')
        .insert(regionIds.map(rId => ({ user_id: userId, region_id: rId })));
      if (insertError) handleSupabaseError(insertError, 'updateUserRegions:insert');
    }
  },

  addRegion: async (regionName: string): Promise<Region> => {
    if (!regionName) throw new Error("Region name cannot be empty.");
    const { data, error } = await supabase.from('regions').insert({ name: regionName }).select().single();

    if (error) {
      if (error.code === '23505') { 
        const { data: existingData, error: fetchError } = await supabase
          .from('regions').select('*').eq('name', regionName).single();
        if (fetchError) handleSupabaseError(fetchError, 'addRegion (fetch existing)');
        return existingData as Region;
      }
      handleSupabaseError(error, 'addRegion');
    }
    return data as Region;
  },

  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) handleSupabaseError(error, 'getProducts');
    return data || [];
  },

  // --- DOCTOR MANAGEMENT (CRUD) ---
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

  addDoctor: async (doctor: { name: string, regionId: number, repId: string, specialization: string }): Promise<Doctor> => {
    const { data, error } = await supabase.from('doctors').insert({
      name: doctor.name,
      region_id: doctor.regionId,
      rep_id: doctor.repId,
      specialization: doctor.specialization
    }).select().single();
    
    if (error) handleSupabaseError(error, 'addDoctor');
    return { ...data, regionId: data.region_id, repId: data.rep_id };
  },

  updateDoctor: async (id: number, updates: Partial<{ name: string, regionId: number, specialization: string }>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.regionId) dbUpdates.region_id = updates.regionId;
    if (updates.specialization) dbUpdates.specialization = updates.specialization;

    const { error } = await supabase.from('doctors').update(dbUpdates).eq('id', id);
    if (error) handleSupabaseError(error, 'updateDoctor');
  },

  deleteDoctor: async (id: number): Promise<void> => {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'deleteDoctor');
  },

  // --- PHARMACY MANAGEMENT (CRUD) ---
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

  addPharmacy: async (pharmacy: { name: string, regionId: number, repId: string }): Promise<Pharmacy> => {
    const { data, error } = await supabase.from('pharmacies').insert({
      name: pharmacy.name,
      region_id: pharmacy.regionId,
      rep_id: pharmacy.repId,
      specialization: Specialization.Pharmacy
    }).select().single();
    
    if (error) handleSupabaseError(error, 'addPharmacy');
    return { ...data, regionId: data.region_id, repId: data.rep_id };
  },

  updatePharmacy: async (id: number, updates: Partial<{ name: string, regionId: number }>): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.regionId) dbUpdates.region_id = updates.regionId;

    const { error } = await supabase.from('pharmacies').update(dbUpdates).eq('id', id);
    if (error) handleSupabaseError(error, 'updatePharmacy');
  },

  deletePharmacy: async (id: number): Promise<void> => {
    const { error } = await supabase.from('pharmacies').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'deletePharmacy');
  },

  // --- VISITS & REPORTS ---
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
      if (error.code === '42804' && error.message.includes('UNION types')) throw new Error("error_get_visit_reports_sql_config");
      handleSupabaseError(error, 'getVisitReportsForRep');
    }
    return data || [];
  },

  getAllVisitReports: async (): Promise<VisitReport[]> => {
    const { data, error } = await supabase.rpc('get_visit_reports');
    if (error) {
      if (error.code === '42804' && error.message.includes('UNION types')) throw new Error("error_get_visit_reports_sql_config");
      handleSupabaseError(error, 'getAllVisitReports');
    }
    return (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getOverdueVisits: async (): Promise<ClientAlert[]> => {
    const { data, error } = await supabase.rpc('get_overdue_visits');
    if (error) handleSupabaseError(error, 'getOverdueVisits');
    
    // Map snake_case to camelCase
    return (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        repId: String(item.rep_id || item.repId),
        repName: item.rep_name || item.repName,
        regionName: String(item.region_name || item.regionName || item.region_id || ''),
        daysSinceLastVisit: item.days_since_last_visit ?? item.daysSinceLastVisit
    }));
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
    (data || []).forEach(plan => { plansObject[plan.rep_id] = { plan: plan.plan, status: plan.status }; });
    return plansObject;
  },

  // --- TASK MANAGEMENT ---
  getPendingTasksForRep: async (repId: string): Promise<RepTask[]> => {
    const { data, error } = await supabase.from('rep_tasks').select('*').eq('rep_id', repId).eq('is_completed', false).order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'getPendingTasksForRep');
    return (data || []).map(task => ({
        id: task.id, repId: task.rep_id, createdBy: task.created_by, description: task.description, isCompleted: task.is_completed, createdAt: task.created_at, completedAt: task.completed_at
    }));
  },

  getAllTasks: async (): Promise<RepTask[]> => {
    const { data, error } = await supabase.from('rep_tasks').select('*, profiles!rep_id(name)');
    if (error) handleSupabaseError(error, 'getAllTasks');
    return (data || []).map((task: any) => ({
        id: task.id, repId: task.rep_id, repName: task.profiles?.name || 'Unknown', createdBy: task.created_by, description: task.description, isCompleted: task.is_completed, createdAt: task.created_at, completedAt: task.completed_at
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createTask: async (repId: string, description: string): Promise<RepTask> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('rep_tasks').insert({ rep_id: repId, created_by: user.id, description, is_completed: false }).select('*, profiles!rep_id(name)').single();
    if (error) handleSupabaseError(error, 'createTask');
    const taskData = data as any;
    return { id: taskData.id, repId: taskData.rep_id, repName: taskData.profiles?.name || 'Unknown', createdBy: taskData.created_by, description: taskData.description, isCompleted: taskData.is_completed, createdAt: taskData.created_at, completedAt: taskData.completed_at };
  },

  completeTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('rep_tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', taskId);
    if (error) handleSupabaseError(error, 'completeTask');
  },

  deleteTask: async (taskId: string): Promise<void> => {
      const { error } = await supabase.from('rep_tasks').delete().eq('id', taskId);
      if (error) handleSupabaseError(error, 'deleteTask');
  },

  // --- ABSENCES ---
  getRepAbsences: async (): Promise<RepAbsence[]> => {
    const { data, error } = await supabase.from('rep_absences').select('*');
    if (error) {
       console.warn("Could not fetch absences. Table 'rep_absences' might not exist.", error.message);
       return [];
    }
    return (data || []).map((a: any) => ({
      id: a.id,
      repId: a.rep_id,
      date: a.date,
      reason: a.reason,
      status: a.status || 'APPROVED' // Default to APPROVED for backward compatibility if column is missing/null
    }));
  },
  
  getRepAbsencesForRep: async (repId: string): Promise<RepAbsence[]> => {
    const { data, error } = await supabase.from('rep_absences').select('*').eq('rep_id', repId);
    if (error) handleSupabaseError(error, 'getRepAbsencesForRep');
    return (data || []).map((a: any) => ({
      id: a.id,
      repId: a.rep_id,
      date: a.date,
      reason: a.reason,
      status: a.status || 'APPROVED'
    }));
  },

  addRepAbsence: async (repId: string, date: string, reason: string, status: LeaveStatus = 'PENDING'): Promise<RepAbsence> => {
    const { data, error } = await supabase.from('rep_absences').insert({
      rep_id: repId,
      date: date,
      reason: reason,
      status: status
    }).select().single();
    if (error) handleSupabaseError(error, 'addRepAbsence');
    return { id: data.id, repId: data.rep_id, date: data.date, reason: data.reason, status: data.status };
  },

  updateRepAbsenceStatus: async (id: number, status: LeaveStatus): Promise<void> => {
      const { error } = await supabase.from('rep_absences').update({ status }).eq('id', id);
      if (error) handleSupabaseError(error, 'updateRepAbsenceStatus');
  },

  deleteRepAbsence: async (id: number): Promise<void> => {
    const { error } = await supabase.from('rep_absences').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'deleteRepAbsence');
  },

  // --- SYSTEM SETTINGS ---
  getSystemSettings: async (): Promise<SystemSettings> => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) handleSupabaseError(error, 'getSystemSettings');
    return data || { weekends: [], holidays: [] };
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    const { data, error } = await supabase.from('system_settings').update({ weekends: settings.weekends, holidays: settings.holidays }).eq('id', 1).select().single();
    if (error) handleSupabaseError(error, 'updateSystemSettings');
    return data as SystemSettings;
  },

  // --- BATCH IMPORTS ---
  addDoctorsBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<{ success: number, failed: number, errors: string[] }> => {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));
    const doctorsToInsert: any[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 4) continue;
      const Name = row[0]; const RegionName = row[1]; const Spec = row[2]; const repEmail = row[3]; const rowIndex = index + 2;

      if (!Name || !RegionName || !Spec || !repEmail) {
        result.failed++; result.errors.push(`Row ${rowIndex}: Missing fields.`); continue;
      }

      let regionId = regionMap.get(String(RegionName).trim().toLowerCase());
      if (!regionId) {
        try {
          const newRegion = await api.addRegion(String(RegionName).trim());
          regionId = newRegion.id; regionMap.set(newRegion.name.trim().toLowerCase(), newRegion.id);
        } catch (e: any) {
          result.failed++; result.errors.push(`Row ${rowIndex}: Region error: ${e.message}`); continue;
        }
      }

      const repId = userMap.get(String(repEmail).trim().toLowerCase());
      if (!repId) { result.failed++; result.errors.push(`Row ${rowIndex}: Rep not found.`); continue; }

      doctorsToInsert.push({ name: String(Name).trim(), region_id: regionId, rep_id: repId, specialization: String(Spec).trim() });
    }

    if (doctorsToInsert.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < doctorsToInsert.length; i += CHUNK_SIZE) {
        const chunk = doctorsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('doctors').insert(chunk);
        if (error) { result.failed += chunk.length; result.errors.push(`Batch error: ${error.message}`); } else { result.success += chunk.length; }
        onProgress(Math.round(((i + chunk.length) / doctorsToInsert.length) * 100));
      }
    } else { onProgress(100); }
    return result;
  },

  addPharmaciesBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<{ success: number, failed: number, errors: string[] }> => {
    const result = { success: 0, failed: 0, errors: [] as string[] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.trim().toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.trim().toLowerCase(), u.id]));
    const pharmaciesToInsert: any[] = [];

    for (const [index, row] of rows.entries()) {
      if (row.length < 3) continue;
      const Name = row[0]; const RegionName = row[1]; const repEmail = row[2]; const rowIndex = index + 2;

      if (!Name || !RegionName || !repEmail) {
        result.failed++; result.errors.push(`Row ${rowIndex}: Missing fields.`); continue;
      }

      let regionId = regionMap.get(String(RegionName).trim().toLowerCase());
      if (!regionId) {
        try {
          const newRegion = await api.addRegion(String(RegionName).trim());
          regionId = newRegion.id; regionMap.set(newRegion.name.trim().toLowerCase(), newRegion.id);
        } catch (e: any) {
          result.failed++; result.errors.push(`Row ${rowIndex}: Region error: ${e.message}`); continue;
        }
      }

      const repId = userMap.get(String(repEmail).trim().toLowerCase());
      if (!repId) { result.failed++; result.errors.push(`Row ${rowIndex}: Rep not found.`); continue; }

      pharmaciesToInsert.push({ name: String(Name).trim(), region_id: regionId, rep_id: repId, specialization: Specialization.Pharmacy });
    }

    if (pharmaciesToInsert.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < pharmaciesToInsert.length; i += CHUNK_SIZE) {
        const chunk = pharmaciesToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('pharmacies').insert(chunk);
        if (error) { result.failed += chunk.length; result.errors.push(`Batch error: ${error.message}`); } else { result.success += chunk.length; }
        onProgress(Math.round(((i + chunk.length) / pharmaciesToInsert.length) * 100));
      }
    } else { onProgress(100); }
    return result;
  },
};