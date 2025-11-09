import { getSupabaseClient, initializeSupabase } from './supabaseClient';
import { User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan, UserRole } from '../types';

// Helper to handle Supabase errors
const handleSupabaseError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  throw new Error(error.message || `An unknown error occurred in ${context}`);
};

// دالة مساعدة للتحقق من صلاحيات المدير
const checkAdminPermissions = async (): Promise<boolean> => {
  const supabase = getSupabaseClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile?.role === 'manager' || profile?.role === 'admin';
  } catch {
    return false;
  }
};

// دالة لإنشاء بروفايل إذا لم يوجد
const ensureUserProfile = async (userId: string, userData: { email: string; name?: string; role?: UserRole }): Promise<any> => {
  const supabase = getSupabaseClient();
  
  // التحقق أولاً إذا البروفايل موجود
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (existingProfile) {
    return existingProfile;
  }

  // إنشاء بروفايل جديد
  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: userData.email,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      role: userData.role || 'user',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create profile:', error);
    throw new Error(`فشل إنشاء الملف الشخصي: ${error.message}`);
  }

  return newProfile;
};

export const api = {
  // --- CONNECTION TEST ---
  testSupabaseConnection: async (): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
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
    
    try {
      // المحاولة الأولى: استخدام Admin API مع Service Role Key
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (!authError && authUsers) {
        // نجح Admin API - الآن دمج مع بيانات profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', authUsers.map(u => u.id));

        // إنشاء map للبروفايلات للبحث السريع
        const profilesMap = new Map();
        if (!profilesError && profiles) {
          profiles.forEach(profile => {
            profilesMap.set(profile.id, profile);
          });
        }

        // دمج البيانات مع fallback ذكي
        const mergedUsers = authUsers.map(authUser => {
          const profile = profilesMap.get(authUser.id);
          
          return {
            id: authUser.id,
            username: authUser.email || profile?.username || '',
            name: profile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            role: (profile?.role as UserRole) || 
                  (authUser.user_metadata?.role as UserRole) || 
                  'user',
            password: '',
            email: authUser.email || '',
            created_at: profile?.created_at || authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            email_confirmed_at: authUser.email_confirmed_at,
            last_sign_in: authUser.last_sign_in_at ? 
              new Date(authUser.last_sign_in_at).toLocaleDateString('ar-EG') : 
              'لم يسجل دخول',
            status: authUser.email_confirmed_at ? 'مفعل' : 'في انتظار التفعيل'
          };
        });

        return mergedUsers;
      }

      // المحاولة الثانية: Fallback إلى profiles table فقط
      console.warn('Admin API unavailable, falling back to profiles table');
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Profiles fallback also failed:', error);
        throw error;
      }

      return (profiles || []).map(profile => ({
        ...profile,
        password: '',
        email: profile.username || '',
        last_sign_in: 'غير معروف',
        status: 'مفعل'
      }));

    } catch (error: any) {
      console.error('Complete failure in getUsers:', error);
      
      // Fallback نهائي آمن
      if (error.message?.includes('JWT')) {
        throw new Error('خطأ في الصلاحيات: تأكد من استخدام مفتاح Service Role في واجهة المدير');
      }
      
      if (error.message?.includes('row-level security')) {
        throw new Error('تم رفض الوصول: سياسات الأمان تمنع عرض المستخدمين');
      }
      
      throw new Error(`فشل تحميل بيانات المستخدمين: ${error.message || 'سبب غير معروف'}`);
    }
  },

  getUsersStats: async (): Promise<{
    total: number;
    active: number;
    pending: number;
    managers: number;
    reps: number;
  }> => {
    try {
      const users = await api.getUsers();
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

      return {
        total: users.length,
        active: users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo).length,
        pending: users.filter(u => !u.email_confirmed_at).length,
        managers: users.filter(u => u.role === 'manager').length,
        reps: users.filter(u => u.role === 'rep').length
      };
    } catch (error) {
      console.error('Error getting users stats:', error);
      return {
        total: 0,
        active: 0,
        pending: 0,
        managers: 0,
        reps: 0
      };
    }
  },

  addUser: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const supabase = getSupabaseClient();
    
    // التحقق من الصلاحيات
    const isAdmin = await checkAdminPermissions();
    if (!isAdmin) {
      throw new Error('error_permission_denied');
    }

    const email = userData.username.toLowerCase().trim();

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('بريد إلكتروني غير صالح');
    }

    // التحقق من قوة كلمة المرور
    if (userData.password.length < 6) {
      throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    // حفظ session المدير الحالي
    const { data: { session: managerSession } } = await supabase.auth.getSession();
    let sessionRestored = false;

    try {
      // إنشاء المستخدم في Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role
          }
        }
      });

      if (authError) {
        if (authError.message.includes('user already registered')) {
          throw new Error('user_already_exists');
        }
        if (authError.message.includes('password')) {
          throw new Error('كلمة المرور غير مقبولة');
        }
        if (authError.message.includes('email')) {
          throw new Error('البريد الإلكتروني غير مقبول');
        }
        handleSupabaseError(authError, 'addUser (signUp)');
      }
      
      if (!authData.user) {
        throw new Error('فشل إنشاء المستخدم في النظام');
      }

      // تأكيد إنشاء البروفايل
      const profileData = await ensureUserProfile(authData.user.id, {
        email: email,
        name: userData.name,
        role: userData.role
      });

      // استعادة session المدير
      if (managerSession) {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: managerSession.access_token,
          refresh_token: managerSession.refresh_token,
        });
        
        if (!restoreError) {
          sessionRestored = true;
        }
      }

      return { 
        ...profileData, 
        password: '',
        email: email
      };

    } catch (error: any) {
      // محاولة استعادة session في حالة الخطأ
      if (!sessionRestored && managerSession) {
        try {
          await supabase.auth.setSession({
            access_token: managerSession.access_token,
            refresh_token: managerSession.refresh_token,
          });
        } catch (restoreError) {
          console.error('Failed to restore session:', restoreError);
        }
      }

      // إعادة throw الخطأ مع رسالة مناسبة
      if (error.message === 'user_already_exists') {
        throw new Error('user_already_exists');
      }
      
      throw new Error(error.message || 'فشل إنشاء المستخدم');
    }
  },

  updateUser: async (userId: string, updates: Partial<Pick<User, 'name' | 'role'>>): Promise<User | null> => {
    const supabase = getSupabaseClient();
    
    const { name, role } = updates;
    const { data, error } = await supabase
      .from('profiles')
      .update({ name, role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.message.includes('violates row-level security policy')) {
        throw new Error('error_permission_denied');
      }
      handleSupabaseError(error, 'updateUser (profile)');
      return null;
    }

    return data ? { ...data, password: '' } : null;
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("Failed to delete user with admin privileges:", error.message);
      throw new Error('error_permission_denied_delete_user');
    }
    return true;
  },

  sendPasswordResetEmail: async (username: string): Promise<void> => {
    const supabase = getSupabaseClient();
    const email = username;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      console.error('Password reset request error:', error.message);
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
      if (error.code === '23505') {
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
    const supabase = getSupabaseClient();
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