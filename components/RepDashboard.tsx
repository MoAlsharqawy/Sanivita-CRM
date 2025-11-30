
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { Doctor, Pharmacy, Product, VisitReport, Region, ClientAlert, SystemSettings, WeeklyPlan, RepTask } from '../types';
import { 
    DoctorIcon, PharmacyIcon, CalendarIcon, SearchIcon, WarningIcon, 
    UserGroupIcon, DownloadIcon, ChartBarIcon, GraphIcon, CalendarPlusIcon, 
    ClipboardCheckIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, MapPinIcon 
} from './icons';
import Modal from './Modal';
import VisitForm from './VisitForm';
import ClientSearch from './ClientSearch';
import { exportClientsToExcel, exportToExcel } from '../services/exportService';
import WeeklyView from './WeeklyView';
import PlanEditor from './PlanEditor';
import Spinner from './Spinner';
import FrequencyDetailModal from './FrequencyDetailModal';

const RepDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitReport[]>([]);
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [pendingTasks, setPendingTasks] = useState<RepTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'search' | 'weekly' | 'plan'>('dashboard');
  const [showClientLists, setShowClientLists] = useState(false);
  const [initialRegionForVisit, setInitialRegionForVisit] = useState<number | null>(null);

  // Overdue Alerts View State
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // Frequency Modal State
  const [isFrequencyDetailModalOpen, setIsFrequencyDetailModalOpen] = useState(false);
  const [selectedFrequencyDetails, setSelectedFrequencyDetails] = useState<{
      title: string;
      doctors: { name: string; region: string; specialization: string; visits: number }[];
      repName: string;
      frequencyLabel: string;
  } | null>(null);

  // Calculate Planning Time Logic
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
  const isPlanningTime = dayOfWeek === 4 || dayOfWeek === 5; // Thursday (4) or Friday (5)

  const planStartDate = useMemo(() => {
      const d = new Date();
      const currentDay = d.getDay();
      
      if (isPlanningTime) {
          const daysUntilNextSaturday = (6 - currentDay + 7) % 7;
          d.setDate(d.getDate() + (daysUntilNextSaturday === 0 ? 7 : daysUntilNextSaturday));
      } else {
          const daysSinceSaturday = (currentDay + 1) % 7;
          d.setDate(d.getDate() - daysSinceSaturday);
      }
      return d;
  }, [isPlanningTime]);


  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [doctorsData, pharmaciesData, productsData, visitsData, regionsData, overdueData, settingsData, planData, tasksData] = await Promise.all([
        api.getDoctorsForRep(user.id),
        api.getPharmaciesForRep(user.id),
        api.getProducts(),
        api.getVisitReportsForRep(user.id),
        api.getRegionsForRep(user.id),
        api.getOverdueVisits(),
        api.getSystemSettings(),
        api.getRepPlan(user.id),
        api.getPendingTasksForRep(user.id)
      ]);
      setDoctors(doctorsData);
      setPharmacies(pharmaciesData);
      setProducts(productsData);
      setRecentVisits(visitsData);
      setRegions(regionsData);
      
      // Filter overdue alerts for this specific rep using robust string comparison
      const userAlerts = overdueData.filter(a => String(a.repId) === String(user.id));
      setAlerts(userAlerts);

      setSystemSettings(settingsData);
      setPlan(planData);
      setPendingTasks(tasksData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getGreeting = useCallback(() => {
    if (!user) return '';
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning', user.name);
    if (hour < 18) return t('good_afternoon', user.name);
    return t('good_evening', user.name);
  }, [t, user]);
  
  const handleFormSuccess = () => {
    setIsModalOpen(false);
    fetchData(); 
  }

  const handleExportClients = () => {
    if (user) {
      exportClientsToExcel(doctors, pharmacies, regions, `clients_${user.username}`, t);
    }
  };
  
  const handleWeeklyPlanClick = () => {
    const canEdit = (!plan || plan.status !== 'approved') || isPlanningTime;

    if (canEdit) {
        setView('plan');
    } else {
        setView('weekly');
    }
  };

  const handleExportVisitsClick = () => {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setExportStartDate(firstDay.toISOString().split('T')[0]);
      setExportEndDate(today.toISOString().split('T')[0]);
      setIsExportModalOpen(true);
  };

  const handleConfirmExportVisits = () => {
      if (!user) return;
      
      const start = new Date(exportStartDate);
      const end = new Date(exportEndDate);
      end.setDate(end.getDate() + 1);

      const filteredVisits = recentVisits.filter(v => {
          const vDate = new Date(v.date);
          return vDate >= start && vDate < end;
      });

      exportToExcel(filteredVisits, `visits_${user.username}_${exportStartDate}_to_${exportEndDate}`, t);
      setIsExportModalOpen(false);
  };

  const handleTaskComplete = async (taskId: string) => {
      try {
          await api.completeTask(taskId);
          setPendingTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
          console.error("Failed to complete task", error);
      }
  };

  const handleFrequencyClick = (freqType: 'f1' | 'f2' | 'f3') => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const visitCounts: Record<string, { count: number, region: string, specialization: string }> = {};

      // Filter reports for this month & doctors only
      const reports = recentVisits.filter(visit => {
          const visitDate = new Date(visit.date);
          return visitDate >= startOfMonth && visitDate <= today && visit.type === 'DOCTOR_VISIT';
      });

      // Count visits per doctor
      reports.forEach(visit => {
          const key = visit.targetName;
          if (!visitCounts[key]) {
              // Try to find region/specialization from visit or fallback to empty
              visitCounts[key] = { 
                  count: 0, 
                  region: visit.regionName, 
                  specialization: visit.targetSpecialization || '' 
              };
          }
          visitCounts[key].count++;
      });

      // Filter based on frequency type
      const filteredDoctors = Object.entries(visitCounts)
          .filter(([_, data]) => {
              if (freqType === 'f1') return data.count === 1;
              if (freqType === 'f2') return data.count === 2;
              if (freqType === 'f3') return data.count >= 3;
              return false;
          })
          .map(([name, data]) => ({
              name,
              region: data.region,
              specialization: data.specialization,
              visits: data.count
          }));
      
      let freqLabel = '';
      if (freqType === 'f1') freqLabel = t('freq_1_mo');
      else if (freqType === 'f2') freqLabel = t('freq_2_mo');
      else freqLabel = t('freq_3_mo');

      setSelectedFrequencyDetails({
          title: t('frequency_details_title', user?.name || '', freqLabel),
          doctors: filteredDoctors,
          repName: user?.name || '',
          frequencyLabel: freqLabel
      });
      setIsFrequencyDetailModalOpen(true);
  };
  
  const displayVisits = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      return recentVisits.filter(visit => {
          const visitDate = new Date(visit.date);
          visitDate.setHours(0, 0, 0, 0);
          return visitDate.getTime() >= yesterday.getTime();
      });
  }, [recentVisits]);


  const monthlyCounts = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let doctorVisits = 0;
    let pharmacyVisits = 0;
    const workingDays = new Set<string>();

    recentVisits.forEach(visit => {
        const visitDate = new Date(visit.date);
        if (visitDate >= startOfMonth && visitDate <= today) {
            const dateStr = visitDate.toISOString().split('T')[0];
            workingDays.add(dateStr);
            if (visit.type === 'DOCTOR_VISIT') {
                doctorVisits++;
            } else if (visit.type === 'PHARMACY_VISIT') {
                pharmacyVisits++;
            }
        }
    });

    const totalMonthlyVisits = doctorVisits + pharmacyVisits;
    const numberOfWorkingDays = workingDays.size;
    const visitsPerWorkingDay = numberOfWorkingDays > 0 ? (totalMonthlyVisits / numberOfWorkingDays) : 0;


    return { doctorVisits, pharmacyVisits, visitsPerWorkingDay };
  }, [recentVisits]);

  const dailyCounts = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    let doctorVisits = 0;
    let pharmacyVisits = 0;

    recentVisits.forEach(visit => {
        const visitDateStr = new Date(visit.date).toDateString();
        if (visitDateStr === todayStr) {
            if (visit.type === 'DOCTOR_VISIT') {
                doctorVisits++;
            } else if (visit.type === 'PHARMACY_VISIT') {
                pharmacyVisits++;
            }
        }
    });

    return { doctorVisits, pharmacyVisits };
  }, [recentVisits]);

  const getPlanStatusBadge = () => {
      if (!plan) return null;

      const statusMap = {
          draft: { textKey: 'plan_status_draft', color: 'bg-blue-100 text-blue-800' },
          pending: { textKey: 'plan_status_pending', color: 'bg-yellow-100 text-yellow-800' },
          approved: { textKey: 'plan_status_approved', color: 'bg-green-100 text-green-800' },
          rejected: { textKey: 'plan_status_rejected', color: 'bg-red-100 text-red-800' },
      };

      const { textKey, color } = statusMap[plan.status];
      return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${color}`}>{t(textKey)}</span>;
  };

  const doctorNameToIdMap = useMemo(() => new Map(doctors.map(d => [d.name, d.id])), [doctors]);

  const pendingDoctorsForToday = useMemo(() => {
      if (!plan || !plan.plan) return [];

      const todayStr = new Date().toDateString();
      const todayIndex = new Date().getDay();
      
      const todaysDoctorIds = plan.plan[todayIndex]?.doctorIds || [];
      if (todaysDoctorIds.length === 0) return [];

      const visitedDoctorIds = new Set(
          recentVisits
              .filter(v => new Date(v.date).toDateString() === todayStr && v.type === 'DOCTOR_VISIT')
              .map(v => doctorNameToIdMap.get(v.targetName))
              .filter((id): id is number => id !== undefined)
      );

      const pendingDoctorIds = todaysDoctorIds.filter(id => !visitedDoctorIds.has(id));
      
      return doctors.filter(d => pendingDoctorIds.includes(d.id));
  }, [plan, recentVisits, doctors, doctorNameToIdMap]);

  const visitFrequency = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const visitCounts: Record<string, number> = {};
    
    recentVisits.forEach(visit => {
        const visitDate = new Date(visit.date);
        if (visitDate >= startOfMonth && visitDate <= today && visit.type === 'DOCTOR_VISIT') {
            const key = visit.targetName;
            visitCounts[key] = (visitCounts[key] || 0) + 1;
        }
    });

    let freq1 = 0;
    let freq2 = 0;
    let freq3 = 0;

    Object.values(visitCounts).forEach(count => {
        if (count === 1) freq1++;
        else if (count === 2) freq2++;
        else if (count >= 3) freq3++;
    });

    return { freq1, freq2, freq3 };
  }, [recentVisits]);

  const specializationCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      doctors.forEach(d => {
          const spec = d.specialization;
          if (spec) {
              counts[spec] = (counts[spec] || 0) + 1;
          }
      });
      return counts;
  }, [doctors]);

  const regionMap = useMemo(() => new Map(regions.map(r => [r.id, r.name])), [regions]);

  if (loading) {
    return <Spinner />;
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
        startDate={planStartDate}
        onPlanSaved={(newPlan) => {
            setPlan(newPlan);
            setView('dashboard');
        }}
        onBack={() => setView('dashboard')}
    />;
  }
  
  const totalDailyCount = dailyCounts.doctorVisits + dailyCounts.pharmacyVisits;
  const dailyTarget = 12;
  const dailyProgress = Math.min((totalDailyCount / dailyTarget) * 100, 100);

  return (
    <div className="container mx-auto">
       {/* Tasks Alert Section */}
       {pendingTasks.length > 0 && (
           <div className="mb-6 animate-fade-in bg-gradient-to-r from-pink-600 to-rose-600 rounded-xl p-6 shadow-xl text-white border border-white/20">
               <div className="flex items-start gap-3 mb-4">
                   <div className="bg-white/20 p-2 rounded-full">
                        <ClipboardCheckIcon className="w-8 h-8 text-white" />
                   </div>
                   <div>
                       <h3 className="font-bold text-xl">{t('you_have_pending_tasks')}</h3>
                       <p className="text-sm opacity-90">{t('pending_tasks_alert')}</p>
                   </div>
               </div>
               <div className="space-y-3">
                   {pendingTasks.map(task => (
                       <div key={task.id} className="bg-white/10 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                           <p className="font-medium text-lg">{task.description}</p>
                           <button 
                               onClick={() => handleTaskComplete(task.id)}
                               className="bg-white text-rose-600 hover:bg-rose-50 font-bold py-1.5 px-4 rounded-full text-sm transition-colors flex items-center gap-2 shadow-sm"
                           >
                               <CheckCircleIcon className="w-5 h-5" />
                               {t('mark_done')}
                           </button>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {/* Overdue Alerts Section - Prominently Displayed */}
       {alerts.length > 0 && (
        <div className="mb-8 animate-fade-in-up">
          <div className="bg-gradient-to-br from-red-50 to-red-100 border-s-4 border-red-500 rounded-lg text-red-900 shadow-md backdrop-blur-lg overflow-hidden transition-all hover:shadow-xl">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-start">
                <div className="py-1 bg-white/60 p-2 rounded-full me-4 shadow-sm animate-pulse">
                    <WarningIcon className="h-6 w-6 text-red-600 flex-shrink-0"/>
                </div>
                <div>
                  <p className="font-bold text-lg text-red-800">{t('overdue_visits_alert', alerts.length)}</p>
                  <p className="text-sm text-red-700 opacity-90">{t('overdue_visits_description')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
                className="flex items-center gap-1 text-sm font-bold text-red-700 hover:text-red-900 bg-white/60 px-4 py-2 rounded-lg border border-red-200 hover:bg-white transition-all whitespace-nowrap self-end sm:self-auto shadow-sm"
              >
                {isAlertsExpanded ? (
                    <>
                        {t('less_details')}
                        <ChevronUpIcon className="w-4 h-4" />
                    </>
                ) : (
                    <>
                        {t('view_details')}
                        <ChevronDownIcon className="w-4 h-4" />
                    </>
                )}
              </button>
            </div>
            
            {/* Expandable Content */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isAlertsExpanded ? 'max-h-[500px] opacity-100 border-t border-red-200/50' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 bg-white/30">
                    <ul className="space-y-2 max-h-60 overflow-y-auto pe-2">
                        {alerts.map(alert => (
                            <li key={alert.id} className="flex justify-between items-center p-3 bg-white/80 rounded-lg shadow-sm hover:bg-white transition-colors border border-red-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        {alert.type === 'doctor' ? <DoctorIcon className="w-4 h-4 text-blue-600"/> : <PharmacyIcon className="w-4 h-4 text-orange-600"/>}
                                        <span className="font-semibold text-slate-800">{alert.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 ms-6 text-xs text-slate-600">
                                         <MapPinIcon className="w-3 h-3 text-slate-400" />
                                         <span>{t('region')}:</span>
                                         <span className="font-medium">
                                             {/* Robust region display */}
                                             {(alert.regionName && !isNaN(parseInt(alert.regionName)) 
                                                ? regionMap.get(parseInt(alert.regionName)) 
                                                : alert.regionName) || t('unknown')}
                                         </span>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-200 flex items-center gap-1">
                                    <WarningIcon className="w-3 h-3" />
                                    {alert.daysSinceLastVisit === null 
                                        ? t('never_visited')
                                        : t('days_ago', alert.daysSinceLastVisit)
                                    }
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
          </div>
        </div>
      )}

       {/* Planning Motivation Banner */}
      {isPlanningTime && (
        <div className="mb-6 animate-fade-in bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 shadow-xl text-white flex items-center justify-between border border-white/20">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                     <CalendarPlusIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="font-bold text-lg">{t('planning_time_message')}</p>
                    <p className="text-sm opacity-90">{t('planning_for_week_starting', planStartDate.toLocaleDateString(t('locale')))}</p>
                </div>
            </div>
            <button 
                onClick={handleWeeklyPlanClick}
                className="bg-white text-purple-700 font-bold py-2 px-4 rounded-lg shadow hover:bg-gray-100 transition-all text-sm whitespace-nowrap"
            >
                {t('create_next_week_plan')}
            </button>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-blue-800">{getGreeting()}</h2>
        <div className="flex gap-2 sm:gap-4 flex-wrap justify-center items-start">
          <button 
            onClick={() => setView('search')}
            className="bg-blue-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <SearchIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">{t('search_client')}</span>
          </button>
          <div className="flex flex-col items-center">
            <button 
              onClick={handleWeeklyPlanClick}
              className={`text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 ${isPlanningTime ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              <CalendarIcon className="w-5 h-5"/>
              <span className="hidden sm:inline">{t(isPlanningTime ? 'create_next_week_plan' : 'weekly_plan')}</span>
            </button>
            {plan && !isPlanningTime && <div className="mt-2">{getPlanStatusBadge()}</div>}
          </div>
          <button 
            onClick={handleExportClients}
            className="bg-green-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <DownloadIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">{t('download_list')}</span>
          </button>
          <button 
            onClick={handleExportVisitsClick}
            className="bg-teal-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <DownloadIcon className="w-5 h-5"/>
            <span className="hidden sm:inline">{t('export_visits')}</span>
          </button>
          <button 
            onClick={() => {
              const todayIndex = new Date().getDay();
              const todayPlanForDay = plan?.plan[todayIndex] ?? null;
              setInitialRegionForVisit(todayPlanForDay?.regionId ?? null);
              setIsModalOpen(true);
            }}
            className="bg-orange-500 text-white font-bold py-2 px-4 sm:px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {t('new_visit_registration')}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Monthly Visits Card */}
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 animate-fade-in-up">
            <div className="flex items-center mb-4">
                <div className="bg-blue-500/20 text-blue-700 p-3 rounded-full me-3">
                    <CalendarIcon className="w-6 h-6" />
                </div>
                <p className="text-slate-600 text-md font-medium">{t('visits_this_month')}</p>
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
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex flex-col justify-between animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div>
            <div className="flex items-center mb-4">
                <div className="bg-green-500/20 text-green-700 p-3 rounded-full me-3">
                    <ChartBarIcon className="w-6 h-6" />
                </div>
                <p className="text-slate-600 text-md font-medium">{t('visits_today')}</p>
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
                {t(totalDailyCount < dailyTarget ? 'keep_progressing' : 'daily_goal_achieved')}
            </p>
          </div>
        </div>

        {/* Visits Frequency Card */}
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex flex-col justify-between animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <div>
                <div className="flex items-center mb-4">
                    <div className="bg-indigo-500/20 text-indigo-700 p-3 rounded-full me-3">
                        <GraphIcon className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 text-md font-medium">{t('visit_frequency_monthly')}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center">
                         <button 
                            onClick={() => handleFrequencyClick('f1')} 
                            className="text-2xl font-bold text-slate-800 hover:text-blue-600 hover:underline transition-all"
                         >
                            {visitFrequency.freq1}
                         </button>
                         <p className="text-xs text-slate-600 font-semibold">{t('freq_1_mo')}</p>
                    </div>
                    <div className="flex flex-col items-center border-x border-slate-300/50">
                         <button 
                            onClick={() => handleFrequencyClick('f2')} 
                            className="text-2xl font-bold text-blue-800 hover:text-blue-600 hover:underline transition-all"
                         >
                            {visitFrequency.freq2}
                         </button>
                         <p className="text-xs text-slate-600 font-semibold">{t('freq_2_mo')}</p>
                    </div>
                    <div className="flex flex-col items-center">
                         <button 
                            onClick={() => handleFrequencyClick('f3')} 
                            className="text-2xl font-bold text-green-800 hover:text-green-600 hover:underline transition-all"
                         >
                            {visitFrequency.freq3}
                         </button>
                         <p className="text-xs text-slate-600 font-semibold">{t('freq_3_mo')}</p>
                    </div>
                </div>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-4">{t('doctors_visits_count_info')}</p>
        </div>

        {/* Visits per Working Day Card */}
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex flex-col justify-between animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div>
                <div className="flex items-center mb-4">
                    <div className="bg-purple-500/20 text-purple-700 p-3 rounded-full me-3">
                        <ChartBarIcon className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 text-md font-medium">{t('visits_per_working_day')}</p>
                </div>
                <div className="flex justify-center items-center text-center py-2">
                    <p className="text-5xl font-bold text-purple-800">{monthlyCounts.visitsPerWorkingDay.toFixed(1)}</p>
                    <p className="text-md font-semibold text-slate-700 ms-2">{t('visit_per_day_label')}</p>
                </div>
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">{t('visits_per_working_day_info')}</p>
        </div>
      </div>

      {/* Client Lists Toggle & Summary Section */}
      <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-8">
        {/* Doctors Stats Card */}
        <div className="bg-white/40 backdrop-blur-lg px-5 py-2 rounded-lg shadow-lg border border-white/50 flex items-center gap-6 animate-fade-in-up">
            <div className="flex items-center gap-3 border-r border-slate-300/50 pr-5 rtl:border-r-0 rtl:border-l rtl:pr-0 rtl:pl-5">
                <div className="bg-blue-100 p-1.5 rounded-full text-blue-600">
                    <DoctorIcon className="w-5 h-5" />
                </div>
                <div>
                    <span className="block text-xl font-bold text-blue-800 leading-none">{doctors.length}</span>
                    <span className="text-[10px] text-slate-600 font-bold uppercase">{t('doctors')}</span>
                </div>
            </div>
            <div className="flex items-center gap-6">
                {Object.entries(specializationCounts).map(([spec, count]) => (
                <div key={spec} className="flex flex-col items-center">
                    <span className="text-lg font-bold text-slate-700 leading-none">{count}</span>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{t(spec)}</span>
                </div>
                ))}
            </div>
        </div>

        <button 
          onClick={() => setShowClientLists(!showClientLists)}
          className="bg-teal-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2 h-[54px]"
          aria-expanded={showClientLists}
        >
          <UserGroupIcon className="w-5 h-5"/>
          <span>{t(showClientLists ? 'hide_client_list' : 'show_client_list')}</span>
        </button>
      </div>


      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${showClientLists ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Doctors List */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-blue-700">
              <DoctorIcon className="w-6 h-6 me-2" />
              {t('doctors_list')}
            </h3>
            <ul className="space-y-3 max-h-96 overflow-y-auto ps-2">
              {doctors.map((doctor) => (
                <li key={doctor.id} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                  <span>{doctor.name}</span>
                  <span className="text-xs bg-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-full">{t(doctor.specialization)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pharmacies List */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
            <h3 className="text-xl font-semibold mb-4 flex items-center text-orange-700">
              <PharmacyIcon className="w-6 h-6 me-2" />
              {t('pharmacies_list')}
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
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold flex items-center text-blue-700">
                {t('recent_visits_log')}
              </h3>
              <span className="text-xs text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                {t('show_today_yesterday_only')}
              </span>
          </div>
          <div className="max-h-96 overflow-y-auto ps-2">
            {displayVisits.length > 0 ? (
              <ul 
                className="space-y-3"
              >
                {displayVisits.map((visit, index) => {
                  const visitDate = new Date(visit.date);
                  const today = new Date();
                  const isToday = visitDate.toDateString() === today.toDateString();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const isYesterday = visitDate.toDateString() === yesterday.toDateString();

                  return (
                  <li 
                    key={visit.id} 
                    className={`p-4 bg-white/30 rounded-lg hover:bg-white/50 transition-all duration-300 animate-fade-in-up`}
                    style={{ animationDelay: `${Math.min(index * 100, 1000)}ms` }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        {visit.type === 'DOCTOR_VISIT' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3 flex-shrink-0" /> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3 flex-shrink-0" />}
                        <div>
                          <p className="font-bold text-slate-800 flex items-center flex-wrap">
                            {visit.targetName}
                            {visit.targetSpecialization && (
                               <span className="text-xs bg-gray-200 text-gray-700 font-medium px-2 py-0.5 rounded-full ms-2">{t(visit.targetSpecialization)}</span>
                            )}
                             {visit.visitType && (
                                <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full ms-2">{t(visit.visitType)}</span>
                             )}
                          </p>
                          <p className="text-xs text-slate-600 flex items-center gap-2">
                              {new Date(visit.date).toLocaleString(t('locale'), { dateStyle: 'medium', timeStyle: 'short' })}
                              {isToday && <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded">{t('today')}</span>}
                              {isYesterday && <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded">{t('yesterday')}</span>}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${visit.type === 'DOCTOR_VISIT' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{t(visit.type)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 ps-9">{visit.notes}</p>
                    {visit.productName && (
                      <p className="mt-1 text-xs text-slate-600 ps-9">
                        <span className="font-semibold">{t('products_label')}</span> {visit.productName}
                      </p>
                    )}
                  </li>
                )})}
              </ul>
            ) : (
              <p className="text-center text-slate-600 py-8 text-lg">{t('no_visits_yet')}</p>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && user && (
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          title={t('new_visit_registration')}
        >
          <VisitForm 
              user={user} 
              products={products}
              doctors={doctors}
              pharmacies={pharmacies}
              regions={regions}
              initialRegionId={initialRegionForVisit}
              pendingDoctorsForToday={pendingDoctorsForToday}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsModalOpen(false)}
            />
        </Modal>
      )}

      {isExportModalOpen && (
          <Modal
              isOpen={isExportModalOpen}
              onClose={() => setIsExportModalOpen(false)}
              title={t('select_date_range')}
          >
              <div className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1">{t('from_date')}</label>
                      <input
                          type="date"
                          value={exportStartDate}
                          onChange={(e) => setExportStartDate(e.target.value)}
                          className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1">{t('to_date')}</label>
                      <input
                          type="date"
                          value={exportEndDate}
                          onChange={(e) => setExportEndDate(e.target.value)}
                          className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                  </div>
                  <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                      <button
                          onClick={() => setIsExportModalOpen(false)}
                          className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors"
                      >
                          {t('cancel')}
                      </button>
                      <button
                          onClick={handleConfirmExportVisits}
                          disabled={!exportStartDate || !exportEndDate}
                          className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 disabled:bg-blue-300 transition-colors flex items-center gap-2"
                      >
                          <DownloadIcon className="w-4 h-4" />
                          {t('export')}
                      </button>
                  </div>
              </div>
          </Modal>
      )}

      {/* NEW: Frequency Detail Modal */}
      {selectedFrequencyDetails && (
        <FrequencyDetailModal
          isOpen={isFrequencyDetailModalOpen}
          onClose={() => setIsFrequencyDetailModalOpen(false)}
          title={selectedFrequencyDetails.title}
          doctors={selectedFrequencyDetails.doctors}
          repName={selectedFrequencyDetails.repName}
          frequencyLabel={selectedFrequencyDetails.frequencyLabel}
        />
      )}
    </div>
  );
};

export default RepDashboard;
