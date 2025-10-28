import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/mockData';
import { Doctor, Pharmacy, Product, VisitReport, Region, ClientAlert, SystemSettings, WeeklyPlan } from '../types';
import { DoctorIcon, PharmacyIcon, CalendarIcon, SearchIcon, WarningIcon, UserGroupIcon, DownloadIcon, MapPinIcon, ChartBarIcon } from './icons';
import Modal from './Modal';
import VisitForm from './VisitForm';
import ClientSearch from './ClientSearch';
import { exportClientsToExcel } from '../services/exportService';
import WeeklyView from './WeeklyView';
import PlanEditor from './PlanEditor';

const RepDashboard: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitReport[]>([]);
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'search' | 'weekly' | 'plan'>('dashboard');
  const [showClientLists, setShowClientLists] = useState(false);
  const [initialRegionForVisit, setInitialRegionForVisit] = useState<number | null>(null);

  // Refs for drag and drop functionality
  const draggedItemIndex = useRef<number | null>(null);
  const dragOverItemIndex = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [doctorsData, pharmaciesData, productsData, visitsData, regionsData, overdueData, settingsData, planData] = await Promise.all([
        api.getDoctorsForRep(user.id),
        api.getPharmaciesForRep(user.id),
        api.getProducts(),
        api.getVisitReportsForRep(user.id),
        api.getRegions(),
        api.getOverdueVisits(),
        api.getSystemSettings(),
        api.getRepPlan(user.id)
      ]);
      setDoctors(doctorsData);
      setPharmacies(pharmaciesData);
      setProducts(productsData);
      setRecentVisits(visitsData);
      setRegions(regionsData);
      setAlerts(overdueData.filter(a => a.repId === user.id));
      setSystemSettings(settingsData);
      setPlan(planData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleFormSuccess = () => {
    setIsModalOpen(false);
    fetchData(); // Refresh all data to show the new visit in history
  }

  const handleExportClients = () => {
    if (user) {
      exportClientsToExcel(doctors, pharmacies, regions, `clients_${user.username}`);
    }
  };
  
  const handleWeeklyPlanClick = () => {
    const isThursday = new Date().getDay() === 4; // 0:Sun, 1:Mon, ..., 4:Thu
    const canEdit = !plan || plan.status !== 'approved' || isThursday;

    if (canEdit) {
        setView('plan');
    } else {
        setView('weekly');
    }
  };


  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    draggedItemIndex.current = index;
    setTimeout(() => {
        if(e.target instanceof HTMLElement) {
            e.target.classList.add('opacity-50');
        }
    }, 0);
  };

  const handleDragEnter = (index: number) => {
    if (draggedItemIndex.current !== null && draggedItemIndex.current !== index) {
      dragOverItemIndex.current = index;
    }
  };

  const handleDrop = () => {
    if (draggedItemIndex.current === null || dragOverItemIndex.current === null || draggedItemIndex.current === dragOverItemIndex.current) {
        return;
    }
    
    const newVisits = [...recentVisits];
    const draggedItem = newVisits.splice(draggedItemIndex.current, 1)[0];
    newVisits.splice(dragOverItemIndex.current, 0, draggedItem);
    
    setRecentVisits(newVisits);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
    if (e.target instanceof HTMLElement) {
        e.target.classList.remove('opacity-50');
    }
    draggedItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const getMonthlyVisitCounts = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let doctorVisits = 0;
    let pharmacyVisits = 0;

    recentVisits.forEach(visit => {
        const visitDate = new Date(visit.date);
        if (visitDate >= startOfMonth && visitDate <= today) {
            if (visit.type === 'زيارة طبيب') {
                doctorVisits++;
            } else if (visit.type === 'زيارة صيدلية') {
                pharmacyVisits++;
            }
        }
    });

    return { doctorVisits, pharmacyVisits };
  };

  const getDailyVisitCounts = () => {
    const todayStr = new Date().toDateString();
    
    let doctorVisits = 0;
    let pharmacyVisits = 0;

    recentVisits.forEach(visit => {
        const visitDateStr = new Date(visit.date).toDateString();
        if (visitDateStr === todayStr) {
            if (visit.type === 'زيارة طبيب') {
                doctorVisits++;
            } else if (visit.type === 'زيارة صيدلية') {
                pharmacyVisits++;
            }
        }
    });

    return { doctorVisits, pharmacyVisits };
  };

  const getPlanStatusBadge = () => {
      if (!plan) return null;

      const statusMap = {
          draft: { text: 'مسودة', color: 'bg-blue-100 text-blue-800' },
          pending: { text: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' },
          approved: { text: 'معتمدة', color: 'bg-green-100 text-green-800' },
          rejected: { text: 'مرفوضة', color: 'bg-red-100 text-red-800' },
      };

      const { text, color } = statusMap[plan.status];
      return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${color}`}>{text}</span>;
  };

  if (loading) {
    return <div className="text-center p-8">جاري تحميل البيانات...</div>;
  }
  
  if (!user) {
    return null;
  }

  if (view === 'search') {
    return <ClientSearch user={user} onBack={() => setView('dashboard')} />;
  }
  
  if (view === 'weekly') {
    return <WeeklyView 
            user={user} 
            visits={recentVisits} 
            settings={systemSettings} 
            plan={plan?.plan ?? null}
            regions={regions}
            onBack={() => setView('dashboard')} 
        />;
  }

  if (view === 'plan') {
    return <PlanEditor 
        user={user}
        regions={regions}
        initialPlan={plan}
        onPlanSaved={(newPlan) => {
            setPlan(newPlan);
            setView('dashboard');
        }}
        onBack={() => setView('dashboard')}
    />;
  }
  
  const monthlyCounts = getMonthlyVisitCounts();
  const dailyCounts = getDailyVisitCounts();
  const totalDailyCount = dailyCounts.doctorVisits + dailyCounts.pharmacyVisits;
  const dailyTarget = 12; // An arbitrary target for visual effect
  const dailyProgress = Math.min((totalDailyCount / dailyTarget) * 100, 100);

  return (
    <div className="container mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-blue-800">لوحة تحكم المندوب</h2>
        <div className="flex gap-2 sm:gap-4 flex-wrap justify-center items-start">
          <button 
            onClick={() => setView('search')}
            className="bg-blue-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <SearchIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">بحث عن عميل</span>
          </button>
          <div className="flex flex-col items-center">
            <button 
              onClick={handleWeeklyPlanClick}
              className="bg-purple-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <CalendarIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">الخطة الأسبوعية</span>
            </button>
            {plan && <div className="mt-2">{getPlanStatusBadge()}</div>}
          </div>
          <button 
            onClick={handleExportClients}
            className="bg-green-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <DownloadIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">تحميل القائمة</span>
          </button>
          <button 
            onClick={() => {
              const todayIndex = new Date().getDay();
              const todayRegionId = plan?.plan[todayIndex] ?? null;
              setInitialRegionForVisit(todayRegionId);
              setIsModalOpen(true);
            }}
            className="bg-orange-500 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            تسجيل زيارة جديدة
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {/* Monthly Visits Card */}
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
            <div className="flex items-center mb-4">
                <div className="bg-blue-500/20 text-blue-700 p-3 rounded-full me-3">
                    <CalendarIcon className="w-6 h-6" />
                </div>
                <p className="text-slate-600 text-md font-medium">زيارات هذا الشهر</p>
            </div>
            <div className="flex justify-around items-center text-center">
                <div>
                    <p className="text-4xl font-bold text-blue-800">{monthlyCounts.doctorVisits}</p>
                    <p className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1">
                      <DoctorIcon className="w-4 h-4 text-blue-600"/>
                      <span>Dr</span>
                    </p>
                </div>
                <div className="h-12 w-px bg-slate-300"></div> {/* Divider */}
                <div>
                    <p className="text-4xl font-bold text-orange-800">{monthlyCounts.pharmacyVisits}</p>
                    <p className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1">
                      <PharmacyIcon className="w-4 h-4 text-orange-600"/>
                      <span>PH</span>
                    </p>
                </div>
            </div>
        </div>
        
        {/* Daily Visits Card */}
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center mb-4">
                <div className="bg-green-500/20 text-green-700 p-3 rounded-full me-3">
                    <ChartBarIcon className="w-6 h-6" />
                </div>
                <p className="text-slate-600 text-md font-medium">زيارات اليوم</p>
            </div>
            <div className="flex justify-around items-center text-center">
                <div>
                    <p className="text-4xl font-bold text-blue-800">{dailyCounts.doctorVisits}</p>
                    <p className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1">
                      <DoctorIcon className="w-4 h-4 text-blue-600"/>
                      <span>Dr</span>
                    </p>
                </div>
                <div className="h-12 w-px bg-slate-300"></div> {/* Divider */}
                <div>
                    <p className="text-4xl font-bold text-orange-800">{dailyCounts.pharmacyVisits}</p>
                    <p className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-1">
                      <PharmacyIcon className="w-4 h-4 text-orange-600"/>
                      <span>PH</span>
                    </p>
                </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-200/70 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-green-400 to-emerald-600 h-2.5 rounded-full" style={{ width: `${dailyProgress}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 text-center mt-1">
                {totalDailyCount < dailyTarget ? `استمر في التقدم نحو هدفك!` : `رائع! لقد حققت هدفك اليومي.`}
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-8">
          <div className="bg-red-100/60 border-t-4 border-red-500 rounded-b text-red-900 px-4 py-3 shadow-md backdrop-blur-lg" role="alert">
            <div className="flex items-start">
              <div className="py-1"><WarningIcon className="h-6 w-6 text-red-500 me-4 flex-shrink-0"/></div>
              <div>
                <p className="font-bold text-lg">تنبيهات الزيارات المتأخرة ({alerts.length})</p>
                <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                    {alerts.map(alert => (
                        <li key={alert.id}>
                            <span className="font-semibold">{alert.name}</span>
                            {alert.daysSinceLastVisit === null 
                                ? ' (لم تتم زيارته من قبل)'
                                : ` (لم تتم زيارته منذ ${alert.daysSinceLastVisit} أيام)`
                            }
                        </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Lists Toggle Button - NEW LOCATION */}
      <div className="flex justify-center mb-8">
        <button 
          onClick={() => setShowClientLists(!showClientLists)}
          className="bg-teal-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          aria-expanded={showClientLists}
        >
          <UserGroupIcon className="w-5 h-5"/>
          <span>{showClientLists ? 'إخفاء قائمة العملاء' : 'عرض قائمة العملاء'}</span>
        </button>
      </div>


      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showClientLists ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Doctors List */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-blue-700">
              <DoctorIcon className="w-6 h-6 me-2" />
              قائمة الأطباء
            </h3>
            <ul className="space-y-3 max-h-96 overflow-y-auto ps-2">
              {doctors.map((doctor) => (
                <li key={doctor.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                  <span>{doctor.name}</span>
                  <span className="text-xs bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-full">{doctor.specialization}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pharmacies List */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-orange-700">
              <PharmacyIcon className="w-6 h-6 me-2" />
              قائمة الصيدليات
            </h3>
            <ul className="space-y-3 max-h-96 overflow-y-auto ps-2">
              {pharmacies.map((pharmacy) => (
                <li key={pharmacy.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                  <span>{pharmacy.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Recent Visits History */}
      <div className="mt-8">
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
          <h3 className="text-xl font-semibold mb-4 flex items-center text-blue-700">
            سجل الزيارات الأخيرة
          </h3>
          <div className="max-h-96 overflow-y-auto ps-2">
            {recentVisits.length > 0 ? (
              <ul 
                className="space-y-3"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {recentVisits.map((visit, index) => (
                  <li 
                    key={visit.id} 
                    className="p-4 bg-white/30 rounded-lg hover:bg-white/50 transition-all duration-300 cursor-move"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        {visit.type === 'زيارة طبيب' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3 flex-shrink-0" /> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3 flex-shrink-0" />}
                        <div>
                          <p className="font-bold text-slate-800 flex items-center flex-wrap">
                            {visit.targetName}
                            {visit.targetSpecialization && (
                               <span className="text-xs bg-gray-200 text-gray-700 font-medium px-2 py-0.5 rounded-full ms-2">{visit.targetSpecialization}</span>
                            )}
                             {visit.visitType && (
                                <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full ms-2">{visit.visitType === 'Coaching' ? 'كوتشينج' : 'سينجل'}</span>
                             )}
                          </p>
                          <p className="text-xs text-slate-600">{new Date(visit.date).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${visit.type === 'زيارة طبيب' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{visit.type}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 ps-9">{visit.notes}</p>
                    {visit.productName && (
                      <p className="mt-1 text-xs text-slate-600 ps-9">
                        <span className="font-semibold">المنتجات:</span> {visit.productName}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-slate-600 py-8 text-lg">لا توجد زيارات مسجلة بعد.</p>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && user && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          title="تسجيل زيارة جديدة"
        >
          <VisitForm 
              user={user} 
              products={products}
              doctors={doctors}
              pharmacies={pharmacies}
              regions={regions}
              initialRegionId={initialRegionForVisit}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsModalOpen(false)}
            />
        </Modal>
      )}
    </div>
  );
};

export default RepDashboard;