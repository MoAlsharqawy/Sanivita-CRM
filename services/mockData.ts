import { UserRole, User, Region, Doctor, Pharmacy, Product, DoctorVisit, PharmacyVisit, VisitReport, Specialization, ClientAlert, SystemSettings, WeeklyPlan } from '../types';

// --- USERS ---
const users: User[] = [
  { id: 1, name: 'أحمد محمود', username: 'manager', password: 'password', role: UserRole.Manager },
  { id: 2, name: 'علي حسن', username: 'rep1', password: 'password', role: UserRole.Rep },
  { id: 3, name: 'فاطمة الزهراء', username: 'rep2', password: 'password', role: UserRole.Rep },
  { id: 4, name: 'خالد وليد', username: 'rep3', password: 'password', role: UserRole.Rep },
  { id: 5, name: 'سارة عبد الله', username: 'rep4', password: 'password', role: UserRole.Rep },
  { id: 6, name: 'محمد سعيد', username: 'rep5', password: 'password', role: UserRole.Rep },
  { id: 7, name: 'مشرف محمد', username: 'supervisor', password: 'password', role: UserRole.Supervisor },
];

// --- REGIONS ---
const regions: Region[] = [
  { id: 1, name: 'المنطقة الشمالية' },
  { id: 2, name: 'المنطقة الجنوبية' },
  { id: 3, name: 'المنطقة الشرقية' },
  { id: 4, name: 'المنطقة الغربية' },
  { id: 5, name: 'المنطقة الوسطى' },
];

// --- DOCTORS ---
let doctors: Doctor[] = [
  { id: 1, name: 'د. إبراهيم نصر', regionId: 1, repId: 2, specialization: Specialization.Pediatrics },
  { id: 2, name: 'د. عائشة قاسم', regionId: 1, repId: 2, specialization: Specialization.Pulmonology },
  { id: 3, name: 'د. يوسف حمدان', regionId: 2, repId: 3, specialization: Specialization.Pediatrics },
  { id: 4, name: 'د. مريم صلاح', regionId: 2, repId: 3, specialization: Specialization.Pulmonology },
  { id: 5, name: 'د. عمر فاروق', regionId: 3, repId: 4, specialization: Specialization.Pediatrics },
  { id: 6, name: 'د. زينب عمران', regionId: 3, repId: 4, specialization: Specialization.Pulmonology },
  { id: 7, name: 'د. حسام الدين', regionId: 4, repId: 5, specialization: Specialization.Pediatrics },
  { id: 8, name: 'د. ليلى مراد', regionId: 4, repId: 5, specialization: Specialization.Pulmonology },
  { id: 9, name: 'د. أنس كريم', regionId: 5, repId: 6, specialization: Specialization.Pediatrics },
  { id: 10, name: 'د. رقية شريف', regionId: 5, repId: 6, specialization: Specialization.Pulmonology },
];

// --- PHARMACIES ---
let pharmacies: Pharmacy[] = [
  { id: 1, name: 'صيدلية الشفاء', regionId: 1, repId: 2, specialization: Specialization.Pharmacy },
  { id: 2, name: 'صيدلية الدواء', regionId: 1, repId: 2, specialization: Specialization.Pharmacy },
  { id: 3, name: 'صيدلية الأمل', regionId: 2, repId: 3, specialization: Specialization.Pharmacy },
  { id: 4, name: 'صيدلية الصحة', regionId: 3, repId: 4, specialization: Specialization.Pharmacy },
  { id: 5, name: 'صيدلية العافية', regionId: 4, repId: 5, specialization: Specialization.Pharmacy },
  { id: 6, name: 'صيدلية النور', regionId: 5, repId: 6, specialization: Specialization.Pharmacy },
];

// --- PRODUCTS ---
const products: Product[] = [
  { id: 1, name: 'Product A' },
  { id: 2, name: 'Product B' },
  { id: 3, name: 'Product C' },
  { id: 4, name: 'Product D' },
];

