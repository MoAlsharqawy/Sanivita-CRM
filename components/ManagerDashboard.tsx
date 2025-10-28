import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/mockData';
import { Region, User, VisitReport, UserRole, Doctor, Pharmacy, ClientAlert, SystemSettings, WeeklyPlan } from '../types';
import { exportToExcel, exportToPdf, exportUsersToExcel, exportMultipleRepClientsToExcel } from '../services/exportService';
import { FilterIcon, DownloadIcon, CalendarIcon, DoctorIcon, PharmacyIcon, WarningIcon, UserIcon as UsersIcon, ChartBarIcon, CogIcon, CalendarPlusIcon, TrashIcon, MapPinIcon, CheckIcon, XIcon } from './icons';
import Modal from './Modal';
import { useAuth } from '../hooks/useAuth';

const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEK_DAYS_ORDERED = [ // Start with Saturday
    { name: 'السبت', index: 6 },
    { name: 'الأحد', index: 0 },
    { name: 'الاثنين', index: 1 },
    { name: 'الثلاثاء', index: 2 },
    { name: 'الأربعاء', index: 3 },
    { name: 'الخميس', index: 4 },
    { name: 'الجمعة', index: 5 },
];

type ManagerTab = 'reports' | 'users' | 'approvals' | 'settings' | 'weeklyPlans';


