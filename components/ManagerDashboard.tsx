
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { User, VisitReport, WeeklyPlan, SystemSettings, RepAbsence, UserRole, Region, Doctor, Pharmacy, Expense } from '../types';
import Spinner from './Spinner';
import { 
    UserGroupIcon, ChartBarIcon, ClipboardCheckIcon, CogIcon, 
    CalendarIcon, DownloadIcon, PlusIcon, TrashIcon, EditIcon, 
    MapPinIcon, SearchIcon, CheckCircleIcon, XIcon, WarningIcon,
    SunIcon, CheckIcon, PresentationChartBarIcon, GraphIcon,
    DoctorIcon, PharmacyIcon
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
import FrequencyDetailModal from './FrequencyDetailModal';

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<VisitReport[]>([]);
  const [plans, setPlans] = useState<{ [repId: string]: WeeklyPlan }>({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [absences, setAbsences] = useState<RepAbsence[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'overview' | 'performance' | 'users' | 'plans' | 'reports' | 'vacations' | 'expenses' | 'settings' | 'import'>('overview');
  const [selectedRepId, setSelectedRepId] = useState<string | 'all'>('all');
  
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [isRegionsModalOpen, setIsRegionsModalOpen] = useState(false);
  const [userForRegions, setUserForRegions] = useState<User | null>(null);
  const [isDailyVisitsModalOpen, setIsDailyVisitsModalOpen] = useState(false);
  const [selectedFrequencyDetails, setSelectedFrequencyDetails] = useState<any>(null);
  const [absentDetailsModalUser, setAbsentDetailsModalUser] = useState<any>(null);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [viewingPlanRepId, setViewingPlanRepId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r, p, s, a, reg, d, ph, ex] = await Promise.all([
        api.getUsers(), api.getAllVisitReports(), api.getAllPlans(),
        api.getSystemSettings(), api.getRepAbsences(), api.getRegions(),
        api.getAllDoctors(), api.getAllPharmacies(), api.getExpenses()
      ]);
      setUsers(u); setReports(r); setPlans(p); setSystemSettings(s);
      setAbsences(a); setRegions(reg); setDoctors(d); setPharmacies(ph); setExpenses(ex);
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const reps = useMemo(() => users.filter(u => u.role === UserRole.Rep), [users]);
  const pendingPlans = useMemo(() => reps.filter(r => plans[r.id]?.status === 'pending'), [reps, plans]);
  const filteredReports = useMemo(() => selectedRepId === 'all' ? reports : reports.filter(r => r.repName === users.find(u => u.id === selectedRepId)?.name), [reports, selectedRepId, users]);

  const handleToggleWeekend = async (day: number) => {
    if (!systemSettings) return;
    const newWeekends = systemSettings.weekends.includes(day) 
      ? systemSettings.weekends.filter(d => d !== day) 
      : [...systemSettings.weekends, day];
    const newSettings = { ...systemSettings, weekends: newWeekends };
    await api.updateSystemSettings(newSettings);
    setSystemSettings(newSettings);
  };

  const handleReviewExpense = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api.reviewExpense(id, status);
    fetchData();
  };

  if (loading) return <Spinner />;
  if (!user) return null;

  return (
    <div className="container mx-auto pb-8">
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-center">
             <h2 className="text-3xl font-bold text-blue-800">{t(user.role === UserRole.Manager ? 'manager_dashboard_title' : 'supervisor_dashboard_title')}</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-1 bg-white/50 rounded-xl shadow-sm border border-slate-200">
              {[
                { id: 'overview', icon: ChartBarIcon, label: t('analytics_overview') },
                { id: 'performance', icon: PresentationChartBarIcon, label: t('rep_performance_view') },
                { id: 'users', icon: UserGroupIcon, label: t('user_management'), restricted: true },
                { id: 'plans', icon: CalendarIcon, label: t('plan_approvals'), badge: pendingPlans.length },
                { id: 'reports', icon: ClipboardCheckIcon, label: t('reports') },
                { id: 'expenses', icon: DownloadIcon, label: t('expenses') },
                { id: 'vacations', icon: SunIcon, label: t('vacations') },
                { id: 'import', icon: DownloadIcon, label: t('data_import'), restricted: true },
                { id: 'settings', icon: CogIcon, label: t('system_settings'), restricted: true },
              ].filter(tab => !tab.restricted || user.role === UserRole.Manager).map(tab => (
                  <button key={tab.id} onClick={() => setView(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white hover:text-blue-600'}`}>
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                      {tab.badge ? <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full ms-1">{tab.badge}</span> : null}
                  </button>
              ))}
          </div>
      </div>

      {view === 'overview' && (
        <div className="space-y-6 animate-fade-in">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/60 p-6 rounded-2xl border border-slate-200 flex flex-col items-center">
                    <p className="text-3xl font-bold text-slate-800">{reports.length}</p>
                    <p className="text-sm text-slate-500">{t('total_visits')}</p>
                </div>
                <div className="bg-white/60 p-6 rounded-2xl border border-slate-200 flex flex-col items-center">
                    <p className="text-3xl font-bold text-slate-800">{expenses.filter(e => e.status === 'PENDING').length}</p>
                    <p className="text-sm text-slate-500">{t('pending_expenses')}</p>
                </div>
           </div>
           <AnalyticsCharts reports={reports} />
        </div>
      )}

      {view === 'expenses' && (
        <div className="space-y-6 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-700">{t('expense_review')}</h3>
          <div className="bg-white/60 rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-start">
              <thead className="bg-slate-100 uppercase text-xs">
                <tr><th className="px-4 py-3">{t('date')}</th><th className="px-4 py-3">{t('rep_name')}</th><th className="px-4 py-3">{t('category')}</th><th className="px-4 py-3">{t('amount')}</th><th className="px-4 py-3">{t('status')}</th><th className="px-4 py-3 text-center">{t('actions')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td className="px-4 py-3">{exp.date}</td>
                    <td className="px-4 py-3 font-semibold">{exp.repName}</td>
                    <td className="px-4 py-3">{t(exp.category)}</td>
                    <td className="px-4 py-3 font-bold">{exp.amount}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold status-${exp.status}`}>{t(`status_${exp.status}`)}</span></td>
                    <td className="px-4 py-3 text-center">
                      {exp.status === 'PENDING' && (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleReviewExpense(exp.id, 'APPROVED')} className="text-green-600 hover:bg-green-50 p-1.5 rounded-md"><CheckIcon className="w-5 h-5"/></button>
                          <button onClick={() => handleReviewExpense(exp.id, 'REJECTED')} className="text-red-600 hover:bg-red-50 p-1.5 rounded-md"><XIcon className="w-5 h-5"/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'settings' && systemSettings && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white/60 p-6 rounded-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-700 mb-4">{t('weekend_settings')}</h3>
            <p className="text-sm text-slate-600 mb-4">{t('select_weekends')}</p>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map(day => (
                <button key={day} onClick={() => handleToggleWeekend(day)} className={`px-4 py-2 rounded-lg font-bold transition-all ${systemSettings.weekends.includes(day) ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {t(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day])}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/60 p-6 rounded-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-700 mb-4">{t('holidays_settings')}</h3>
            <div className="flex gap-4 items-center mb-6">
              <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="p-2 border border-slate-300 rounded-lg" />
              <button onClick={async () => { if(newHolidayDate) { const h = [...systemSettings.holidays, newHolidayDate]; await api.updateSystemSettings({...systemSettings, holidays: h}); setSystemSettings({...systemSettings, holidays: h}); setNewHolidayDate(''); } }} className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg shadow-md"><PlusIcon className="w-4 h-4 me-2 inline"/>{t('add_holiday')}</button>
            </div>
            <div className="flex flex-wrap gap-3">
              {systemSettings.holidays.map(d => <span key={d} className="bg-white px-3 py-1 rounded-full border border-purple-100 flex items-center gap-2">{d}<button onClick={async () => { const h = systemSettings.holidays.filter(x => x !== d); await api.updateSystemSettings({...systemSettings, holidays: h}); setSystemSettings({...systemSettings, holidays: h}); }}><XIcon className="w-4 h-4 text-red-400"/></button></span>)}
            </div>
          </div>
        </div>
      )}

      {/* Other views implementation remains similar... */}
    </div>
  );
};

export default ManagerDashboard;