// --- VISITS ---
let doctorVisits: DoctorVisit[] = [
    { id: 1, doctorId: 1, repId: 2, productIds: [1, 3], regionId: 1, visitType: 'Single', doctorComment: 'أبدى الطبيب اهتمامًا بالمنتج.', date: '2024-05-20T10:00:00Z' },
    { id: 2, doctorId: 3, repId: 3, productIds: [2], regionId: 2, visitType: 'Coaching', doctorComment: 'طلب عينات إضافية.', date: '2024-05-21T11:30:00Z' },
];
let pharmacyVisits: PharmacyVisit[] = [
    { id: 1, pharmacyId: 1, repId: 2, regionId: 1, visitNotes: 'تم التأكد من توافر المنتجات.', date: '2024-05-20T14:00:00Z' },
    { id: 2, pharmacyId: 3, repId: 3, regionId: 2, visitNotes: 'طلب جديد قيد الإعداد.', date: '2024-05-21T15:00:00Z' },
];

// --- SYSTEM SETTINGS ---
let systemSettings: SystemSettings = {
    weekends: [4, 5], // Thursday, Friday by default
    holidays: [`${new Date().getFullYear()}-01-01`, `${new Date().getFullYear()}-10-06`], // Example holidays
};

// --- REP WEEKLY PLANS ---
let repWeeklyPlans: { [repId: number]: WeeklyPlan } = {
    2: { 
        plan: { 6: 1, 0: 1, 1: 2, 2: 2, 3: 3 }, // rep1 (id: 2) plan
        status: 'draft',
    },
    3: {
        plan: { 0: 4, 1: 4, 2: 5, 3: 5 }, // rep2 (id: 3) plan
        status: 'pending',
    },
     4: {
        plan: {},
        status: 'approved'
    },
    5: {
        plan: { 6: 2, 0: 2 },
        status: 'rejected'
    }
};

// ID Generators
let nextDoctorId = Math.max(...doctors.map(d => d.id), 0) + 1;
let nextPharmacyId = Math.max(...pharmacies.map(p => p.id), 0) + 1;