const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<VisitReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<VisitReport[]>([]);
  const [reps, setReps] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [totalDoctors, setTotalDoctors] = useState<Doctor[]>([]);
  const [totalPharmacies, setTotalPharmacies] = useState<Pharmacy[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<ClientAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<ClientAlert[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPlans, setAllPlans] = useState<{ [repId: number]: WeeklyPlan }>({});
  const [reviewMessage, setReviewMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tab and Modal states
  const [activeTab, setActiveTab] = useState<ManagerTab>('reports');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedRepsForExport, setSelectedRepsForExport] = useState<number[]>([]);
  const [selectedRepForDailyVisits, setSelectedRepForDailyVisits] = useState<number | 'all'>('all');


  // Settings tab local state
  const [localWeekends, setLocalWeekends] = useState<number[]>([]);
  const [localHolidays, setLocalHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');


  // Filter states
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, usersData, regionsData, doctorsData, pharmaciesData, alertsData, settingsData, plansData] = await Promise.all([
        api.getAllVisitReports(),
        api.getUsers(),
        api.getRegions(),
        api.getAllDoctors(),
        api.getAllPharmacies(),
        api.getOverdueVisits(),
        api.getSystemSettings(),
        api.getAllPlans(),
      ]);
      setAllReports(reportsData);
      setFilteredReports(reportsData);
      setReps(usersData.filter(u => u.role === UserRole.Rep));
      setRegions(regionsData);
      setTotalDoctors(doctorsData);
      setTotalPharmacies(pharmaciesData);
      setOverdueAlerts(alertsData);
      setFilteredAlerts(alertsData);
      setSystemSettings(settingsData);
      setLocalWeekends(settingsData.weekends);
      setLocalHolidays(settingsData.holidays.sort((a,b) => new Date(a).getTime() - new Date(b).getTime()));
      setAllPlans(plansData);
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useMemo(() => {
    // Filter reports
    let reports = allReports;
    if (selectedRep !== 'all') {
      reports = reports.filter(r => r.repName === selectedRep);
    }
    if (selectedRegion !== 'all') {
      reports = reports.filter(r => r.regionName === selectedRegion);
    }
    if (startDate) {
      reports = reports.filter(r => new Date(r.date) >= new Date(startDate));
    }
    if (endDate) {
      reports = reports.filter(r => new Date(r.date) <= new Date(endDate));
    }
    setFilteredReports(reports);
    
    // Filter alerts
    let alerts = overdueAlerts;
    if (selectedRep !== 'all') {
      alerts = alerts.filter(a => a.repName === selectedRep);
    }
    if (selectedRegion !== 'all') {
      alerts = alerts.filter(a => a.regionName === selectedRegion);
    }
    setFilteredAlerts(alerts);

  }, [selectedRep, selectedRegion, startDate, endDate, allReports, overdueAlerts]);
  
  const displayedStats = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const getVisitsForMonth = (reports: VisitReport[]) => {
      return reports.filter(visit => {
          const visitDate = new Date(visit.date);
          return visitDate >= startOfMonth && visitDate <= today;
      }).length;
    };

    if (selectedRep === 'all') {
      return {
        visitsThisMonth: getVisitsForMonth(allReports),
        doctorCount: totalDoctors.length,
        pharmacyCount: totalPharmacies.length,
      };
    }

    const selectedRepObject = reps.find(r => r.name === selectedRep);
    if (!selectedRepObject) {
      return { visitsThisMonth: 0, doctorCount: 0, pharmacyCount: 0 };
    }

    const repId = selectedRepObject.id;
    const repReports = allReports.filter(visit => visit.repName === selectedRep);

    return {
      visitsThisMonth: getVisitsForMonth(repReports),
      doctorCount: totalDoctors.filter(d => d.repId === repId).length,
      pharmacyCount: totalPharmacies.filter(p => p.repId === repId).length,
    };
  }, [selectedRep, allReports, totalDoctors, totalPharmacies, reps]);

  const dailyVisitCounts = useMemo(() => {
    const todayStr = new Date().toDateString();

    const todaysVisits = allReports.filter(report =>
        new Date(report.date).toDateString() === todayStr
    );
    
    const selectedRepName = selectedRepForDailyVisits !== 'all' 
        ? reps.find(r => r.id === selectedRepForDailyVisits)?.name 
        : null;

    const filteredByRep = selectedRepForDailyVisits === 'all'
        ? todaysVisits
        : todaysVisits.filter(visit => visit.repName === selectedRepName);

    const doctorVisits = filteredByRep.filter(v => v.type === 'زيارة طبيب').length;
    const pharmacyVisits = filteredByRep.filter(v => v.type === 'زيارة صيدلية').length;

    return { doctorVisits, pharmacyVisits };
  }, [allReports, selectedRepForDailyVisits, reps]);


  const userManagementStats = useMemo(() => {
    if (allReports.length === 0) {
      return {
        totalVisits: 0,
        totalUniqueClients: 0,
        averageVisitsPerMonth: 0,
      };
    }

    const totalVisits = allReports.length;
    const totalUniqueClients = new Set(allReports.map(r => r.targetName)).size;

    const visitDates = allReports.map(r => new Date(r.date));
    const earliestDate = new Date(Math.min(...visitDates.map(d => d.getTime())));
    const latestDate = new Date(Math.max(...visitDates.map(d => d.getTime())));

    const monthDifference = (latestDate.getFullYear() - earliestDate.getFullYear()) * 12 + (latestDate.getMonth() - earliestDate.getMonth()) + 1;
    
    const averageVisitsPerMonth = totalVisits / (monthDifference || 1);

    return {
      totalVisits,
      totalUniqueClients,
      averageVisitsPerMonth: parseFloat(averageVisitsPerMonth.toFixed(1)),
    };
  }, [allReports]);
  
  // Fix: Add a type guard to correctly infer the type of `plan` after filtering.
  const pendingPlans = useMemo(() => {
    return Object.entries(allPlans)
        .filter((entry): entry is [string, WeeklyPlan] => (entry[1] as WeeklyPlan).status === 'pending')
        .map(([repId, plan]) => ({
            repId: parseInt(repId),
            repName: reps.find(r => r.id === parseInt(repId))?.name || 'غير معروف',
            ...plan
        }));
  }, [allPlans, reps]);

  const handleReviewPlan = async (repId: number, status: 'approved' | 'rejected') => {
      try {
          await api.reviewRepPlan(repId, status);
           // Optimistic update
          setAllPlans(prevPlans => ({
              ...prevPlans,
              [repId]: { ...prevPlans[repId], status: status }
          }));

          const repName = reps.find(r => r.id === repId)?.name || '';
          const messageText = `تم ${status === 'approved' ? 'قبول' : 'رفض'} خطة ${repName}.`;
          setReviewMessage({ text: messageText, type: 'success' });

      } catch (error) {
          console.error(`Failed to ${status} plan for rep ${repId}`, error);
          setReviewMessage({ text: 'حدث خطأ أثناء مراجعة الخطة.', type: 'error' });
      } finally {
          setTimeout(() => setReviewMessage(null), 3000);
      }
  };

  const handleResetFilters = () => {
    setSelectedRep('all');
    setSelectedRegion('all');
    setStartDate('');
    setEndDate('');
  }

  const handleExportUsers = () => {
    exportUsersToExcel(reps, 'representatives_list');
  };

  const handleRepSelectionChange = (repId: number) => {
    setSelectedRepsForExport(prev => 
      prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]
    );
  };

  const handleSelectAllReps = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRepsForExport(reps.map(r => r.id));
    } else {
      setSelectedRepsForExport([]);
    }
  };

  const handleConfirmClientListExport = () => {
    if (selectedRepsForExport.length === 0) return;
    
    const selectedDoctors = totalDoctors.filter(d => selectedRepsForExport.includes(d.repId));
    const selectedPharmacies = totalPharmacies.filter(p => selectedRepsForExport.includes(p.repId));
    
    exportMultipleRepClientsToExcel(
      selectedDoctors,
      selectedPharmacies,
      regions,
      reps,
      'reps_client_lists'
    );
    
    setIsExportModalOpen(false);
    setSelectedRepsForExport([]);
  };

  const handleWeekendChange = (dayIndex: number) => {
    setLocalWeekends(prev =>
        prev.includes(dayIndex)
            ? prev.filter(d => d !== dayIndex)
            : [...prev, dayIndex]
    );
  };

  const handleAddHoliday = () => {
      if (newHoliday && !localHolidays.includes(newHoliday)) {
          setLocalHolidays(prev => [...prev, newHoliday].sort((a,b) => new Date(a).getTime() - new Date(b).getTime()));
          setNewHoliday('');
      }
  };

  const handleRemoveHoliday = (holiday: string) => {
      setLocalHolidays(prev => prev.filter(h => h !== holiday));
  };

  const handleSaveSettings = async () => {
      if (!systemSettings) return;
      const newSettings = { weekends: localWeekends, holidays: localHolidays };
      try {
          await api.updateSystemSettings(newSettings);
          setSystemSettings(newSettings);
          setSettingsMessage('تم حفظ الإعدادات بنجاح!');
          setTimeout(() => setSettingsMessage(''), 3000);
      } catch (error) {
          console.error("Failed to save settings", error);
          setSettingsMessage('حدث خطأ أثناء حفظ الإعدادات.');
          setTimeout(() => setSettingsMessage(''), 3000);
      }
  };

    const getPlanStatusBadge = (status: WeeklyPlan['status']) => {
        const statusMap = {
            draft: { text: 'مسودة', color: 'bg-blue-100 text-blue-800' },
            pending: { text: 'قيد المراجعة', color: 'bg-yellow-100 text-yellow-800' },
            approved: { text: 'معتمدة', color: 'bg-green-100 text-green-800' },
            rejected: { text: 'مرفوضة', color: 'bg-red-100 text-red-800' },
        };
        if (!statusMap[status]) return null;
        const { text, color } = statusMap[status];
        return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${color}`}>{text}</span>;
    };


  if (loading) {
    return <div className="text-center p-8">جاري تحميل البيانات...</div>;
  }

  return (
    <div className="container mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-blue-800">
        {user?.role === UserRole.Manager ? 'لوحة تحكم المدير' : 'لوحة تحكم المشرف'}
      </h2>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200/80">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('reports')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'reports' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <ChartBarIcon className="w-5 h-5 me-2" />
                      التقارير
                  </button>
              </li>
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('users')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'users' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <UsersIcon className="w-5 h-5 me-2" />
                      إدارة المستخدمين
                  </button>
              </li>
               <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('approvals')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'approvals' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <MapPinIcon className="w-5 h-5 me-2" />
                      اعتماد الخطط {pendingPlans.length > 0 && <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ms-2">{pendingPlans.length}</span>}
                  </button>
              </li>
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('weeklyPlans')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'weeklyPlans' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <CalendarIcon className="w-5 h-5 me-2" />
                      الخطط الأسبوعية
                  </button>
              </li>
              {user?.role === UserRole.Manager && (
                <li className="me-2">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'settings' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                    >
                        <CogIcon className="w-5 h-5 me-2" />
                        إعدادات النظام
                    </button>
                </li>
              )}
          </ul>
      </div>

      {activeTab === 'reports' && (
        <>
          {/* Daily Visits Card */}
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8">
                <h3 className="text-xl font-semibold mb-4 text-blue-700">الزيارات اليومية</h3>
                {/* Fix: Changed CSS property from '-ms-overflow-style' to camelCase 'msOverflowStyle' for React style compatibility */}
                <div className="flex border-b border-slate-300/50 mb-4 overflow-x-auto pb-1 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <button
                        onClick={() => setSelectedRepForDailyVisits('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${selectedRepForDailyVisits === 'all' ? 'bg-white/50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-200/50 border-b-2 border-transparent'}`}
                    >
                        الكل
                    </button>
                    {reps.map(rep => (
                        <button
                            key={rep.id}
                            onClick={() => setSelectedRepForDailyVisits(rep.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${selectedRepForDailyVisits === rep.id ? 'bg-white/50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-200/50 border-b-2 border-transparent'}`}
                        >
                            {rep.name}
                        </button>
                    ))}
                </div>
                <div className="flex justify-around items-center text-center">
                    <div>
                        <p className="text-5xl font-bold text-blue-800">{dailyVisitCounts.doctorVisits}</p>
                        <p className="text-md font-semibold text-slate-700 flex items-center justify-center gap-1 mt-1">
                          <DoctorIcon className="w-5 h-5 text-blue-600"/>
                          <span>أطباء</span>
                        </p>
                    </div>
                    <div className="h-16 w-px bg-slate-300"></div> {/* Divider */}
                    <div>
                        <p className="text-5xl font-bold text-orange-800">{dailyVisitCounts.pharmacyVisits}</p>
                        <p className="text-md font-semibold text-slate-700 flex items-center justify-center gap-1 mt-1">
                          <PharmacyIcon className="w-5 h-5 text-orange-600"/>
                          <span>صيدليات</span>
                        </p>
                    </div>
                </div>
            </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4">
                    <CalendarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{selectedRep === 'all' ? 'إجمالي زيارات الشهر' : `زيارات الشهر لـ ${selectedRep}`}</p>
                    <p className="text-4xl font-bold text-blue-800">{displayedStats.visitsThisMonth}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4">
                    <DoctorIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{selectedRep === 'all' ? 'إجمالي الأطباء' : `أطباء ${selectedRep}`}</p>
                    <p className="text-4xl font-bold text-green-800">{displayedStats.doctorCount}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-orange-500/20 text-orange-700 p-4 rounded-full me-4">
                    <PharmacyIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{selectedRep === 'all' ? 'إجمالي الصيدليات' : `صيدليات ${selectedRep}`}</p>
                    <p className="text-4xl font-bold text-orange-800">{displayedStats.pharmacyCount}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-red-500/20 text-red-700 p-4 rounded-full me-4">
                    <WarningIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">الزيارات المتأخرة</p>
                    <p className="text-4xl font-bold text-red-800">{filteredAlerts.length}</p>
                </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white/40 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/50 mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-700"><FilterIcon className="w-5 h-5 me-2"/>خيارات الفلترة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <select value={selectedRep} onChange={e => setSelectedRep(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500">
                <option value="all">كل المندوبين</option>
                {reps.map(rep => <option key={rep.id} value={rep.name}>{rep.name}</option>)}
              </select>
              <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500">
                <option value="all">كل المناطق</option>
                {regions.map(region => <option key={region.id} value={region.name}>{region.name}</option>)}
              </select>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" placeholder="من تاريخ" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" placeholder="إلى تاريخ" />
              <button onClick={handleResetFilters} className="w-full bg-slate-500 text-white p-2 rounded-md hover:bg-slate-600 transition-colors">إعادة تعيين</button>
            </div>
          </div>

          {/* Alerts Table */}
          {filteredAlerts.length > 0 && (
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden mb-8">
              <h3 className="text-xl font-semibold p-4 flex items-center text-red-700 bg-red-100/50"><WarningIcon className="w-6 h-6 me-3"/>تنبيهات الزيارات المتأخرة</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right text-gray-500">
                  <thead className="text-xs text-red-800 uppercase bg-red-50/50">
                    <tr>
                      <th scope="col" className="px-6 py-3">العميل</th>
                      <th scope="col" className="px-6 py-3">النوع</th>
                      <th scope="col" className="px-6 py-3">المندوب المسؤول</th>
                      <th scope="col" className="px-6 py-3">المنطقة</th>
                      <th scope="col" className="px-6 py-3">آخر زيارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map(alert => (
                      <tr key={alert.id} className="bg-red-50/20 border-b border-red-100/30 hover:bg-red-100/40">
                        <td className="px-6 py-4 font-medium text-slate-900">{alert.name}</td>
                        <td className="px-6 py-4">{alert.type === 'doctor' ? 'طبيب' : 'صيدلية'}</td>
                        <td className="px-6 py-4">{alert.repName}</td>
                        <td className="px-6 py-4">{alert.regionName}</td>
                        <td className="px-6 py-4 font-semibold text-red-600">
                          {alert.daysSinceLastVisit === null ? 'لم يزر من قبل' : `منذ ${alert.daysSinceLastVisit} يوم`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row justify-end items-center mb-4 gap-3">
                <span className="text-slate-700 font-medium">تصدير {filteredReports.length} تقرير:</span>
                <button onClick={() => exportToExcel(filteredReports, 'reports')} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    <DownloadIcon className="w-5 h-5 me-2"/> Excel
                </button>
                <button onClick={() => exportToPdf(filteredReports, 'reports')} className="w-full sm:w-auto flex items-center justify-center bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 transition-colors">
                    <DownloadIcon className="w-5 h-5 me-2"/> PDF
                </button>
            </div>

          {/* Reports Table */}
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right text-gray-500">
                <thead className="text-xs text-blue-800 uppercase bg-white/50">
                  <tr>
                    <th scope="col" className="px-6 py-3">التاريخ</th>
                    <th scope="col" className="px-6 py-3">نوع الزيارة</th>
                    <th scope="col" className="px-6 py-3">المندوب</th>
                    <th scope="col" className="px-6 py-3">المنطقة</th>
                    <th scope="col" className="px-6 py-3">العميل</th>
                    <th scope="col" className="px-6 py-3">التخصص</th>
                    <th scope="col" className="px-6 py-3">المنتجات</th>
                    <th scope="col" className="px-6 py-3">نوع الزيارة (طبيب)</th>
                    <th scope="col" className="px-6 py-3">الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(report => (
                    <tr key={report.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40">
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(report.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${report.type === 'زيارة طبيب' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{report.type}</span></td>
                      <td className="px-6 py-4 font-medium text-slate-900">{report.repName}</td>
                      <td className="px-6 py-4">{report.regionName}</td>
                      <td className="px-6 py-4">{report.targetName}</td>
                      <td className="px-6 py-4">{report.targetSpecialization || '-'}</td>
                      <td className="px-6 py-4">{report.productName || '-'}</td>
                      <td className="px-6 py-4">{report.visitType ? (report.visitType === 'Coaching' ? 'كوتشينج' : 'سينجل') : '-'}</td>
                      <td className="px-6 py-4 max-w-xs truncate" title={report.notes}>{report.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReports.length === 0 && <p className="text-center p-8 text-slate-600">لا توجد تقارير تطابق خيارات البحث.</p>}
            </div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <>
          {/* User Management Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4">
                    <CalendarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">إجمالي الزيارات المسجلة</p>
                    <p className="text-4xl font-bold text-blue-800">{userManagementStats.totalVisits}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4">
                    <UsersIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">إجمالي العملاء الفريدين</p>
                    <p className="text-4xl font-bold text-green-800">{userManagementStats.totalUniqueClients}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
                <div className="bg-purple-500/20 text-purple-700 p-4 rounded-full me-4">
                    <ChartBarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">متوسط الزيارات / شهر</p>
                    <p className="text-4xl font-bold text-purple-800">{userManagementStats.averageVisitsPerMonth}</p>
                </div>
            </div>
          </div>
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
              <div className="flex flex-wrap justify-between items-center p-4 bg-white/50 border-b border-white/30 gap-4">
                <h3 className="text-xl font-semibold flex items-center text-blue-800">
                    <UsersIcon className="w-6 h-6 me-3"/>
                    قائمة المندوبين
                </h3>
                <div className="flex items-center gap-3">
                  <button
                      onClick={() => { setSelectedRepsForExport([]); setIsExportModalOpen(true); }}
                      disabled={reps.length === 0}
                      className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-all shadow flex items-center gap-2 disabled:bg-teal-300 disabled:cursor-not-allowed"
                  >
                      <DownloadIcon className="w-5 h-5"/>
                      <span>تحميل قوائم العملاء</span>
                  </button>
                  <button
                      onClick={handleExportUsers}
                      disabled={reps.length === 0}
                      className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-all shadow flex items-center gap-2 disabled:bg-green-300 disabled:cursor-not-allowed"
                  >
                      <DownloadIcon className="w-5 h-5"/>
                      <span>تحميل قائمة المندوبين</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right text-gray-500">
                      <thead className="text-xs text-blue-800 uppercase bg-white/50">
                          <tr>
                              <th scope="col" className="px-6 py-3">الاسم الكامل</th>
                              <th scope="col" className="px-6 py-3">اسم المستخدم</th>
                              <th scope="col" className="px-6 py-3">الدور</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reps.map(user => (
                              <tr key={user.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40">
                                  <td className="px-6 py-4 font-medium text-slate-900">{user.name}</td>
                                  <td className="px-6 py-4">{user.username}</td>
                                  <td className="px-6 py-4">{user.role}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {reps.length === 0 && <p className="text-center p-8 text-slate-600">لا يوجد مندوبين لعرضهم.</p>}
              </div>
          </div>
        </>
      )}

       {activeTab === 'approvals' && (
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6 relative">
            <h3 className="text-xl font-semibold mb-4 text-blue-800">خطط المندوبين قيد المراجعة</h3>

            {reviewMessage && (
                <div className={`p-4 mb-4 text-sm rounded-lg ${reviewMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} role="alert">
                    <span className="font-medium">{reviewMessage.text}</span>
                </div>
            )}

            {pendingPlans.length > 0 ? (
                <div className="space-y-6">
                    {pendingPlans.map(item => (
                        <div key={item.repId} className="bg-white/30 p-4 rounded-lg shadow border border-white/50">
                            <h4 className="font-bold text-lg text-slate-800 mb-3">{item.repName}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
                                {WEEK_DAYS_ORDERED.map(day => {
                                    const regionId = item.plan[day.index];
                                    const regionName = regionId ? regions.find(r => r.id === regionId)?.name : 'راحة';
                                    return (
                                        <div key={day.index} className="text-center p-2 bg-slate-100 rounded">
                                            <p className="font-semibold text-sm text-slate-700">{day.name}</p>
                                            <p className={`text-xs ${regionId ? 'text-blue-600' : 'text-slate-500'}`}>{regionName}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end items-center gap-3">
                                <button onClick={() => handleReviewPlan(item.repId, 'rejected')} className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors">
                                    <XIcon className="w-4 h-4" />
                                    رفض
                                </button>
                                <button onClick={() => handleReviewPlan(item.repId, 'approved')} className="flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors">
                                    <CheckIcon className="w-4 h-4" />
                                    قبول
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-slate-600 py-8">لا توجد خطط جديدة للمراجعة.</p>
            )}
        </div>
      )}

      {activeTab === 'weeklyPlans' && (
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-xl font-semibold mb-6 text-blue-800">نظرة عامة على الخطط الأسبوعية</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right border-separate border-spacing-0">
                    <thead className="text-xs text-blue-800 uppercase bg-white/50">
                        <tr>
                            <th scope="col" className="sticky right-0 bg-white/50 px-6 py-3 rounded-tr-lg z-10">المندوب</th>
                            {WEEK_DAYS_ORDERED.map(day => <th key={day.index} scope="col" className="px-4 py-3 text-center">{day.name}</th>)}
                             <th scope="col" className="rounded-tl-lg"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {reps.map(rep => {
                            const plan = allPlans[rep.id];
                            if (!plan) return null; // Should not happen due to data hydration

                            return (
                                <tr key={rep.id} className="group bg-white/20 border-b border-white/30 hover:bg-white/40">
                                    <td className="sticky right-0 px-6 py-4 font-medium text-slate-900 whitespace-nowrap bg-white/20 group-hover:bg-white/40">
                                        <div className="font-semibold">{rep.name}</div>
                                        <div className="mt-1">{getPlanStatusBadge(plan.status)}</div>
                                    </td>
                                    {WEEK_DAYS_ORDERED.map(day => {
                                        const regionId = plan.plan[day.index];
                                        const regionName = regionId ? regions.find(r => r.id === regionId)?.name : 'راحة';
                                        return (
                                            <td key={day.index} className={`px-4 py-4 text-center whitespace-nowrap ${regionId ? 'text-blue-600 font-semibold' : 'text-slate-500'}`} title={regionName}>
                                                {regionName}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
                <h3 className="text-xl font-semibold mb-4 text-blue-800">إعدادات أيام العطلة الأسبوعية</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                    {WEEK_DAYS.map((day, index) => (
                        <label key={index} className="flex items-center space-x-2 space-x-reverse cursor-pointer p-3 bg-white/30 rounded-lg">
                            <input 
                                type="checkbox"
                                checked={localWeekends.includes(index)}
                                onChange={() => handleWeekendChange(index)}
                                className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-slate-800">{day}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
                <h3 className="text-xl font-semibold mb-4 text-blue-800">إعدادات المناسبات والعطلات الرسمية</h3>
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                    <input 
                        type="date"
                        value={newHoliday}
                        onChange={(e) => setNewHoliday(e.target.value)}
                        className="w-full sm:w-auto flex-grow p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                    <button onClick={handleAddHoliday} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        <CalendarPlusIcon className="w-5 h-5 me-2"/> إضافة عطلة
                    </button>
                </div>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                    {localHolidays.length > 0 ? localHolidays.map(holiday => (
                        <div key={holiday} className="flex justify-between items-center p-3 bg-white/30 rounded-lg">
                            <span className="font-mono text-slate-700">{holiday}</span>
                            <button onClick={() => handleRemoveHoliday(holiday)} className="text-red-500 hover:text-red-700">
                                <TrashIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    )) : <p className="text-center text-slate-500 p-4">لا توجد عطلات مضافة.</p>}
                </div>
            </div>

            <div className="flex items-center justify-between mt-6">
                <div className={`transition-opacity duration-300 ${settingsMessage ? 'opacity-100' : 'opacity-0'}`}>
                    {settingsMessage && <p className="text-green-700 font-semibold">{settingsMessage}</p>}
                </div>
                <button 
                    onClick={handleSaveSettings} 
                    className="bg-orange-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    حفظ الإعدادات
                </button>
            </div>
        </div>
      )}

      {isExportModalOpen && (
        <Modal 
          isOpen={isExportModalOpen} 
          onClose={() => setIsExportModalOpen(false)} 
          title="تحميل قوائم عملاء المندوبين"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">حدد المندوبين الذين ترغب في تحميل قوائم عملائهم.</p>
            
            <div className="border border-slate-300/50 rounded-lg">
                <div className="flex items-center p-3 bg-slate-100/50 rounded-t-lg border-b border-slate-300/50">
                    <input
                        type="checkbox"
                        id="selectAllReps"
                        onChange={handleSelectAllReps}
                        checked={reps.length > 0 && selectedRepsForExport.length === reps.length}
                        className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 me-3"
                    />
                    <label htmlFor="selectAllReps" className="text-sm font-medium text-slate-800 cursor-pointer">
                        تحديد الكل / إلغاء تحديد الكل
                    </label>
                </div>
                <div className="max-h-60 overflow-y-auto p-3 space-y-2">
                    {reps.map(rep => (
                        <div key={rep.id} className="flex items-center">
                            <input
                                type="checkbox"
                                id={`rep-${rep.id}`}
                                value={rep.id}
                                checked={selectedRepsForExport.includes(rep.id)}
                                onChange={() => handleRepSelectionChange(rep.id)}
                                className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 me-3"
                            />
                            <label htmlFor={`rep-${rep.id}`} className="text-sm text-slate-800 cursor-pointer">
                                {rep.name}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-300/50">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-700 bg-transparent hover:bg-slate-200/50 focus:ring-4 focus:outline-none focus:ring-slate-300 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 hover:text-slate-900 focus:z-10 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmClientListExport}
                disabled={selectedRepsForExport.length === 0}
                className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                تحميل ({selectedRepsForExport.length})
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ManagerDashboard;