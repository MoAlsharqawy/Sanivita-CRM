
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { User, VisitReport, WeeklyPlan, SystemSettings, RepAbsence, UserRole, Region, Doctor, Pharmacy } from '../types';
import Spinner from './Spinner';
import { 
    UserGroupIcon, ChartBarIcon, ClipboardCheckIcon, CogIcon, 
    CalendarIcon, DownloadIcon, PlusIcon, TrashIcon, EditIcon, 
    MapPinIcon, SearchIcon, CheckCircleIcon, XIcon, WarningIcon,
    SunIcon, CheckIcon
} from './icons';
import AnalyticsCharts from './AnalyticsCharts';
import UserEditModal from './UserEditModal';
import UserRegionsModal from './UserRegionsModal';
import DailyVisitsDetailModal from './DailyVisitsDetailModal';
import AbsentDetailsModal from './AbsentDetailsModal';
import Modal from './Modal';
import DataImport from './DataImport';
import { exportVacationStatsToExcel, exportToExcel, exportUsersToExcel, exportMultipleRepClientsToExcel } from '../services/exportService';
import WeeklyView from './WeeklyView';

// Helper to format date
const toYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // Data States
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [plans, setPlans] = useState<{ [repId: string]: WeeklyPlan }>({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [absences, setAbsences] = useState<RepAbsence[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'users' | 'plans' | 'reports' | 'vacations' | 'settings' | 'import'>('overview');
  const [selectedRepId, setSelectedRepId] = useState<string | 'all'>('all');
  
  // Modals
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
  const [userForRegions, setUserForRegions] = useState<User | null>(null);
  const [isDailyVisitsModalOpen, setIsDailyVisitsModalOpen] = useState(false);
  
  // Vacation Stats State
  const [vacationMonth, setVacationMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [absentDetailsModalUser, setAbsentDetailsModalUser] = useState<{name: string, details: any[]} | null>(null);

  // Confirmation States
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({ isOpen: false, title: '', message: '', onConfirm: async () => {} });

  // Plan View State
  const [viewingPlanRepId, setViewingPlanRepId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, reportsData, plansData, settingsData, absencesData, regionsData, doctorsData, pharmaciesData] = await Promise.all([
        api.getUsers(),
        api.getAllVisitReports(),
        api.getAllPlans(),
        api.getSystemSettings(),
        api.getRepAbsences(),
        api.getRegions(),
        api.getAllDoctors(),
        api.getAllPharmacies()
      ]);

      setUsers(usersData);
      setReports(reportsData);
      setPlans(plansData);
      setSystemSettings(settingsData);
      setAbsences(absencesData);
      setRegions(regionsData);
      setDoctors(doctorsData);
      setPharmacies(pharmaciesData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived Data ---

  const reps = useMemo(() => users.filter(u => u.role === UserRole.Rep), [users]);
  
  const pendingPlans = useMemo(() => {
    return reps.filter(rep => {
      const plan = plans[rep.id];
      return plan && plan.status === 'pending';
    }).map(rep => ({ rep, plan: plans[rep.id] }));
  }, [reps, plans]);

  const filteredReports = useMemo(() => {
    if (selectedRepId === 'all') return reports;
    const repName = users.find(u => u.id === selectedRepId)?.name;
    return reports.filter(r => r.repName === repName);
  }, [reports, selectedRepId, users]);

  // --- Vacation Stats Calculation ---
  const vacationStats = useMemo(() => {
    if (!systemSettings) return [];
    
    const [yearStr, monthStr] = vacationMonth.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;

    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const today = new Date();
    // We only calculate up to today if looking at current month, else end of month
    const calculationEndDate = (today < monthEnd && today > monthStart) ? today : monthEnd;

    // Create a map of absences for O(1) lookup
    const approvedAbsenceMap = new Map<string, Map<string, RepAbsence>>();
    absences.forEach(abs => {
        if (abs.status === 'APPROVED') {
            if (!approvedAbsenceMap.has(abs.repId)) {
                approvedAbsenceMap.set(abs.repId, new Map());
            }
            approvedAbsenceMap.get(abs.repId)?.set(abs.date, abs);
        }
    });

    // Create a set of work days (days with at least one visit) per rep
    const workMap = new Set<string>();
    reports.forEach(r => {
        const d = new Date(r.date);
        const dateStr = toYYYYMMDD(d);
        const rep = users.find(u => u.name === r.repName);
        if (rep) {
            workMap.add(`${rep.id}-${dateStr}`);
        }
    });

    return reps.map(rep => {
        let totalWorkingDaysPassed = 0;
        let daysWorked = 0;
        const absentDetails: { id?: number; date: string; reason: string; isManual: boolean }[] = [];

        const current = new Date(monthStart);
        while (current <= calculationEndDate) {
            const dateStr = toYYYYMMDD(current);
            const dayIndex = current.getDay();

            const isWeekend = systemSettings.weekends.includes(dayIndex);
            const isHoliday = systemSettings.holidays.includes(dateStr);
            const approvedAbsence = approvedAbsenceMap.get(rep.id)?.get(dateStr);

            // Custom Rule: Thursday (4) is Meeting Day, Friday (5) is Holiday.
            // Exclude them from auto-absence calculation.
            const isExcludedDay = dayIndex === 4 || dayIndex === 5;

            if (approvedAbsence) {
                // Approved absence counts as an absence record regardless of work day status
                absentDetails.push({ 
                    id: approvedAbsence.id,
                    date: dateStr, 
                    reason: approvedAbsence.reason || t('manual_absence'),
                    isManual: true
                });
            } else if (!isWeekend && !isHoliday && !isExcludedDay) {
                totalWorkingDaysPassed++;
                
                const hasReport = workMap.has(`${rep.id}-${dateStr}`);
                if (hasReport) {
                    daysWorked++;
                } else {
                    // Mark as auto absent
                    absentDetails.push({
                        date: dateStr,
                        reason: t('auto_absence'),
                        isManual: false
                    });
                }
            }

            current.setDate(current.getDate() + 1);
        }

        return {
            repId: rep.id,
            repName: rep.name,
            repUsername: rep.username,
            totalWorkingDaysPassed,
            daysWorked,
            absentDays: absentDetails.length,
            absentDetailsList: absentDetails
        };
    });

  }, [vacationMonth, systemSettings, reps, absences, reports, users, t]);

  // --- Handlers ---

  const handleUserEdit = (user: User | null) => {
    setUserToEdit(user);
    setIsUserEditModalOpen(true);
  };

  const handleUserRegions = (user: User) => {
    setUserForRegions(user);
    setIsRegionsModalOpen(true);
  };

  const handleDeleteUser = (userToDelete: User) => {
    setConfirmAction({
      isOpen: true,
      title: t('confirm_delete_title'),
      message: t('confirm_delete_message', userToDelete.name),
      onConfirm: async () => {
        try {
          await api.deleteUser(userToDelete.id);
          fetchData();
        } catch (e) {
          console.error(e);
          alert(t('error_permission_denied_delete_user'));
        }
      }
    });
  };

  const handleResetRepData = (repToReset: User) => {
    setConfirmAction({
      isOpen: true,
      title: t('confirm_reset_title'),
      message: t('confirm_reset_message', repToReset.name),
      onConfirm: async () => {
        try {
          await api.resetRepData(repToReset.id);
          fetchData();
          alert(t('reset_success', repToReset.name));
        } catch (e) {
          console.error(e);
          alert(t('reset_error'));
        }
      }
    });
  };

  const handlePlanReview = async (repId: string, status: 'approved' | 'rejected') => {
    try {
      await api.reviewRepPlan(repId, status);
      const rep = users.find(u => u.id === repId);
      if (rep) {
        alert(status === 'approved' ? t('plan_approved_success', rep.name) : t('plan_rejected_success', rep.name));
      }
      fetchData();
    } catch (e) {
      console.error(e);
      alert(t('plan_review_error'));
    }
  };

  const handleRevokePlan = async (repId: string) => {
      try {
          await api.revokePlanApproval(repId);
          const rep = users.find(u => u.id === repId);
          if (rep) alert(t('plan_revoked_success', rep?.name));
          fetchData();
      } catch (e) {
          console.error(e);
          alert(t('plan_revoke_error'));
      }
  };

  const handleAddHoliday = async () => {
      const dateStr = prompt(t('add_holiday') + " (YYYY-MM-DD):");
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && systemSettings) {
          const newHolidays = [...systemSettings.holidays, dateStr];
          try {
              await api.updateSystemSettings({ ...systemSettings, holidays: newHolidays });
              setSystemSettings({ ...systemSettings, holidays: newHolidays });
          } catch (e) {
              console.error(e);
              alert(t('settings_saved_error'));
          }
      }
  };
  
  const handleRemoveHoliday = async (dateStr: string) => {
      if (systemSettings) {
          const newHolidays = systemSettings.holidays.filter(h => h !== dateStr);
          try {
              await api.updateSystemSettings({ ...systemSettings, holidays: newHolidays });
              setSystemSettings({ ...systemSettings, holidays: newHolidays });
          } catch (e) {
              console.error(e);
              alert(t('settings_saved_error'));
          }
      }
  };

  if (loading) return <Spinner />;
  if (!user) return null;

  return (
    <div className="container mx-auto pb-8">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
             <h2 className="text-3xl font-bold text-blue-800">
                {t(user.role === UserRole.Manager ? 'manager_dashboard_title' : 'supervisor_dashboard_title')}
             </h2>
             <span className="text-slate-500">{t('today_is', new Date().toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}</span>
          </div>
          
          <div className="flex flex-wrap gap-2 p-1 bg-white/50 rounded-xl shadow-sm border border-slate-200">
              {[
                { id: 'overview', icon: ChartBarIcon, label: t('analytics_overview') },
                { id: 'users', icon: UserGroupIcon, label: t('user_management') },
                { id: 'plans', icon: CalendarIcon, label: t('plan_approvals'), badge: pendingPlans.length },
                { id: 'reports', icon: ClipboardCheckIcon, label: t('reports') },
                { id: 'vacations', icon: SunIcon, label: t('vacations') },
                { id: 'import', icon: DownloadIcon, label: t('data_import') },
                { id: 'settings', icon: CogIcon, label: t('system_settings') },
              ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setView(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        view === tab.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-600 hover:bg-white hover:text-blue-600'
                    }`}
                  >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                      {tab.badge ? (
                          <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ms-1">{tab.badge}</span>
                      ) : null}
                  </button>
              ))}
          </div>
      </div>

      {/* VIEW: OVERVIEW */}
      {view === 'overview' && (
        <div className="space-y-6 animate-fade-in">
           {/* Summary Cards */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/60 p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-3"><ClipboardCheckIcon className="w-8 h-8"/></div>
                    <p className="text-3xl font-bold text-slate-800">{reports.filter(r => new Date(r.date).getMonth() === new Date().getMonth()).length}</p>
                    <p className="text-sm text-slate-500">{t('total_visits_this_month')}</p>
                </div>
                <div className="bg-white/60 p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full mb-3"><UserGroupIcon className="w-8 h-8"/></div>
                    <p className="text-3xl font-bold text-slate-800">{new Set(reports.map(r => r.targetName)).size}</p>
                    <p className="text-sm text-slate-500">{t('unique_clients_this_month')}</p>
                </div>
                <div className="bg-white/60 p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                     <div className="p-3 bg-orange-100 text-orange-600 rounded-full mb-3"><CalendarIcon className="w-8 h-8"/></div>
                     <p className="text-3xl font-bold text-slate-800">{pendingPlans.length}</p>
                     <p className="text-sm text-slate-500">{t('pending_rep_plans')}</p>
                </div>
                 <div className="bg-white/60 p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                     <div className="p-3 bg-purple-100 text-purple-600 rounded-full mb-3"><SunIcon className="w-8 h-8"/></div>
                     <p className="text-3xl font-bold text-slate-800">{absences.filter(a => a.status === 'PENDING').length}</p>
                     <p className="text-sm text-slate-500">{t('pending_requests')}</p>
                </div>
           </div>

           <AnalyticsCharts reports={reports} />
           
           <div className="flex justify-center">
              <button 
                  onClick={() => setIsDailyVisitsModalOpen(true)}
                  className="bg-teal-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-teal-700 transition-all shadow-lg flex items-center gap-2"
              >
                  <SearchIcon className="w-5 h-5"/>
                  {t('view_details')}
              </button>
           </div>
        </div>
      )}

      {/* VIEW: USERS */}
      {view === 'users' && (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center bg-white/40 p-4 rounded-xl">
                 <h3 className="text-xl font-bold text-slate-700">{t('reps_list')}</h3>
                 <div className="flex gap-2">
                     <button 
                        onClick={() => exportMultipleRepClientsToExcel(doctors, pharmacies, regions, users, `All_Clients_List`, t)}
                        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
                     >
                         <DownloadIcon className="w-4 h-4"/>
                         {t('download_client_lists')}
                     </button>
                     <button 
                        onClick={() => exportUsersToExcel(users, 'users_list', t)}
                        className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                     >
                         <DownloadIcon className="w-4 h-4"/>
                         {t('download_reps_list')}
                     </button>
                     <button 
                        onClick={() => handleUserEdit(null)}
                        className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 text-sm"
                     >
                         <PlusIcon className="w-4 h-4"/>
                         {t('add_rep')}
                     </button>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {users.map(u => (
                     <div key={u.id} className="bg-white/60 p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                         <div>
                             <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role === UserRole.Manager ? 'bg-purple-100 text-purple-700' : (u.role === UserRole.Supervisor ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700')}`}>
                                    {t(u.role)}
                                </span>
                                {user.role === UserRole.Manager && (
                                    <div className="flex gap-1">
                                        <button onClick={() => handleUserEdit(u)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md" title={t('edit')}>
                                            <EditIcon className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => handleDeleteUser(u)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md" title={t('delete')}>
                                            <TrashIcon className="w-4 h-4"/>
                                        </button>
                                    </div>
                                )}
                             </div>
                             <h4 className="font-bold text-lg text-slate-800">{u.name}</h4>
                             <p className="text-sm text-slate-500 mb-4">{u.username}</p>
                         </div>
                         
                         {u.role === UserRole.Rep && (
                            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-100">
                                <button onClick={() => handleUserRegions(u)} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
                                    <MapPinIcon className="w-4 h-4"/> {t('manage_regions')}
                                </button>
                                <button onClick={() => handleResetRepData(u)} className="text-sm font-semibold text-red-600 hover:underline flex items-center gap-1">
                                    <WarningIcon className="w-4 h-4"/> {t('reset_rep_visits')}
                                </button>
                            </div>
                         )}
                     </div>
                 ))}
             </div>
        </div>
      )}

      {/* VIEW: PLANS */}
      {view === 'plans' && (
        <div className="space-y-6 animate-fade-in">
             {viewingPlanRepId ? (
                 <WeeklyView 
                    user={users.find(u => u.id === viewingPlanRepId)!}
                    visits={reports.filter(r => r.repName === users.find(u => u.id === viewingPlanRepId)?.name)}
                    settings={systemSettings}
                    plan={plans[viewingPlanRepId]?.plan || null}
                    regions={regions}
                    onBack={() => setViewingPlanRepId(null)}
                 />
             ) : (
                <>
                 <div className="bg-white/40 p-4 rounded-xl border border-white/50">
                    <h3 className="text-xl font-bold text-slate-700 mb-4">{t('weekly_plans_overview')}</h3>
                    
                    {pendingPlans.length === 0 && (
                        <div className="text-center py-8 text-slate-500 bg-white/50 rounded-lg border border-dashed border-slate-300">
                            <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-2"/>
                            <p>{t('no_new_plans_to_review')}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reps.map(rep => {
                            const plan = plans[rep.id];
                            const status = plan?.status || 'draft';
                            const statusColors = {
                                draft: 'bg-gray-100 text-gray-500',
                                pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                                approved: 'bg-green-100 text-green-700 border-green-200',
                                rejected: 'bg-red-100 text-red-700 border-red-200'
                            };

                            return (
                                <div key={rep.id} className={`p-4 rounded-xl border flex justify-between items-center ${status === 'pending' ? 'bg-white shadow-md border-yellow-200' : 'bg-white/40 border-slate-200 opacity-80'}`}>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{rep.name}</h4>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                                            {t(`plan_status_${status}`)}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setViewingPlanRepId(rep.id)}
                                            className="px-3 py-1.5 text-sm font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                        >
                                            {t('view_plans')}
                                        </button>
                                        
                                        {status === 'pending' && (
                                            <>
                                                <button onClick={() => handlePlanReview(rep.id, 'approved')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title={t('approve')}>
                                                    <CheckIcon className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => handlePlanReview(rep.id, 'rejected')} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title={t('reject')}>
                                                    <XIcon className="w-4 h-4"/>
                                                </button>
                                            </>
                                        )}
                                        {status === 'approved' && (
                                             <button onClick={() => handleRevokePlan(rep.id)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600" title={t('revoke_approval')}>
                                                <XIcon className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
                 </>
             )}
        </div>
      )}

      {/* VIEW: REPORTS */}
      {view === 'reports' && (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white/40 p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                 <div className="w-full md:w-auto">
                    <label className="text-sm font-bold text-slate-700 me-2">{t('filter_by_rep')}:</label>
                    <select 
                        value={selectedRepId} 
                        onChange={(e) => setSelectedRepId(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-blue-500"
                    >
                        <option value="all">{t('all_reps')}</option>
                        {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                 </div>
                 <button 
                    onClick={() => exportToExcel(filteredReports, 'Visit_Reports', t)}
                    className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
                 >
                     <DownloadIcon className="w-4 h-4"/>
                     {t('export_reports', filteredReports.length)}
                 </button>
             </div>

             <div className="bg-white/60 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <table className="w-full text-sm text-start text-slate-600">
                     <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                         <tr>
                             <th className="px-4 py-3">{t('date')}</th>
                             <th className="px-4 py-3">{t('rep_name')}</th>
                             <th className="px-4 py-3">{t('client')}</th>
                             <th className="px-4 py-3">{t('visit_type')}</th>
                             <th className="px-4 py-3">{t('product')}</th>
                             <th className="px-4 py-3">{t('notes')}</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200">
                         {filteredReports.slice(0, 100).map(report => (
                             <tr key={report.id} className="hover:bg-slate-50">
                                 <td className="px-4 py-3">{new Date(report.date).toLocaleDateString(t('locale'))}</td>
                                 <td className="px-4 py-3 font-semibold">{report.repName}</td>
                                 <td className="px-4 py-3">{report.targetName}</td>
                                 <td className="px-4 py-3">
                                     <span className={`px-2 py-1 rounded-full text-xs font-bold ${report.type === 'DOCTOR_VISIT' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                         {t(report.type)}
                                     </span>
                                 </td>
                                 <td className="px-4 py-3">{report.productName || '-'}</td>
                                 <td className="px-4 py-3 truncate max-w-xs">{report.notes}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
                 {filteredReports.length > 100 && (
                     <div className="p-4 text-center text-slate-500 text-sm bg-slate-50 border-t border-slate-200">
                         {t('showing_today_reports_only')} {/* Reusing a translation key, functionally implying partial view */}
                     </div>
                 )}
             </div>
        </div>
      )}

      {/* VIEW: VACATIONS */}
      {view === 'vacations' && (
         <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center bg-white/40 p-4 rounded-xl">
                 <div className="flex items-center gap-4">
                     <h3 className="text-xl font-bold text-slate-700">{t('vacation_stats')}</h3>
                     <input 
                        type="month" 
                        value={vacationMonth} 
                        onChange={(e) => setVacationMonth(e.target.value)}
                        className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
                     />
                 </div>
                 <button 
                    onClick={() => exportVacationStatsToExcel(vacationStats, `Vacations_${vacationMonth}`, t)}
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
                 >
                     <DownloadIcon className="w-4 h-4"/>
                     {t('download_excel')}
                 </button>
             </div>
             
             <p className="text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                 <WarningIcon className="w-4 h-4 inline me-2"/>
                 {t('vacation_stats_info')}
             </p>

             <div className="grid grid-cols-1 gap-4">
                 {vacationStats.map(stat => (
                     <div key={stat.repId} className="bg-white/60 p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                         <div className="flex-1">
                             <h4 className="font-bold text-lg text-slate-800">{stat.repName}</h4>
                             <p className="text-xs text-slate-500">{stat.repUsername}</p>
                         </div>
                         <div className="flex gap-4 text-center">
                             <div className="bg-slate-100 p-2 rounded-lg min-w-[80px]">
                                 <p className="text-xl font-bold text-slate-700">{stat.totalWorkingDaysPassed}</p>
                                 <p className="text-[10px] text-slate-500 uppercase">{t('total_working_days_passed')}</p>
                             </div>
                             <div className="bg-green-50 p-2 rounded-lg min-w-[80px]">
                                 <p className="text-xl font-bold text-green-700">{stat.daysWorked}</p>
                                 <p className="text-[10px] text-green-600 uppercase">{t('days_worked')}</p>
                             </div>
                             <div className="bg-red-50 p-2 rounded-lg min-w-[80px]">
                                 <p className="text-xl font-bold text-red-700">{stat.absentDays}</p>
                                 <p className="text-[10px] text-red-600 uppercase">{t('absent_days')}</p>
                             </div>
                         </div>
                         <button 
                            onClick={() => setAbsentDetailsModalUser({ name: stat.repName, details: stat.absentDetailsList })}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold hover:underline"
                         >
                             {t('view_details')}
                         </button>
                     </div>
                 ))}
             </div>
         </div>
      )}

      {/* VIEW: SETTINGS */}
      {view === 'settings' && systemSettings && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-white/60 p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">{t('holidays_settings')}</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                      {systemSettings.holidays.map(date => (
                          <div key={date} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                              {date}
                              <button onClick={() => handleRemoveHoliday(date)} className="text-purple-400 hover:text-red-500"><XIcon className="w-4 h-4"/></button>
                          </div>
                      ))}
                      {systemSettings.holidays.length === 0 && <span className="text-slate-500 italic">{t('no_holidays_added')}</span>}
                  </div>
                  <button onClick={handleAddHoliday} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm">
                      <PlusIcon className="w-4 h-4 inline me-1"/> {t('add_holiday')}
                  </button>
              </div>
          </div>
      )}

      {/* VIEW: IMPORT */}
      {view === 'import' && (
          <div className="animate-fade-in">
              <DataImport />
          </div>
      )}

      {/* Modals */}
      {isUserEditModalOpen && (
        <UserEditModal
          isOpen={isUserEditModalOpen}
          onClose={() => setIsUserEditModalOpen(false)}
          onSuccess={() => { setIsUserEditModalOpen(false); fetchData(); }}
          userToEdit={userToEdit}
        />
      )}

      {isRegionsModalOpen && userForRegions && (
        <UserRegionsModal
          isOpen={isRegionsModalOpen}
          onClose={() => setIsRegionsModalOpen(false)}
          user={userForRegions}
          allRegions={regions}
        />
      )}

      {isDailyVisitsModalOpen && (
        <DailyVisitsDetailModal
          isOpen={isDailyVisitsModalOpen}
          onClose={() => setIsDailyVisitsModalOpen(false)}
          reports={reports}
          reps={reps}
          selectedRepId={'all'}
        />
      )}
      
      {absentDetailsModalUser && (
          <AbsentDetailsModal 
             isOpen={!!absentDetailsModalUser}
             onClose={() => setAbsentDetailsModalUser(null)}
             repName={absentDetailsModalUser.name}
             absentDetails={absentDetailsModalUser.details}
             currentUserRole={user.role} // Pass the current user role to control delete permission
             onUpdate={fetchData} 
          />
      )}

      {confirmAction.isOpen && (
        <Modal isOpen={confirmAction.isOpen} onClose={() => setConfirmAction({...confirmAction, isOpen: false})} title={confirmAction.title}>
          <div className="space-y-4">
            <p className="text-slate-700">{confirmAction.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmAction({...confirmAction, isOpen: false})} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
              <button onClick={() => { confirmAction.onConfirm(); setConfirmAction({...confirmAction, isOpen: false}); }} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('confirm')}</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default ManagerDashboard;
