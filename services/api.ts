
import { supabase } from './supabaseClient';
import { User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan, UserRole, RepTask, RepAbsence, LeaveStatus, Expense } from '../types';

const handleSupabaseError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  throw new Error(error.message || `An unknown error occurred in ${context}`);
};

export const api = {
  // --- AUTH & PROFILE ---
  login: async (username: string, password: string): Promise<User> => {
    const { data: { user: authUser }, error } = await supabase.auth.signInWithPassword({
      email: username,
      password: password,
    });
    if (error || !authUser) throw new Error('incorrect_credentials');
    return await api.getUserProfile(authUser.id);
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
  },

  // Fix: Added missing sendPasswordResetEmail method used in components/Login.tsx
  sendPasswordResetEmail: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) handleSupabaseError(error, 'sendPasswordResetEmail');
  },

  getUserProfile: async (userId: string): Promise<User> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) handleSupabaseError(error, 'getUserProfile');
    return { ...data, password: '' } as User;
  },

  updateUserPassword: async (newPassword: string): Promise<boolean> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return !error;
  },

  // --- USER MGMT ---
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) handleSupabaseError(error, 'getUsers');
    return (data || []).map(u => ({ ...u, password: '' }));
  },

  addUser: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.username,
      password: userData.password,
      options: { data: { name: userData.name } }
    });
    if (authError) handleSupabaseError(authError, 'addUser');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({ role: userData.role, username: userData.username })
      .eq('id', authData.user!.id)
      .select().single();
    if (profileError) handleSupabaseError(profileError, 'addUser profile');
    return { ...profileData, password: '' };
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) handleSupabaseError(error, 'updateUser');
  },

  deleteUser: async (userId: string): Promise<void> => {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) handleSupabaseError(error, 'deleteUser');
  },

  resetRepData: async (repId: string): Promise<void> => {
    const { error } = await supabase.rpc('reset_rep_data', { p_rep_id: repId });
    if (error) handleSupabaseError(error, 'resetRepData');
  },

  // --- REGIONS & PRODUCTS ---
  getRegions: async (): Promise<Region[]> => {
    const { data, error } = await supabase.from('regions').select('*');
    if (error) handleSupabaseError(error, 'getRegions');
    return data || [];
  },

  getRegionsForRep: async (repId: string, fallbackToAll = true): Promise<Region[]> => {
    const { data, error } = await supabase.from('user_regions').select('regions(*)').eq('user_id', repId);
    const assigned = (data || []).map((i: any) => i.regions).filter(Boolean);
    return (assigned.length === 0 && fallbackToAll) ? await api.getRegions() : assigned;
  },

  updateUserRegions: async (userId: string, regionIds: number[]): Promise<void> => {
    await supabase.from('user_regions').delete().eq('user_id', userId);
    if (regionIds.length > 0) {
      await supabase.from('user_regions').insert(regionIds.map(id => ({ user_id: userId, region_id: id })));
    }
  },

  addRegion: async (name: string): Promise<Region> => {
    const { data, error } = await supabase.from('regions').insert({ name }).select().single();
    if (error) handleSupabaseError(error, 'addRegion');
    return data;
  },

  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*');
    return data || [];
  },

  // --- DOCTORS & PHARMACIES ---
  getAllDoctors: async (): Promise<Doctor[]> => {
    const { data, error } = await supabase.from('doctors').select('*');
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  getDoctorsForRep: async (repId: string): Promise<Doctor[]> => {
    const { data, error } = await supabase.from('doctors').select('*').eq('rep_id', repId);
    return (data || []).map(d => ({ ...d, regionId: d.region_id, repId: d.rep_id }));
  },

  addDoctor: async (doc: any): Promise<Doctor> => {
    const { data, error } = await supabase.from('doctors').insert({
      name: doc.name, region_id: doc.regionId, rep_id: doc.repId, specialization: doc.specialization
    }).select().single();
    if (error) handleSupabaseError(error, 'addDoctor');
    return { ...data, regionId: data.region_id, repId: data.rep_id };
  },

  updateDoctor: async (id: number, updates: any): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.regionId) dbUpdates.region_id = updates.regionId;
    if (updates.specialization) dbUpdates.specialization = updates.specialization;
    await supabase.from('doctors').update(dbUpdates).eq('id', id);
  },

  deleteDoctor: async (id: number): Promise<void> => {
    await supabase.from('doctor_visits').delete().eq('doctor_id', id);
    await supabase.from('doctors').delete().eq('id', id);
  },

  getAllPharmacies: async (): Promise<Pharmacy[]> => {
    const { data, error } = await supabase.from('pharmacies').select('*');
    return (data || []).map(p => ({ ...p, regionId: p.region_id, repId: p.rep_id }));
  },

  getPharmaciesForRep: async (repId: string): Promise<Pharmacy[]> => {
    const { data, error } = await supabase.from('pharmacies').select('*').eq('rep_id', repId);
    return (data || []).map(p => ({ ...p, regionId: p.region_id, rep_id: p.rep_id }));
  },

  addPharmacy: async (ph: any): Promise<Pharmacy> => {
    const { data, error } = await supabase.from('pharmacies').insert({
      name: ph.name, region_id: ph.regionId, rep_id: ph.repId, specialization: Specialization.Pharmacy
    }).select().single();
    return { ...data, regionId: data.region_id, repId: data.rep_id };
  },

  // Fix: Added missing updatePharmacy method used in components/ClientFormModal.tsx
  updatePharmacy: async (id: number, updates: any): Promise<void> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.regionId) dbUpdates.region_id = updates.regionId;
    const { error } = await supabase.from('pharmacies').update(dbUpdates).eq('id', id);
    if (error) handleSupabaseError(error, 'updatePharmacy');
  },

  deletePharmacy: async (id: number): Promise<void> => {
    await supabase.from('pharmacy_visits').delete().eq('pharmacy_id', id);
    await supabase.from('pharmacies').delete().eq('id', id);
  },

  // --- VISITS ---
  addDoctorVisit: async (visit: Omit<DoctorVisit, 'id' | 'date'>): Promise<DoctorVisit> => {
    const { data, error } = await supabase.rpc('add_doctor_visit_with_products', {
      p_doctor_id: visit.doctorId,
      p_rep_id: visit.repId,
      p_region_id: visit.regionId,
      p_visit_type: visit.visitType,
      p_doctor_comment: visit.doctorComment,
      p_product_ids: visit.productIds,
      p_latitude: visit.latitude,
      p_longitude: visit.longitude
    }).single();
    if (error) handleSupabaseError(error, 'addDoctorVisit');
    return data;
  },

  addPharmacyVisit: async (visit: Omit<PharmacyVisit, 'id' | 'date'>): Promise<PharmacyVisit> => {
    const { data, error } = await supabase.from('pharmacy_visits').insert({
      pharmacy_id: visit.pharmacyId,
      rep_id: visit.repId,
      region_id: visit.regionId,
      visit_notes: visit.visitNotes,
      latitude: visit.latitude,
      longitude: visit.longitude
    }).select().single();
    if (error) handleSupabaseError(error, 'addPharmacyVisit');
    return { ...data, pharmacyId: data.pharmacy_id, repId: data.rep_id, regionId: data.region_id };
  },

  getVisitReportsForRep: async (repId: string): Promise<VisitReport[]> => {
    const { data, error } = await supabase.rpc('get_visit_reports', { p_rep_id: repId });
    return data || [];
  },

  getAllVisitReports: async (): Promise<VisitReport[]> => {
    const { data, error } = await supabase.rpc('get_visit_reports');
    return (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getOverdueVisits: async (): Promise<ClientAlert[]> => {
    const { data, error } = await supabase.rpc('get_overdue_visits');
    return (data || []).map((i: any) => ({
        id: i.id, name: i.name, type: i.type, repId: String(i.rep_id), repName: i.rep_name, regionName: String(i.region_name), daysSinceLastVisit: i.days_since_last_visit
    }));
  },

  // --- PLANS ---
  getRepPlan: async (repId: string): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').select('plan, status').eq('rep_id', repId).maybeSingle();
    return data || { plan: {}, status: 'draft' };
  },

  updateRepPlan: async (repId: string, planData: any): Promise<WeeklyPlan> => {
    const { data, error } = await supabase.from('weekly_plans').upsert({
      rep_id: repId, plan: planData, status: 'pending',
    }, { onConflict: 'rep_id' }).select('plan, status').single();
    return data as WeeklyPlan;
  },

  reviewRepPlan: async (repId: string, status: string): Promise<void> => {
    await supabase.from('weekly_plans').update({ status }).eq('rep_id', repId);
  },

  getAllPlans: async (): Promise<{ [repId: string]: WeeklyPlan }> => {
    const { data } = await supabase.from('weekly_plans').select('rep_id, plan, status');
    const plans: any = {};
    (data || []).forEach(p => { plans[p.rep_id] = { plan: p.plan, status: p.status }; });
    return plans;
  },

  // --- TASKS ---
  getPendingTasksForRep: async (repId: string): Promise<RepTask[]> => {
    const { data } = await supabase.from('rep_tasks').select('*').eq('rep_id', repId).eq('is_completed', false).order('created_at', { ascending: false });
    return (data || []).map(t => ({ id: t.id, repId: t.rep_id, createdBy: t.created_by, description: t.description, isCompleted: t.is_completed, createdAt: t.created_at }));
  },

  createTask: async (repId: string, description: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('rep_tasks').insert({ rep_id: repId, created_by: user!.id, description, is_completed: false });
  },

  completeTask: async (id: string): Promise<void> => {
    await supabase.from('rep_tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', id);
  },

  // --- ABSENCES ---
  getRepAbsences: async (): Promise<RepAbsence[]> => {
    const { data } = await supabase.from('rep_absences').select('*');
    return (data || []).map(a => ({ id: a.id, repId: a.rep_id, date: a.date, reason: a.reason, status: a.status }));
  },

  getRepAbsencesForRep: async (repId: string): Promise<RepAbsence[]> => {
    const { data } = await supabase.from('rep_absences').select('*').eq('rep_id', repId);
    return (data || []).map(a => ({ id: a.id, repId: a.rep_id, date: a.date, reason: a.reason, status: a.status }));
  },

  addRepAbsence: async (repId: string, date: string, reason: string, status: LeaveStatus = 'PENDING'): Promise<RepAbsence> => {
    const { data, error } = await supabase.from('rep_absences').insert({ rep_id: repId, date, reason, status }).select().single();
    if (error) handleSupabaseError(error, 'addRepAbsence');
    return { ...data, repId: data.rep_id };
  },

  updateRepAbsenceStatus: async (id: number, status: string): Promise<void> => {
    await supabase.from('rep_absences').update({ status }).eq('id', id);
  },

  deleteRepAbsence: async (id: number): Promise<void> => {
    await supabase.from('rep_absences').delete().eq('id', id);
  },

  // --- SYSTEM SETTINGS ---
  getSystemSettings: async (): Promise<SystemSettings> => {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (error) handleSupabaseError(error, 'getSystemSettings');
    return data || { weekends: [], holidays: [] };
  },

  updateSystemSettings: async (settings: SystemSettings): Promise<void> => {
    await supabase.from('system_settings').update({ weekends: settings.weekends, holidays: settings.holidays }).eq('id', 1);
  },

  // --- EXPENSES ---
  getExpenses: async (repId?: string): Promise<Expense[]> => {
    let query = supabase.from('expenses').select('*, profiles!rep_id(name)');
    if (repId) query = query.eq('rep_id', repId);
    const { data, error } = await query.order('date', { ascending: false });
    if (error) handleSupabaseError(error, 'getExpenses');
    return (data || []).map(e => ({
      id: e.id, repId: e.rep_id, repName: e.profiles?.name, amount: e.amount, category: e.category, description: e.description, date: e.date, status: e.status
    }));
  },

  addExpense: async (expense: Omit<Expense, 'id' | 'status' | 'repName'>): Promise<Expense> => {
    const { data, error } = await supabase.from('expenses').insert({
      rep_id: expense.repId, amount: expense.amount, category: expense.category, description: expense.description, date: expense.date, status: 'PENDING'
    }).select().single();
    if (error) handleSupabaseError(error, 'addExpense');
    return data;
  },

  reviewExpense: async (id: string, status: 'APPROVED' | 'REJECTED'): Promise<void> => {
    await supabase.from('expenses').update({ status }).eq('id', id);
  },

  // --- BATCH IMPORTS ---
  addDoctorsBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<any> => {
    const result = { success: 0, failed: 0, errors: [] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.toLowerCase(), u.id]));
    const toInsert = [];
    for (const [idx, row] of rows.entries()) {
      if (row.length < 4) continue;
      const [name, reg, spec, email] = row;
      let regId = regionMap.get(String(reg).toLowerCase());
      if (!regId) {
        const nr = await api.addRegion(String(reg)); regId = nr.id; regionMap.set(nr.name.toLowerCase(), nr.id);
      }
      const uId = userMap.get(String(email).toLowerCase());
      if (uId) toInsert.push({ name: String(name), region_id: regId, rep_id: uId, specialization: String(spec) });
      else result.failed++;
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('doctors').insert(toInsert);
      if (error) result.failed += toInsert.length; else result.success = toInsert.length;
    }
    onProgress(100); return result;
  },

  addPharmaciesBatch: async (rows: any[][], onProgress: (p: number) => void): Promise<any> => {
    const result = { success: 0, failed: 0, errors: [] };
    const [regions, users] = await Promise.all([api.getRegions(), api.getUsers()]);
    const regionMap = new Map(regions.map(r => [r.name.toLowerCase(), r.id]));
    const userMap = new Map(users.map(u => [u.username.toLowerCase(), u.id]));
    const toInsert = [];
    for (const [idx, row] of rows.entries()) {
      if (row.length < 3) continue;
      const [name, reg, email] = row;
      let regId = regionMap.get(String(reg).toLowerCase());
      if (!regId) {
        const nr = await api.addRegion(String(reg)); regId = nr.id; regionMap.set(nr.name.toLowerCase(), nr.id);
      }
      const uId = userMap.get(String(email).toLowerCase());
      if (uId) toInsert.push({ name: String(name), region_id: regId, rep_id: uId, specialization: Specialization.Pharmacy });
      else result.failed++;
    }
    if (toInsert.length > 0) {
      const { error } = await supabase.from('pharmacies').insert(toInsert);
      if (error) result.failed += toInsert.length; else result.success = toInsert.length;
    }
    onProgress(100); return result;
  }
};