// --- API FUNCTIONS ---
export const api = {
  login: (username: string, password: string): Promise<User | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = users.find(u => u.username === username && u.password === password);
        resolve(user ? { ...user, password: '' } : null);
      }, 500);
    });
  },

  changeUserPassword: (userId: number, newPassword: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
          users[userIndex].password = newPassword;
          console.log(`Password for user ${users[userIndex].username} changed to: ${newPassword}`);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 300);
    });
  },

  getUsers: (): Promise<User[]> => Promise.resolve(users.map(({password, ...user}) => user)),
  getRegions: (): Promise<Region[]> => Promise.resolve(regions),
  getProducts: (): Promise<Product[]> => Promise.resolve(products),

  getSystemSettings: (): Promise<SystemSettings> => {
    return Promise.resolve(systemSettings);
  },

  updateSystemSettings: (settings: SystemSettings): Promise<SystemSettings> => {
    return new Promise(resolve => {
        systemSettings = { ...settings };
        resolve(systemSettings);
    });
  },

  getRepPlan: (repId: number): Promise<WeeklyPlan> => {
    if (!repWeeklyPlans[repId]) {
        repWeeklyPlans[repId] = { plan: {}, status: 'draft' };
    }
    return Promise.resolve(repWeeklyPlans[repId]);
  },

  updateRepPlan: (repId: number, planData: WeeklyPlan['plan']): Promise<WeeklyPlan> => {
      return new Promise(resolve => {
        const currentPlan = repWeeklyPlans[repId] || { plan: {}, status: 'draft' };
        currentPlan.plan = planData;
        currentPlan.status = 'pending'; // Submitting always sets to pending
        repWeeklyPlans[repId] = currentPlan;
        resolve(repWeeklyPlans[repId]);
      });
  },

  reviewRepPlan: (repId: number, newStatus: 'approved' | 'rejected'): Promise<WeeklyPlan> => {
      return new Promise((resolve, reject) => {
          if (repWeeklyPlans[repId]) {
              repWeeklyPlans[repId].status = newStatus;
              resolve(repWeeklyPlans[repId]);
          } else {
              reject(new Error('Plan not found for this representative.'));
          }
      });
  },
  
  getAllPlans: (): Promise<{ [repId: number]: WeeklyPlan }> => {
    users.forEach(user => {
        if (user.role === UserRole.Rep && !repWeeklyPlans[user.id]) {
            repWeeklyPlans[user.id] = { plan: {}, status: 'draft' };
        }
    });
    return Promise.resolve(repWeeklyPlans);
  },


  getAllDoctors: (): Promise<Doctor[]> => {
    return Promise.resolve(doctors);
  },

  getDoctorsForRep: (repId: number): Promise<Doctor[]> => {
    return Promise.resolve(doctors.filter(d => d.repId === repId));
  },

  getAllPharmacies: (): Promise<Pharmacy[]> => {
    return Promise.resolve(pharmacies);
  },

  getPharmaciesForRep: (repId: number): Promise<Pharmacy[]> => {
    return Promise.resolve(pharmacies.filter(p => p.repId === repId));
  },
  
  addDoctorVisit: (visit: Omit<DoctorVisit, 'id' | 'date'>): Promise<DoctorVisit> => {
    return new Promise(resolve => {
        const newVisit: DoctorVisit = {
            ...visit,
            id: doctorVisits.length + 1,
            date: new Date().toISOString()
        };
        doctorVisits.push(newVisit);
        resolve(newVisit);
    })
  },

  addPharmacyVisit: (visit: Omit<PharmacyVisit, 'id' | 'date'>): Promise<PharmacyVisit> => {
    return new Promise(resolve => {
        const newVisit: PharmacyVisit = {
            ...visit,
            id: pharmacyVisits.length + 1,
            date: new Date().toISOString()
        };
        pharmacyVisits.push(newVisit);
        resolve(newVisit);
    })
  },

  getVisitReportsForRep: (repId: number): Promise<VisitReport[]> => {
    const reports: VisitReport[] = [];

    doctorVisits
      .filter(v => v.repId === repId)
      .forEach(v => {
        const doctor = doctors.find(d => d.id === v.doctorId);
        reports.push({
          id: `d-${v.id}`,
          type: 'DOCTOR_VISIT',
          repName: users.find(u => u.id === v.repId)?.name || 'غير معروف',
          regionName: regions.find(r => r.id === v.regionId)?.name || 'غير معروف',
          targetName: doctor?.name || 'غير معروف',
          targetSpecialization: doctor?.specialization,
          productName: v.productIds.map(pid => products.find(p => p.id === pid)?.name).filter(Boolean).join(', '),
          visitType: v.visitType,
          notes: v.doctorComment,
          date: v.date,
        });
      });

    pharmacyVisits
      .filter(v => v.repId === repId)
      .forEach(v => {
        const pharmacy = pharmacies.find(p => p.id === v.pharmacyId);
        reports.push({
          id: `p-${v.id}`,
          type: 'PHARMACY_VISIT',
          repName: users.find(u => u.id === v.repId)?.name || 'غير معروف',
          regionName: regions.find(r => r.id === v.regionId)?.name || 'غير معروف',
          targetName: pharmacy?.name || 'غير معروف',
          targetSpecialization: pharmacy?.specialization,
          notes: v.visitNotes,
          date: v.date,
        });
      });
    
    return Promise.resolve(reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  },

  getAllVisitReports: (): Promise<VisitReport[]> => {
    const reports: VisitReport[] = [];

    doctorVisits.forEach(v => {
      const doctor = doctors.find(d => d.id === v.doctorId);
      reports.push({
        id: `d-${v.id}`,
        type: 'DOCTOR_VISIT',
        repName: users.find(u => u.id === v.repId)?.name || 'غير معروف',
        regionName: regions.find(r => r.id === v.regionId)?.name || 'غير معروف',
        targetName: doctor?.name || 'غير معروف',
        targetSpecialization: doctor?.specialization,
        productName: v.productIds.map(pid => products.find(p => p.id === pid)?.name).filter(Boolean).join(', '),
        visitType: v.visitType,
        notes: v.doctorComment,
        date: v.date,
      });
    });

    pharmacyVisits.forEach(v => {
      const pharmacy = pharmacies.find(p => p.id === v.pharmacyId);
      reports.push({
        id: `p-${v.id}`,
        type: 'PHARMACY_VISIT',
        repName: users.find(u => u.id === v.repId)?.name || 'غير معروف',
        regionName: regions.find(r => r.id === v.regionId)?.name || 'غير معروف',
        targetName: pharmacy?.name || 'غير معروف',
        targetSpecialization: pharmacy?.specialization,
        notes: v.visitNotes,
        date: v.date,
      });
    });
    
    return Promise.resolve(reports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  },

  getOverdueVisits: (): Promise<ClientAlert[]> => {
    return new Promise(resolve => {
        const alerts: ClientAlert[] = [];
        const now = new Date();
        const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;

        const allClients: (Doctor | Pharmacy)[] = [...doctors, ...pharmacies];

        allClients.forEach(client => {
            const isDoctor = 'specialization' in client && client.specialization !== Specialization.Pharmacy;
            const relevantVisits = isDoctor 
                ? doctorVisits.filter(v => v.doctorId === client.id)
                : pharmacyVisits.filter(v => v.pharmacyId === client.id);

            let lastVisitDate: Date | null = null;

            if (relevantVisits.length > 0) {
                const latestVisit = relevantVisits.reduce((latest, current) => {
                    return new Date(current.date) > new Date(latest.date) ? current : latest;
                });
                lastVisitDate = new Date(latestVisit.date);
            }

            const daysSinceLastVisit = lastVisitDate 
                ? Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24))
                : null;
            
            if (daysSinceLastVisit === null || daysSinceLastVisit > 10) {
                 const rep = users.find(u => u.id === client.repId);
                 const region = regions.find(r => r.id === client.regionId);

                 if (rep && region) {
                     alerts.push({
                         id: `${isDoctor ? 'doctor' : 'pharmacy'}-${client.id}`,
                         name: client.name,
                         type: isDoctor ? 'doctor' : 'pharmacy',
                         repId: rep.id,
                         repName: rep.name,
                         regionName: region.name,
                         daysSinceLastVisit: daysSinceLastVisit,
                     });
                 }
            }
        });

        resolve(alerts);
    });
  },

  addDoctorsBatch: (data: any[]): Promise<{success: number, failed: number, errors: string[]}> => {
    return new Promise(resolve => {
        const result = { success: 0, failed: 0, errors: [] as string[] };
        data.forEach((row, index) => {
            const { Name, Region, Specialization: Spec, 'Rep Username': repUsername } = row;
            // Validation
            if (!Name || !Region || !Spec || !repUsername) {
                result.failed++;
                result.errors.push(`Row ${index + 2}: Missing required fields.`);
                return;
            }
            const region = regions.find(r => r.name.trim().toLowerCase() === String(Region).trim().toLowerCase());
            const rep = users.find(u => u.username.trim().toLowerCase() === String(repUsername).trim().toLowerCase() && u.role === UserRole.Rep);
            // Fix: Use 'as const' to ensure `validSpec` is correctly typed as a union of allowed specializations.
            const specValues = [Specialization.Pediatrics, Specialization.Pulmonology] as const;
            const validSpec = specValues.find(s => s.toLowerCase() === String(Spec).trim().toLowerCase());

            if (!region) {
                result.failed++;
                result.errors.push(`Row ${index + 2}: Region "${Region}" not found.`);
                return;
            }
            if (!rep) {
                result.failed++;
                result.errors.push(`Row ${index + 2}: Rep with username "${repUsername}" not found.`);
                return;
            }
            if (!validSpec) {
                result.failed++;
                result.errors.push(`Row ${index + 2}: Invalid specialization "${Spec}". Must be one of: ${specValues.join(', ')}.`);
                return;
            }
            
            const newDoctor: Doctor = {
                id: nextDoctorId++,
                name: Name,
                regionId: region.id,
                repId: rep.id,
                specialization: validSpec,
            };
            doctors.push(newDoctor);
            result.success++;
        });
        resolve(result);
    });
  },

  addPharmaciesBatch: (data: any[]): Promise<{success: number, failed: number, errors: string[]}> => {
      return new Promise(resolve => {
          const result = { success: 0, failed: 0, errors: [] as string[] };
          data.forEach((row, index) => {
              const { Name, Region, 'Rep Username': repUsername } = row;
              if (!Name || !Region || !repUsername) {
                  result.failed++;
                  result.errors.push(`Row ${index + 2}: Missing required fields.`);
                  return;
              }
              const region = regions.find(r => r.name.trim().toLowerCase() === String(Region).trim().toLowerCase());
              const rep = users.find(u => u.username.trim().toLowerCase() === String(repUsername).trim().toLowerCase() && u.role === UserRole.Rep);

              if (!region) {
                  result.failed++;
                  result.errors.push(`Row ${index + 2}: Region "${Region}" not found.`);
                  return;
              }
              if (!rep) {
                  result.failed++;
                  result.errors.push(`Row ${index + 2}: Rep with username "${repUsername}" not found.`);
                  return;
              }

              const newPharmacy: Pharmacy = {
                  id: nextPharmacyId++,
                  name: Name,
                  regionId: region.id,
                  repId: rep.id,
                  specialization: Specialization.Pharmacy,
              };
              pharmacies.push(newPharmacy);
              result.success++;
          });
          resolve(result);
      });
  },
};