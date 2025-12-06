
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Region, User, VisitReport, UserRole, Doctor, Pharmacy, ClientAlert, SystemSettings, WeeklyPlan, Specialization, RepTask, RepAbsence } from '../types';
import { exportToExcel, exportToPdf, exportUsersToExcel, exportMultipleRepClientsToExcel, exportClientsToExcel, exportVacationStatsToExcel } from '../services/exportService';
import { FilterIcon, DownloadIcon, CalendarIcon, DoctorIcon, PharmacyIcon, WarningIcon, UserIcon as UsersIcon, ChartBarIcon, CogIcon, CalendarPlusIcon, TrashIcon, MapPinIcon, CheckIcon, XIcon, UploadIcon, EditIcon, PlusIcon, UserGroupIcon, GraphIcon, EyeIcon, ReplyIcon, ClipboardListIcon, ChevronDownIcon, ChevronUpIcon, CheckCircleIcon, SunIcon } from './icons';
import Modal from './Modal';
import { useAuth } from '../hooks/useAuth';
import { useLanguage, TranslationFunction } from '../hooks/useLanguage';
import DataImport from './DataImport';
import Spinner from './Spinner';
import UserEditModal from './UserEditModal';
import AnalyticsCharts from './AnalyticsCharts';
import DailyVisitsDetailModal from './DailyVisitsDetailModal';
import OverdueClientsDetailModal from './OverdueClientsDetailModal';
import UserRegionsModal from './UserRegionsModal';
import FrequencyDetailModal from './FrequencyDetailModal';
import AbsentDetailsModal from './AbsentDetailsModal';
import RepClientManager from './RepClientManager';

// Helper functions for dates (YYYY-MM-DD format)
const toYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getTodayDateString = (): string => {
  return toYYYYMMDD(new Date());
};

const getCurrentWeekDateStrings = (t: TranslationFunction): { start: string; end: string } => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const startDate = new Date(today);
  // Adjust to the most recent Saturday (or today if it's Saturday)
  startDate.setDate(today.getDate() - (dayOfWeek === 6 ? 0 : dayOfWeek + 1));
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // End of the week (Friday)

  return {
    start: toYYYYMMDD(startDate),
    end: toYYYYMMDD(endDate),
  };
};

const getCurrentMonthDateStrings = (): { start: string; end: string } => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Day 0 of next month is last day of current

  return {
    start: toYYYYMMDD(startOfMonth),
    end: toYYYYMMDD(endOfMonth),
  };
};


const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
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
  const [allPlans, setAllPlans] = useState<{ [repId: string]: WeeklyPlan }>({});
  const [reviewMessage, setReviewMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [allDoctorsMap, setAllDoctorsMap] = useState<Map<number, Doctor>>(new Map());

  // Task Management State
  const [allTasks, setAllTasks] = useState<RepTask[]>([]);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedRepsForTask, setSelectedRepsForTask] = useState<string[]>([]);
  const [isTaskRepDropdownOpen, setIsTaskRepDropdownOpen] = useState(false);
  const [taskCreationMessage, setTaskCreationMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);


  const WEEK_DAYS = useMemo(() => [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')], [t]);
  const WEEK_DAYS_ORDERED = useMemo(() => [
    { name: t('saturday'), index: 6 },
    { name: t('sunday'), index: 0 },
    { name: t('monday'), index: 1 },
    { name: t('tuesday'), index: 2 },
    { name: t('wednesday'), index: 3 },
    { name: t('thursday'), index: 4 },
    { name: t('friday'), index: 5 },
  ], [t]);


  type ManagerTab = 'reports' | 'users' | 'clients' | 'approvals' | 'settings' | 'weeklyPlans' | 'dataImport' | 'tasks' | 'vacations' | 'rep_performance';


  // Tab and Modal states
  const [activeTab, setActiveTab] = useState<ManagerTab>('reports');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedRepsForExport, setSelectedRepsForExport] = useState<string[]>([]);
  const [selectedRepForDailyVisits, setSelectedRepForDailyVisits] = useState<string | 'all'>('all');
  const [isDailyVisitsDetailModalOpen, setIsDailyVisitsDetailModalOpen] = useState(false);
  const [isOverdueClientsDetailModalOpen, setIsOverdueClientsDetailModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // RepClientManager View State
  const [viewingRepClients, setViewingRepClients] = useState<User | null>(null);
  
  // Reset visits functionality
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [repToReset, setRepToReset] = useState<User | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  
  // State for the new expandable List card
  const [isListCardExpanded, setIsListCardExpanded] = useState(false);

  // New state for User Regions Modal
  const [isUserRegionsModalOpen, setIsUserRegionsModalOpen] = useState(false);
  const [userForRegions, setUserForRegions] = useState<User | null>(null);

  // NEW: State for Frequency Detail Modal
  const [isFrequencyDetailModalOpen, setIsFrequencyDetailModalOpen] = useState(false);
  const [selectedFrequencyDetails, setSelectedFrequencyDetails] = useState<{
      title: string;
      doctors: { name: string; region: string; specialization: string; visits: number; lastVisitDate?: string | null }[];
      repName: string;
      frequencyLabel: string;
  } | null>(null);
  
  // Vacation Stats State
  const [selectedVacationMonth, setSelectedVacationMonth] = useState<string>(toYYYYMMDD(new Date()).substring(0, 7)); // YYYY-MM
  const [isAbsentDetailModalOpen, setIsAbsentDetailModalOpen] = useState(false);
  const [selectedAbsentDetails, setSelectedAbsentDetails] = useState<{ repName: string; details: { id?: number; date: string; reason: string; isManual: boolean }[] } | null>(null);
  const [repAbsences, setRepAbsences] = useState<RepAbsence[]>([]);
  const [isRegisterAbsenceModalOpen, setIsRegisterAbsenceModalOpen] = useState(false);
  
  // Register Absence Form State
  const [absenceFormRepId, setAbsenceFormRepId] = useState('');
  const [absenceFormDate, setAbsenceFormDate] = useState(getTodayDateString());
  const [absenceReasonSelect, setAbsenceReasonSelect] = useState('');
  const [absenceReasonText, setAbsenceReasonText] = useState('');
  const [isRegisteringAbsence, setIsRegisteringAbsence] = useState(false);
  const [registerAbsenceMessage, setRegisterAbsenceMessage] = useState('');
  const [pendingLeaveMessage, setPendingLeaveMessage] = useState('');

  // Rep Performance View State
  const [selectedRepForAnalysis, setSelectedRepForAnalysis] = useState<string>('');


  // Settings tab local state
  const [localWeekends, setLocalWeekends] = useState<number[]>([]);
  const [localHolidays, setLocalHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Filter states
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'none' | 'today' | 'currentWeek' | 'currentMonth'>('today');
  const [isReportExpanded, setIsReportExpanded] = useState(false);


  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, usersData, regionsData, doctorsData, pharmaciesData, alertsData, settingsData, plansData, tasksData, absencesData] = await Promise.all([
        api.getAllVisitReports(),
        api.getUsers(),
        api.getRegions(),
        api.getAllDoctors(),
        api.getAllPharmacies(),
        api.getOverdueVisits(),
        api.getSystemSettings(),
        api.getAllPlans(),
        api.getAllTasks(),
        api.getRepAbsences()
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
      if (settingsData) {
        setLocalWeekends(settingsData.weekends);
        setLocalHolidays(settingsData.holidays.sort((a,b) => new Date(a).getTime() - new Date(b).getTime()));
      }
      setAllPlans(plansData);
      setAllDoctorsMap(new Map(doctorsData.map(doc => [doc.id, doc])));
      setAllTasks(tasksData);
      setRepAbsences(absencesData);
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab, fetchInitialData]);

  // When switching tabs, clear specific states if needed
  useEffect(() => {
      if (activeTab !== 'clients') {
          setViewingRepClients(null);
      }
  }, [activeTab]);

  useMemo(() => {
    let reports = allReports;
    let currentStartDate = startDate;
    let currentEndDate = endDate;

    if (selectedQuickFilter === 'today') {
      const today = getTodayDateString();
      currentStartDate = today;
      currentEndDate = today;
    } else if (selectedQuickFilter === 'currentWeek') {
      const { start, end } = getCurrentWeekDateStrings(t);
      currentStartDate = start;
      currentEndDate = end;
    } else if (selectedQuickFilter === 'currentMonth') {
      const { start, end } = getCurrentMonthDateStrings();
      currentStartDate = start;
      currentEndDate = end;
    }

    if (selectedRep !== 'all') {
      reports = reports.filter(r => r.repName === selectedRep);
    }
    if (selectedRegion !== 'all') {
      reports = reports.filter(r => r.regionName === selectedRegion);
    }
    if (currentStartDate) {
      reports = reports.filter(r => new Date(r.date) >= new Date(currentStartDate));
    }
    if (currentEndDate) {
      const endOfDay = new Date(currentEndDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      reports = reports.filter(r => new Date(r.date) < endOfDay);
    }
    setFilteredReports(reports);
    
    let alerts = overdueAlerts;
    if (selectedRep !== 'all') {
      alerts = alerts.filter(a => a.repName === selectedRep);
    }
    if (selectedRegion !== 'all') {
      alerts = alerts.filter(a => a.regionName === selectedRegion);
    }
    setFilteredAlerts(alerts);

  }, [selectedRep, selectedRegion, startDate, endDate, selectedQuickFilter, allReports, overdueAlerts, t]);
  
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

  // Specific Rep Stats Logic
  const repSpecificStats = useMemo(() => {
      if (!selectedRepForAnalysis || !reps.find(r => r.id === selectedRepForAnalysis)) return null;

      const repId = selectedRepForAnalysis;
      const rep = reps.find(r => r.id === repId);
      const repName = rep?.name || '';
      
      const repReports = allReports.filter(r => r.repName === repName);
      
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Monthly Visits
      const monthlyVisits = repReports.filter(visit => {
          const visitDate = new Date(visit.date);
          return visitDate >= startOfMonth && visitDate <= today;
      });

      // Total Assigned Clients
      const assignedDoctors = totalDoctors.filter(d => d.repId === repId);
      const assignedPharmacies = totalPharmacies.filter(p => p.repId === repId);
      const totalAssigned = assignedDoctors.length + assignedPharmacies.length;

      // Coverage
      const uniqueVisitedDoctors = new Set(monthlyVisits.filter(v => v.type === 'DOCTOR_VISIT').map(v => v.targetName));
      const coveragePercent = totalAssigned > 0 
          ? ((uniqueVisitedDoctors.size) / assignedDoctors.length * 100).toFixed(1) 
          : '0';

      // Avg Per Day
      const uniqueDays = new Set(monthlyVisits.map(r => new Date(r.date).toDateString())).size;
      const avgPerDay = uniqueDays > 0 ? (monthlyVisits.length / uniqueDays).toFixed(1) : '0';

      // Plan Status for current week
      const plan = allPlans[repId];

      return {
          monthlyVisitsCount: monthlyVisits.length,
          totalAssigned,
          assignedDoctorsCount: assignedDoctors.length,
          assignedPharmaciesCount: assignedPharmacies.length,
          coveragePercent,
          avgPerDay,
          repReports,
          planStatus: plan?.status || 'draft',
          monthlyVisits // passing the array for charts
      };
  }, [selectedRepForAnalysis, allReports, totalDoctors, totalPharmacies, reps, allPlans]);


  const dailyVisitCounts = useMemo(() => {
    const todayStr = new Date().toDateString();

    const todaysVisits = allReports.filter(report =>
        new Date(report.date).toDateString() === todayStr
    );
    
    const selectedRepObject = selectedRepForDailyVisits !== 'all' 
        ? reps.find(r => r.id === selectedRepForDailyVisits)
        : null;

    const filteredByRep = selectedRepForDailyVisits === 'all'
        ? todaysVisits
        : todaysVisits.filter(visit => visit.repName === selectedRepObject?.name);

    const doctorVisits = filteredByRep.filter(v => v.type === 'DOCTOR_VISIT').length;
    const pharmacyVisits = filteredByRep.filter(v => v.type === 'PHARMACY_VISIT').length;

    return { doctorVisits, pharmacyVisits };
  }, [allReports, selectedRepForDailyVisits, reps]);


  const monthlySummaryStats = useMemo(() => {
    const relevantReports = selectedRep === 'all'
        ? allReports
        : allReports.filter(r => r.repName === selectedRep);
    
    if (relevantReports.length === 0) {
        return {
            totalVisitsThisMonth: 0,
            uniqueClientsThisMonth: 0,
            averageVisitsPerMonth: 0,
        };
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthlyReports = relevantReports.filter(visit => {
        const visitDate = new Date(visit.date);
        return visitDate >= startOfMonth && visitDate <= today;
    });

    const totalVisitsThisMonth = monthlyReports.length;
    const uniqueClientsThisMonth = new Set(monthlyReports.map(r => r.targetName)).size;
    
    const visitDates = relevantReports.map(r => new Date(r.date));
    const earliestDate = new Date(Math.min(...visitDates.map(d => d.getTime())));
    const latestDate = new Date(Math.max(...visitDates.map(d => d.getTime())));

    const monthDifference = (latestDate.getFullYear() - earliestDate.getFullYear()) * 12 + (latestDate.getMonth() - earliestDate.getMonth()) + 1;
    
    const averageVisitsPerMonth = relevantReports.length / (monthDifference || 1);

    return {
        totalVisitsThisMonth,
        uniqueClientsThisMonth,
        averageVisitsPerMonth: parseFloat(averageVisitsPerMonth.toFixed(1)),
    };
  }, [allReports, selectedRep]);

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
  
  const pendingPlans = useMemo(() => {
    return Object.entries(allPlans)
        .filter((entry): entry is [string, WeeklyPlan] => (entry[1] as WeeklyPlan).status === 'pending')
        .map(([repId, plan]) => ({
            repId: repId,
            repName: reps.find(r => r.id === repId)?.name || t('unknown'),
            ...plan
        }));
  }, [allPlans, reps, t]);

  const clientStatsByRep = useMemo(() => {
    return reps.map(rep => {
      const repDoctors = totalDoctors.filter(d => d.repId === rep.id);
      const repPharmacies = totalPharmacies.filter(p => p.repId === rep.id);

      const specializationCounts = repDoctors.reduce((acc, doctor) => {
        const spec = doctor.specialization;
        acc[spec] = (acc[spec] || 0) + 1;
        return acc;
      }, {} as Record<Specialization.Pediatrics | Specialization.Pulmonology, number>);

      return {
        rep,
        doctorCount: repDoctors.length,
        pharmacyCount: repPharmacies.length,
        totalClients: repDoctors.length + repPharmacies.length,
        specializationCounts,
      };
    });
  }, [reps, totalDoctors, totalPharmacies]);

  const totalSpecializationCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      totalDoctors.forEach(d => {
          if (d.specialization) {
              counts[d.specialization] = (counts[d.specialization] || 0) + 1;
          }
      });
      return counts;
  }, [totalDoctors]);

  const repFrequencyStats = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const statsMap: Record<string, { f0: number, f1: number, f2: number, f3: number }> = {};
    reps.forEach(r => {
        statsMap[r.name] = { f0: 0, f1: 0, f2: 0, f3: 0 };
    });

    // 1. Calculate visit counts per doctor per rep
    const visitCounts = new Map<string, number>();

    allReports.forEach(visit => {
        const visitDate = new Date(visit.date);
        if (visitDate >= startOfMonth && visitDate <= today && visit.type === 'DOCTOR_VISIT') {
            const key = `${visit.repName}_${visit.targetName}`;
            visitCounts.set(key, (visitCounts.get(key) || 0) + 1);
        }
    });

    // 2. Iterate through ALL doctors to assign them to frequency buckets (including 0)
    reps.forEach(rep => {
         const repDoctors = totalDoctors.filter(d => d.repId === rep.id);
         repDoctors.forEach(doc => {
             const key = `${rep.name}_${doc.name}`;
             const count = visitCounts.get(key) || 0;
             
             if (statsMap[rep.name]) {
                 if (count === 0) statsMap[rep.name].f0++;
                 else if (count === 1) statsMap[rep.name].f1++;
                 else if (count === 2) statsMap[rep.name].f2++;
                 else if (count >= 3) statsMap[rep.name].f3++;
             }
         });
    });

    let result = Object.entries(statsMap).map(([name, counts]) => ({ name, ...counts }));
    
    if (selectedRep !== 'all') {
        result = result.filter(r => r.name === selectedRep);
    }

    return result;
  }, [allReports, reps, selectedRep, totalDoctors]);

  // Vacation Stats Logic - UPDATED with Manual Absences
  const vacationStats = useMemo(() => {
    if (!systemSettings) return [];

    const [yearStr, monthStr] = selectedVacationMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-indexed

    const today = new Date();
    today.setHours(0,0,0,0);

    // Determine the end of calculation range:
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    let calculationEndDate = monthEnd;
    if (today < monthEnd) {
        calculationEndDate = today;
    }

    // Pre-process reports
    const workMap = new Set<string>();
    allReports.forEach(r => {
        const d = new Date(r.date);
        const dateKey = toYYYYMMDD(d);
        workMap.add(`${r.repName}-${dateKey}`);
    });

    // Map APPROVED absences for quick lookup: RepId -> Set<Date>
    const approvedAbsenceMap = new Map<string, Map<string, {reason: string, id: number}>>();
    repAbsences.filter(a => a.status === 'APPROVED').forEach(abs => {
        if (!approvedAbsenceMap.has(abs.repId)) {
            approvedAbsenceMap.set(abs.repId, new Map());
        }
        approvedAbsenceMap.get(abs.repId)!.set(abs.date, {reason: abs.reason || '', id: abs.id});
    });

    const stats = reps.map(rep => {
        let totalWorkingDaysPassed = 0;
        let daysWorked = 0;
        const absentDetails: { id?: number; date: string; reason: string; isManual: boolean }[] = [];

        if (monthStart <= calculationEndDate) {
            const current = new Date(monthStart);
            while (current <= calculationEndDate) {
                const dateStr = toYYYYMMDD(current);
                const dayIndex = current.getDay();

                const isWeekend = systemSettings.weekends.includes(dayIndex);
                const isHoliday = systemSettings.holidays.includes(dateStr);
                const approvedAbsence = approvedAbsenceMap.get(rep.id)?.get(dateStr);

                // Priority: 
                // 1. Approved Absence Record exists -> Mark Absent
                // 2. Weekend/Holiday -> Skip
                // 3. Regular working day -> Check visits

                if (approvedAbsence) {
                    // Approved absence counts as an absence record regardless of work day status
                    absentDetails.push({ 
                        id: approvedAbsence.id,
                        date: dateStr, 
                        reason: approvedAbsence.reason || t('manual_absence'),
                        isManual: true
                    });
                } else if (!isWeekend && !isHoliday) {
                    totalWorkingDaysPassed++;
                    
                    const hasReport = workMap.has(`${rep.name}-${dateStr}`);
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
        }

        return {
            repName: rep.name,
            repUsername: rep.username,
            totalWorkingDaysPassed,
            daysWorked,
            absentDays: absentDetails.length,
            absentDetailsList: absentDetails
        };
    });

    return stats;
  }, [selectedVacationMonth, systemSettings, allReports, reps, repAbsences, t]);

  const pendingLeaveRequests = useMemo(() => {
      return repAbsences.filter(a => a.status === 'PENDING').map(req => {
          const rep = reps.find(r => r.id === req.repId);
          return {
              ...req,
              repName: rep?.name || t('unknown'),
              repUsername: rep?.username || ''
          };
      });
  }, [repAbsences, reps, t]);
  
  // Calculate Filtered Reports Stats
  const filteredStats = useMemo(() => {
    const total = filteredReports.length;
    const doctorVisits = filteredReports.filter(r => r.type === 'DOCTOR_VISIT').length;
    const pharmacyVisits = filteredReports.filter(r => r.type === 'PHARMACY_VISIT').length;
    const uniqueDays = new Set(filteredReports.map(r => new Date(r.date).toDateString())).size;
    const avgPerDay = uniqueDays > 0 ? (total / uniqueDays).toFixed(1) : "0";

    return { total, doctorVisits, pharmacyVisits, avgPerDay, uniqueDays };
  }, [filteredReports]);


  const handleFrequencyClick = (repName: string, freqType: 'f0' | 'f1' | 'f2' | 'f3') => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const rep = reps.find(r => r.name === repName);
      if (!rep) return;

      const visitCounts: Record<string, { count: number, region: string, specialization: string }> = {};
      const lastVisitDates = new Map<string, string>();

      // 1. Get visited doctors from reports
      // Filter for this month for frequency count
      const reports = allReports.filter(visit => {
          const visitDate = new Date(visit.date);
          return visitDate >= startOfMonth && visitDate <= today && visit.type === 'DOCTOR_VISIT' && visit.repName === repName;
      });

      // Calculate counts for this month
      reports.forEach(visit => {
          const key = visit.targetName;
          if (!visitCounts[key]) {
              visitCounts[key] = { count: 0, region: visit.regionName, specialization: visit.targetSpecialization || '' };
          }
          visitCounts[key].count++;
      });

      // 2. Get LAST VISIT DATE from *all* reports (not just this month)
      // Since allReports is sorted descending by date, the first entry for a doctor is the latest
      allReports.forEach(visit => {
          if (visit.type === 'DOCTOR_VISIT' && visit.repName === repName) {
              if (!lastVisitDates.has(visit.targetName)) {
                  lastVisitDates.set(visit.targetName, visit.date);
              }
          }
      });
      
      // 3. Get ALL doctors for this rep to check for 0 visits
      const repDoctors = totalDoctors.filter(d => d.repId === rep.id);
      
      const allDoctorsStatus = repDoctors.map(doc => {
          const visitedData = visitCounts[doc.name];
          const regionName = regions.find(r => r.id === doc.regionId)?.name || t('unknown');
          return {
              name: doc.name,
              region: regionName,
              specialization: doc.specialization,
              visits: visitedData ? visitedData.count : 0,
              lastVisitDate: lastVisitDates.get(doc.name) || null
          };
      });

      const filteredDoctors = allDoctorsStatus.filter(data => {
              if (freqType === 'f0') return data.visits === 0;
              if (freqType === 'f1') return data.visits === 1;
              if (freqType === 'f2') return data.visits === 2;
              if (freqType === 'f3') return data.visits >= 3;
              return false;
          });
      
      let freqLabel = '';
      if (freqType === 'f0') freqLabel = t('freq_0_mo');
      else if (freqType === 'f1') freqLabel = t('freq_1_mo');
      else if (freqType === 'f2') freqLabel = t('freq_2_mo');
      else freqLabel = t('freq_3_mo');

      setSelectedFrequencyDetails({
          title: t('frequency_details_title', repName, freqLabel),
          doctors: filteredDoctors,
          repName: repName,
          frequencyLabel: freqLabel
      });
      setIsFrequencyDetailModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskDescription || selectedRepsForTask.length === 0) return;

      setIsCreatingTask(true);
      setTaskCreationMessage(null);
      try {
          const promises = selectedRepsForTask.map(repId => api.createTask(repId, newTaskDescription));
          const newTasks = await Promise.all(promises);
          
          setAllTasks(prev => [...newTasks, ...prev]);
          setTaskCreationMessage({ text: t('task_created_success'), type: 'success' });
          setNewTaskDescription('');
          setSelectedRepsForTask([]);
      } catch (error) {
          console.error("Failed to create task", error);
          setTaskCreationMessage({ text: t('error_unexpected'), type: 'error' });
      } finally {
          setIsCreatingTask(false);
          setTimeout(() => setTaskCreationMessage(null), 3000);
      }
  };

  const toggleRepSelection = (repId: string) => {
      setSelectedRepsForTask(prev => 
          prev.includes(repId) 
              ? prev.filter(id => id !== repId) 
              : [...prev, repId]
      );
  };

  const toggleSelectAll = () => {
      if (selectedRepsForTask.length === reps.length) {
          setSelectedRepsForTask([]);
      } else {
          setSelectedRepsForTask(reps.map(r => r.id));
      }
  };

  const handleDeleteTask = async (taskId: string) => {
      try {
          await api.deleteTask(taskId);
          setAllTasks(prev => prev.filter(t => t.id !== taskId));
      } catch (error) {
          console.error("Failed to delete task", error);
      }
  };


  const handleReviewPlan = async (repId: string, status: 'approved' | 'rejected') => {
      try {
          await api.reviewRepPlan(repId, status);
          setAllPlans(prevPlans => ({
              ...prevPlans,
              [repId]: { ...prevPlans[repId], status: status }
          }));

          const repName = reps.find(r => r.id === repId)?.name || '';
          const messageKey = status === 'approved' ? 'plan_approved_success' : 'plan_rejected_success';
          setReviewMessage({ text: t(messageKey, repName), type: 'success' });

      } catch (error) {
          console.error(`Failed to ${status} plan for rep ${repId}`, error);
          setReviewMessage({ text: t('plan_review_error'), type: 'error' });
      } finally {
          setTimeout(() => setReviewMessage(null), 3000);
      }
  };

  const handleRevokeApproval = async (repId: string) => {
      if (!user || user.role !== UserRole.Manager) {
          console.warn("Only managers can revoke plan approval.");
          setReviewMessage({ text: t('error_permission_denied'), type: 'error' });
          setTimeout(() => setReviewMessage(null), 3000);
          return;
      }
      try {
          await api.revokePlanApproval(repId);
          setAllPlans(prevPlans => ({
              ...prevPlans,
              [repId]: { ...prevPlans[repId], status: 'draft' }
          }));

          const repName = reps.find(r => r.id === repId)?.name || '';
          setReviewMessage({ text: t('plan_revoked_success', repName), type: 'success' });

      } catch (error) {
          console.error(`Failed to revoke approval for rep ${repId}`, error);
          setReviewMessage({ text: t('plan_revoke_error'), type: 'error' });
      } finally {
          setTimeout(() => setReviewMessage(null), 3000);
      }
  };

  const handleResetClick = (rep: User) => {
      if (user?.role !== UserRole.Manager) {
          setReviewMessage({ text: t('error_permission_denied'), type: 'error' });
          setTimeout(() => setReviewMessage(null), 3000);
          return;
      }
      setRepToReset(rep);
      setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
      if (!repToReset) return;

      setIsResetting(true);
      try {
          await api.resetRepData(repToReset.id);
          setReviewMessage({ text: t('reset_success', repToReset.name), type: 'success' });
          await fetchInitialData();
      } catch (error: any) {
          console.error("Failed to reset rep data:", error);
          const errorMessage = error.message.includes('permission denied') 
                               ? t('error_permission_denied') 
                               : t('reset_error', repToReset.name);
          setReviewMessage({ text: errorMessage, type: 'error' });
      } finally {
          setIsResetting(false);
          setIsResetModalOpen(false);
          setRepToReset(null);
          setTimeout(() => setReviewMessage(null), 3000);
      }
  };


  const handleResetFilters = () => {
    setSelectedRep('all');
    setSelectedRegion('all');
    setStartDate('');
    setEndDate('');
    setSelectedQuickFilter('today');
    setIsReportExpanded(false);
  }

  const handleQuickFilterClick = (filter: 'today' | 'currentWeek' | 'currentMonth') => {
    if (filter === 'today') {
      const today = getTodayDateString();
      setStartDate(today);
      setEndDate(today);
    } else if (filter === 'currentWeek') {
      const { start, end } = getCurrentWeekDateStrings(t);
      setStartDate(start);
      setEndDate(end);
    } else if (filter === 'currentMonth') {
      const { start, end } = getCurrentMonthDateStrings();
      setStartDate(start);
      setEndDate(end);
    }
    setSelectedQuickFilter(filter);
  };
  
  const handleToggleReportExpand = () => {
      const newExpandedState = !isReportExpanded;
      setIsReportExpanded(newExpandedState);
      
      if (newExpandedState) {
          handleQuickFilterClick('currentWeek');
      } else {
          handleQuickFilterClick('today');
          setSelectedRep('all');
          setSelectedRegion('all');
      }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setSelectedQuickFilter('none');
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setSelectedQuickFilter('none');
  };

  const handleExportUsers = () => {
    exportUsersToExcel(reps, 'representatives_list', t);
  };

  const handleRepSelectionChange = (repId: string) => {
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
      'reps_client_lists',
      t
    );
    
    setIsExportModalOpen(false);
    setSelectedRepsForExport([]);
  };

  const handleExportVacationStats = () => {
      exportVacationStatsToExcel(vacationStats, `vacation_stats_${selectedVacationMonth}`, t);
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
      setIsSavingSettings(true);
      setSettingsMessage(''); 

      if (!systemSettings) {
          setSettingsMessage(t('settings_saved_error'));
          setIsSavingSettings(false);
          return;
      }
      const newSettings = { weekends: localWeekends, holidays: localHolidays };
      try {
          await api.updateSystemSettings(newSettings);
          setSystemSettings(newSettings);
          setSettingsMessage(t('settings_saved_success'));
          setTimeout(() => setSettingsMessage(''), 3000);
      } catch (error: any) {
          console.error("Failed to save settings:", error);
          setSettingsMessage(error.message ? t(error.message) : t('settings_saved_error'));
          setTimeout(() => setSettingsMessage(''), 5000);
      } finally {
          setIsSavingSettings(false);
      }
  };

  const handleAddUserClick = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUserClick = (userToEdit: User) => {
    setEditingUser(userToEdit);
    setIsUserModalOpen(true);
  };

  const handleUserModalSuccess = () => {
    setIsUserModalOpen(false);
    setEditingUser(null);
    fetchInitialData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      fetchInitialData();
    } catch (error) {
      console.error("Failed to delete user", error);
    } finally {
      setIsDeleting(false);
    }
  };

    const getPlanStatusBadge = (status: WeeklyPlan['status']) => {
        const statusMap = {
            draft: { textKey: 'plan_status_draft', color: 'bg-blue-100 text-blue-800' },
            pending: { textKey: 'plan_status_pending', color: 'bg-yellow-100 text-yellow-800' },
            approved: { textKey: 'plan_status_approved', color: 'bg-green-100 text-green-800' },
            rejected: { textKey: 'plan_status_rejected', color: 'bg-red-100 text-red-800' },
        };
        if (!statusMap[status]) return null;
        const { textKey, color } = statusMap[status];
        return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${color}`}>{t(textKey)}</span>;
    };
    
    const handleAbsentDaysClick = (repName: string, details: { id?: number; date: string; reason: string; isManual: boolean }[]) => {
      setSelectedAbsentDetails({ repName, details });
      setIsAbsentDetailModalOpen(true);
    };

    const handleOpenAbsenceModal = () => {
      setIsRegisterAbsenceModalOpen(true);
      setAbsenceReasonSelect('');
      setAbsenceReasonText('');
      setRegisterAbsenceMessage('');
    }

    const handleRegisterAbsenceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!absenceFormRepId || !absenceFormDate) return;

        // Prevent duplicates locally if possible
        const existing = repAbsences.find(a => a.repId === absenceFormRepId && a.date === absenceFormDate && a.status === 'APPROVED');
        if (existing) {
            setRegisterAbsenceMessage(t('absence_already_exists'));
            return;
        }
        
        const finalReason = absenceReasonSelect === 'Other' ? absenceReasonText : (absenceReasonSelect ? t(absenceReasonSelect) : '');

        setIsRegisteringAbsence(true);
        setRegisterAbsenceMessage('');
        try {
            // Manager registration always sets status to APPROVED
            const newAbsence = await api.addRepAbsence(absenceFormRepId, absenceFormDate, finalReason, 'APPROVED');
            setRepAbsences(prev => [...prev, newAbsence]);
            setRegisterAbsenceMessage(t('absence_added_success'));
            // Reset fields but keep modal open for a moment
            setAbsenceReasonSelect('');
            setAbsenceReasonText('');
            setTimeout(() => {
                setIsRegisterAbsenceModalOpen(false);
                setRegisterAbsenceMessage('');
            }, 1000);
        } catch (error: any) {
            console.error("Failed to add absence", error);
            // Display actual error message from backend if available, otherwise generic
            setRegisterAbsenceMessage(error.message || t('error_unexpected'));
        } finally {
            setIsRegisteringAbsence(false);
        }
    };
    
    const handleLeaveStatusUpdate = async (id: number, status: 'APPROVED' | 'REJECTED') => {
        setPendingLeaveMessage('');
        try {
            await api.updateRepAbsenceStatus(id, status);
            setRepAbsences(prev => prev.map(a => a.id === id ? { ...a, status } : a));
            setPendingLeaveMessage(status === 'APPROVED' ? t('request_approved_success') : t('request_rejected_success'));
        } catch (error) {
            console.error("Failed to update leave status", error);
            setPendingLeaveMessage(t('status_update_error'));
        } finally {
            setTimeout(() => setPendingLeaveMessage(''), 3000);
        }
    };


    // Callback to refresh data after deleting an absence
    const handleAbsenceUpdate = () => {
        api.getRepAbsences().then(setRepAbsences);
    };


  if (loading) {
    return <Spinner />;
  }
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const pendingPlansCount = pendingPlans.length;

  return (
    <div className="container mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-blue-800">
        {t(user?.role === UserRole.Manager ? 'manager_dashboard_title' : 'supervisor_dashboard_title')}
      </h2>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200/80">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
              {/* ... Tabs Buttons ... */}
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('reports')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'reports' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <ChartBarIcon className="w-5 h-5 me-2" />
                      {t('reports')}
                  </button>
              </li>
               <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('rep_performance')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'rep_performance' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <UserGroupIcon className="w-5 h-5 me-2" />
                      {t('rep_performance_view')}
                  </button>
              </li>
              {user?.role === UserRole.Manager && (
                <>
                  <li className="me-2">
                      <button 
                          onClick={() => setActiveTab('users')}
                          className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'users' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                      >
                          <UsersIcon className="w-5 h-5 me-2" />
                          {t('user_management')}
                      </button>
                  </li>
                   <li className="me-2">
                        <button 
                            onClick={() => setActiveTab('clients')}
                            className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'clients' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                        >
                            <UserGroupIcon className="w-5 h-5 me-2" />
                            {t('client_management')}
                        </button>
                    </li>
                    <li className="me-2">
                        <button 
                            onClick={() => setActiveTab('tasks')}
                            className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'tasks' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                        >
                            <ClipboardListIcon className="w-5 h-5 me-2" />
                            {t('tasks_tab')}
                        </button>
                    </li>
                  <li className="me-2">
                      <button 
                          onClick={() => setActiveTab('dataImport')}
                          className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'dataImport' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                      >
                          <UploadIcon className="w-5 h-5 me-2" />
                          {t('data_import')}
                      </button>
                  </li>
                </>
              )}
               <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('approvals')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'approvals' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <MapPinIcon className="w-5 h-5 me-2" />
                      {t('plan_approvals')} {pendingPlans.length > 0 && <span className="bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ms-2">{pendingPlans.length}</span>}
                  </button>
              </li>
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('weeklyPlans')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'weeklyPlans' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <CalendarIcon className="w-5 h-5 me-2" />
                      {t('view_weekly_plans')}
                  </button>
              </li>
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('vacations')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'vacations' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <SunIcon className="w-5 h-5 me-2" />
                      {t('vacations')} {pendingLeaveRequests.length > 0 && <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ms-2">{pendingLeaveRequests.length}</span>}
                  </button>
              </li>
              {user?.role === UserRole.Manager && (
                <li className="me-2">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'settings' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                    >
                        <CogIcon className="w-5 h-5 me-2" />
                        {t('system_settings')}
                    </button>
                </li>
              )}
          </ul>
      </div>

      {activeTab === 'reports' && (
        <>
          {/* Welcome Widget ... */}
          <div className="animate-fade-in-up bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-6 rounded-2xl shadow-lg border border-white/50 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                  <h3 className="text-2xl font-bold">{t('welcome_manager', user?.name || '')}</h3>
                  <p className="opacity-90">{t('today_is', formattedDate)}</p>
              </div>
              {pendingPlansCount > 0 ? (
                  <div className="text-center bg-white/10 p-3 rounded-lg">
                      <p className="font-semibold">{t('you_have_pending_plans', pendingPlansCount)}</p>
                      <button
                          onClick={() => setActiveTab('approvals')}
                          className="mt-2 bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm"
                      >
                          {t('view_plans')}
                      </button>
                  </div>
              ) : (
                  <p className="font-semibold bg-white/10 p-3 rounded-lg">{t('no_pending_plans')}</p>
              )}
          </div>

          {/* Monthly Summary Stats ... */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            {/* ... (Same stats cards) ... */}
             <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
              <div className="bg-purple-500/20 text-purple-700 p-4 rounded-full me-4">
                <ChartBarIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">{t('total_visits_this_month')}</p>
                <p className="text-4xl font-bold text-purple-800">{monthlySummaryStats.totalVisitsThisMonth}</p>
              </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
              <div className="bg-teal-500/20 text-teal-700 p-4 rounded-full me-4">
                <UserGroupIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">{t('unique_clients_this_month')}</p>
                <p className="text-4xl font-bold text-teal-800">{monthlySummaryStats.uniqueClientsThisMonth}</p>
              </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center">
              <div className="bg-sky-500/20 text-sky-700 p-4 rounded-full me-4">
                <GraphIcon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-600 text-sm font-medium">{t('average_visits_per_month_historical')}</p>
                <p className="text-4xl font-bold text-sky-800">{monthlySummaryStats.averageVisitsPerMonth}</p>
              </div>
            </div>
          </div>

          {/* Daily Visits Card ... */}
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <h3 className="text-xl font-semibold mb-4 text-blue-700">{t('daily_visits')}</h3>
                <div className="flex border-b border-slate-300/50 mb-4 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setSelectedRepForDailyVisits('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${selectedRepForDailyVisits === 'all' ? 'bg-white/50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:bg-slate-200/50 border-b-2 border-transparent'}`}
                    >
                        {t('all')}
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
                          <span>{t('doctors')}</span>
                        </p>
                    </div>
                    <div className="h-16 w-px bg-slate-300"></div> {/* Divider */}
                    <div>
                        <p className="text-5xl font-bold text-orange-800">{dailyVisitCounts.pharmacyVisits}</p>
                        <p className="text-md font-semibold text-slate-700 flex items-center justify-center gap-1 mt-1">
                          <PharmacyIcon className="w-5 h-5 text-orange-600"/>
                          <span>{t('pharmacies')}</span>
                        </p>
                    </div>
                </div>
                <div>
                    <button
                        onClick={() => setIsDailyVisitsDetailModalOpen(true)}
                        className="mt-4 w-full bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                    >
                        <EyeIcon className="w-5 h-5"/>
                        {t('view_details')}
                    </button>
                </div>
            </div>

          {/* Stats Cards ... */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
             {/* ... (Keep existing cards) ... */}
             <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4"><CalendarIcon className="w-8 h-8" /></div>
                <div><p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_monthly_visits' : 'monthly_visits_for', selectedRep)}</p><p className="text-4xl font-bold text-blue-800">{displayedStats.visitsThisMonth}</p></div>
               </div>
               <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4"><DoctorIcon className="w-8 h-8" /></div>
                <div><p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_doctors' : 'doctors_of', selectedRep)}</p><p className="text-4xl font-bold text-green-800">{displayedStats.doctorCount}</p></div>
               </div>
               <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                <div className="bg-orange-500/20 text-orange-700 p-4 rounded-full me-4"><PharmacyIcon className="w-8 h-8" /></div>
                <div><p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_pharmacies' : 'pharmacies_of', selectedRep)}</p><p className="text-4xl font-bold text-orange-800">{displayedStats.pharmacyCount}</p></div>
               </div>
               <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                <div className="bg-red-500/20 text-red-700 p-4 rounded-full me-4"><WarningIcon className="w-8 h-8" /></div>
                <div><p className="text-slate-600 text-sm font-medium">{t('overdue_visits')}</p><p className="text-4xl font-bold text-red-800">{filteredAlerts.length}</p></div>
               </div>
          </div>

          {/* Visits Frequency Card */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '650ms' }}>
                <div className="flex items-center mb-4">
                    <div className="bg-indigo-500/20 text-indigo-700 p-3 rounded-full me-3">
                        <GraphIcon className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 text-md font-medium">{t('visit_frequency_monthly')}</p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-100/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-start">{t('rep_name')}</th>
                                <th scope="col" className="px-4 py-3 text-red-800">{t('freq_0_mo')}</th>
                                <th scope="col" className="px-4 py-3 text-slate-800">{t('freq_1_mo')}</th>
                                <th scope="col" className="px-4 py-3 text-blue-800">{t('freq_2_mo')}</th>
                                <th scope="col" className="px-4 py-3 text-green-800">{t('freq_3_mo')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                            {repFrequencyStats.map((stat, idx) => (
                                <tr key={idx} className="hover:bg-white/40 transition-colors">
                                    <td className="px-4 py-3 font-medium text-slate-900 text-start">{stat.name}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleFrequencyClick(stat.name, 'f0')} className="font-bold text-red-700 hover:text-red-900 hover:underline">
                                            {stat.f0}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleFrequencyClick(stat.name, 'f1')} className="font-bold text-slate-600 hover:text-blue-600 hover:underline">
                                            {stat.f1}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleFrequencyClick(stat.name, 'f2')} className="font-bold text-blue-700 hover:text-blue-900 hover:underline">
                                            {stat.f2}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleFrequencyClick(stat.name, 'f3')} className="font-bold text-green-700 hover:text-green-900 hover:underline">
                                            {stat.f3}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {repFrequencyStats.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-4 text-center text-slate-500 italic">{t('no_data')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* List Summary Card ... */}
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                {/* ... content from previous update ... */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center">
                        <div className="bg-pink-500/20 text-pink-700 p-3 rounded-full me-3"><ClipboardListIcon className="w-6 h-6" /></div>
                        <div><h3 className="text-xl font-semibold text-blue-800">{t('clients_list_summary')}</h3><p className="text-sm text-slate-600 mt-1">{t('total_doctors')}: <span className="font-bold text-slate-800">{totalDoctors.length}</span></p></div>
                    </div>
                    <button onClick={() => setIsListCardExpanded(!isListCardExpanded)} className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors border border-slate-300 px-3 py-1.5 rounded-lg bg-white/50 hover:bg-white">
                        {isListCardExpanded ? (<>{t('less_details')}<ChevronUpIcon className="w-4 h-4" /></>) : (<>{t('more_details')}<ChevronDownIcon className="w-4 h-4" /></>)}
                    </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                     {Object.entries(totalSpecializationCounts).map(([spec, count]) => (
                        <span key={spec} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/60 text-slate-700 border border-white/60 shadow-sm">
                            <span className="opacity-70 me-1">{t(spec)}:</span><span className="font-bold">{count}</span>
                        </span>
                    ))}
                </div>
                {isListCardExpanded && (
                    <div className="mt-6 border-t border-slate-300/50 pt-4 animate-fade-in">
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                             {clientStatsByRep.map(stat => (
                                <div key={stat.rep.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/30 p-3 rounded-lg border border-white/40 hover:bg-white/50 transition-colors">
                                    <div className="font-bold text-slate-800 mb-2 sm:mb-0 sm:w-1/4 truncate" title={stat.rep.name}>{stat.rep.name}</div>
                                    <div className="flex flex-wrap gap-2 flex-grow sm:justify-end">
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold border border-blue-200">{t('total')}: {stat.doctorCount}</span>
                                        {Object.entries(stat.specializationCounts).map(([spec, count]) => (
                                            <span key={spec} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full border border-slate-200">{t(spec)}: <span className="font-bold text-slate-800">{count}</span></span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

          {/* Analytics Charts ... */}
          <AnalyticsCharts reports={filteredReports} />

          {/* Filters Section ... */}
          <div className="bg-white/40 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/50 mb-8 transition-all duration-300 ease-in-out">
             {/* ... content from previous update ... */}
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center text-blue-700"><FilterIcon className="w-5 h-5 me-2"/>{t('filter_options')}</h3>
                <button onClick={handleToggleReportExpand} className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-orange-600 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-orange-200">
                    {isReportExpanded ? (<>{t('show_less_options')}<ChevronUpIcon className="w-4 h-4" /></>) : (<>{t('show_more_options')}<ChevronDownIcon className="w-4 h-4" /></>)}
                </button>
            </div>
            {isReportExpanded && (
                <div className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                        <select value={selectedRep} onChange={e => setSelectedRep(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500">
                            <option value="all">{t('all_reps')}</option>
                            {reps.map(rep => <option key={rep.id} value={rep.name}>{rep.name}</option>)}
                        </select>
                        <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500">
                            <option value="all">{t('all_regions')}</option>
                            {regions.map(region => <option key={region.id} value={region.name}>{region.name}</option>)}
                        </select>
                        <input type="date" value={startDate} onChange={handleStartDateChange} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" placeholder={t('from_date')} />
                        <input type="date" value={endDate} onChange={handleEndDateChange} className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" placeholder={t('to_date')} />
                        <button onClick={handleResetFilters} className="w-full bg-slate-500 text-white p-2 rounded-md hover:bg-slate-600 transition-colors">{t('reset')}</button>
                    </div>
                    <div className="pt-4 border-t border-slate-300/50">
                        <h4 className="text-md font-semibold mb-2 text-slate-700">{t('quick_filters')}</h4>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleQuickFilterClick('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'today' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{t('today')}</button>
                            <button onClick={() => handleQuickFilterClick('currentWeek')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'currentWeek' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{t('current_week')}</button>
                            <button onClick={() => handleQuickFilterClick('currentMonth')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'currentMonth' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{t('current_month')}</button>
                        </div>
                    </div>
                </div>
            )}
            {!isReportExpanded && (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    <CheckIcon className="w-4 h-4 text-green-600" /><span>{t('showing_today_reports_only')}</span>
                </div>
            )}
          </div>

          {/* Filtered Reports Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 animate-fade-in">
                <div className="bg-white/40 border border-white/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:bg-white/60 transition-colors">
                    <span className="text-xs text-slate-500 font-medium uppercase mb-1">{t('total')}</span>
                    <span className="text-2xl font-bold text-slate-800">{filteredStats.total}</span>
                </div>
                <div className="bg-white/40 border border-white/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:bg-white/60 transition-colors">
                    <span className="text-xs text-blue-600 font-medium uppercase mb-1 flex items-center gap-1"><DoctorIcon className="w-3 h-3"/> {t('doctors')}</span>
                    <span className="text-2xl font-bold text-blue-700">{filteredStats.doctorVisits}</span>
                </div>
                <div className="bg-white/40 border border-white/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:bg-white/60 transition-colors">
                    <span className="text-xs text-orange-600 font-medium uppercase mb-1 flex items-center gap-1"><PharmacyIcon className="w-3 h-3"/> {t('pharmacies')}</span>
                    <span className="text-2xl font-bold text-orange-700">{filteredStats.pharmacyVisits}</span>
                </div>
                <div className="bg-white/40 border border-white/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:bg-white/60 transition-colors">
                     <span className="text-xs text-purple-600 font-medium uppercase mb-1">{t('active_days')}</span>
                    <span className="text-2xl font-bold text-purple-700">{filteredStats.uniqueDays}</span>
                </div>
                <div className="bg-white/40 border border-white/50 p-3 rounded-xl flex flex-col items-center justify-center shadow-sm hover:bg-white/60 transition-colors col-span-2 md:col-span-1">
                    <span className="text-xs text-teal-600 font-medium uppercase mb-1">{t('avg_per_day')}</span>
                    <span className="text-2xl font-bold text-teal-700">{filteredStats.avgPerDay}</span>
                </div>
            </div>

          {/* Alerts Table ... */}
          {filteredAlerts.length > 0 && (
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden mb-8">
              <h3 className="text-xl font-semibold p-4 flex items-center text-red-700 bg-red-100/50"><WarningIcon className="w-6 h-6 me-3"/>{t('overdue_visits_alerts_table')} ({filteredAlerts.length})</h3>
              <div className="flex justify-center p-4"><button onClick={() => setIsOverdueClientsDetailModalOpen(true)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"><EyeIcon className="w-5 h-5" />{t('view_details')}</button></div>
            </div>
          )}
          
          {/* Export Buttons ... */}
          <div className="flex flex-col sm:flex-row justify-end items-center mb-4 gap-3">
                <span className="text-slate-700 font-medium">{t('export_reports', filteredReports.length)}</span>
                <button onClick={() => exportToExcel(filteredReports, 'reports', t)} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"><DownloadIcon className="w-5 h-5 me-2"/> Excel</button>
                <button onClick={() => exportToPdf(filteredReports, 'reports', t)} className="w-full sm:w-auto flex items-center justify-center bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 transition-colors"><DownloadIcon className="w-5 h-5 me-2"/> PDF</button>
            </div>

          {/* Reports Table ... */}
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start text-gray-500">
                <thead className="text-xs text-blue-800 uppercase bg-white/50">
                  <tr><th className="px-6 py-3">{t('date')}</th><th className="px-6 py-3">{t('visit_type')}</th><th className="px-6 py-3">{t('rep')}</th><th className="px-6 py-3">{t('region')}</th><th className="px-6 py-3">{t('client')}</th><th className="px-6 py-3">{t('target_specialization')}</th><th className="px-6 py-3">{t('product')}</th><th className="px-6 py-3">{t('doctor_visit_type')}</th><th className="px-6 py-3">{t('notes')}</th></tr>
                </thead>
                <tbody>
                  {filteredReports.map((report, index) => (
                    <tr key={report.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40 animate-fade-in-up" style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}>
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(report.date).toLocaleDateString(t('locale'))}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${report.type === 'DOCTOR_VISIT' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{t(report.type)}</span></td>
                      <td className="px-6 py-4 font-medium text-slate-900">{report.repName}</td>
                      <td className="px-6 py-4">{report.regionName}</td>
                      <td className="px-6 py-4">{report.targetName}</td>
                      <td className="px-6 py-4">{report.targetSpecialization ? t(report.targetSpecialization) : '-'}</td>
                      <td className="px-6 py-4">{report.productName || '-'}</td>
                      <td className="px-6 py-4">{report.visitType ? t(report.visitType) : '-'}</td>
                      <td className="px-6 py-4 max-w-xs truncate" title={report.notes}>{report.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReports.length === 0 && <p className="text-center p-8 text-slate-600">{t('no_matching_reports')}</p>}
            </div>
          </div>
        </>
      )}

      {/* NEW: Rep Performance Tab */}
      {activeTab === 'rep_performance' && (
          <div className="space-y-6">
              <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
                   <h3 className="text-xl font-semibold mb-6 text-blue-800 flex items-center gap-2">
                        <ChartBarIcon className="w-6 h-6" />
                        {t('rep_performance_view')}
                    </h3>
                    
                    <div className="mb-6 max-w-md">
                        <label htmlFor="repAnalysisSelect" className="block text-sm font-medium text-slate-700 mb-2">{t('select_rep_to_view')}</label>
                        <select
                            id="repAnalysisSelect"
                            value={selectedRepForAnalysis}
                            onChange={(e) => setSelectedRepForAnalysis(e.target.value)}
                            className="w-full p-2.5 bg-white/50 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                        >
                            <option value="">{t('select_rep')}</option>
                            {reps.map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.name}</option>
                            ))}
                        </select>
                    </div>

                    {repSpecificStats ? (
                        <div className="space-y-8 animate-fade-in">
                            {/* Top Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 shadow-sm">
                                    <p className="text-sm text-blue-600 font-medium mb-1">{t('visits_this_month')}</p>
                                    <p className="text-3xl font-bold text-blue-800">{repSpecificStats.monthlyVisitsCount}</p>
                                </div>
                                <div className="bg-green-50/80 p-4 rounded-xl border border-green-100 shadow-sm">
                                    <p className="text-sm text-green-600 font-medium mb-1">{t('total_clients')}</p>
                                    <p className="text-3xl font-bold text-green-800">{repSpecificStats.totalAssigned}</p>
                                    <p className="text-xs text-green-600 mt-1">{repSpecificStats.assignedDoctorsCount} {t('doctors')} / {repSpecificStats.assignedPharmaciesCount} {t('pharmacies')}</p>
                                </div>
                                <div className="bg-purple-50/80 p-4 rounded-xl border border-purple-100 shadow-sm">
                                    <p className="text-sm text-purple-600 font-medium mb-1">{t('coverage_percentage')}</p>
                                    <p className="text-3xl font-bold text-purple-800">{repSpecificStats.coveragePercent}%</p>
                                    <p className="text-xs text-purple-600 mt-1">{t('coverage_info')}</p>
                                </div>
                                <div className="bg-orange-50/80 p-4 rounded-xl border border-orange-100 shadow-sm">
                                    <p className="text-sm text-orange-600 font-medium mb-1">{t('visits_per_working_day')}</p>
                                    <p className="text-3xl font-bold text-orange-800">{repSpecificStats.avgPerDay}</p>
                                    <p className="text-xs text-orange-600 mt-1">{t('this_month')}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Charts Section */}
                                <div>
                                    <h4 className="text-lg font-semibold text-slate-700 mb-3">{t('visit_distribution')}</h4>
                                    <div className="bg-white/50 p-4 rounded-xl shadow-sm border border-slate-200">
                                         <AnalyticsCharts reports={repSpecificStats.monthlyVisits} />
                                    </div>
                                </div>
                                
                                {/* Frequency Section */}
                                <div>
                                    <h4 className="text-lg font-semibold text-slate-700 mb-3">{t('visit_frequency_monthly')}</h4>
                                     <div className="bg-white/50 p-4 rounded-xl shadow-sm border border-slate-200">
                                        <div className="grid grid-cols-2 gap-4">
                                            {repFrequencyStats.filter(s => s.name === reps.find(r => r.id === selectedRepForAnalysis)?.name).map((stat, idx) => (
                                                <React.Fragment key={idx}>
                                                    <div className="text-center p-3 bg-red-50 rounded-lg">
                                                        <p className="text-2xl font-bold text-red-700">{stat.f0}</p>
                                                        <p className="text-xs text-red-600 font-semibold">{t('freq_0_mo')}</p>
                                                        <button onClick={() => handleFrequencyClick(stat.name, 'f0')} className="text-[10px] text-red-500 underline mt-1">{t('view_details')}</button>
                                                    </div>
                                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                                        <p className="text-2xl font-bold text-slate-700">{stat.f1}</p>
                                                        <p className="text-xs text-slate-600 font-semibold">{t('freq_1_mo')}</p>
                                                        <button onClick={() => handleFrequencyClick(stat.name, 'f1')} className="text-[10px] text-blue-500 underline mt-1">{t('view_details')}</button>
                                                    </div>
                                                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                                                        <p className="text-2xl font-bold text-blue-700">{stat.f2}</p>
                                                        <p className="text-xs text-blue-600 font-semibold">{t('freq_2_mo')}</p>
                                                        <button onClick={() => handleFrequencyClick(stat.name, 'f2')} className="text-[10px] text-blue-500 underline mt-1">{t('view_details')}</button>
                                                    </div>
                                                    <div className="text-center p-3 bg-green-50 rounded-lg">
                                                        <p className="text-2xl font-bold text-green-700">{stat.f3}</p>
                                                        <p className="text-xs text-green-600 font-semibold">{t('freq_3_mo')}</p>
                                                        <button onClick={() => handleFrequencyClick(stat.name, 'f3')} className="text-[10px] text-green-500 underline mt-1">{t('view_details')}</button>
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Plan Status */}
                                    <div className="mt-6">
                                        <h4 className="text-lg font-semibold text-slate-700 mb-3">{t('weekly_plan')}</h4>
                                         <div className="bg-white/50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                                            <span className="text-slate-600 font-medium">{t('status')}</span>
                                            {getPlanStatusBadge(repSpecificStats.planStatus)}
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
                             <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                             <p className="text-slate-500">{t('select_rep_to_view')}</p>
                        </div>
                    )}
              </div>
          </div>
      )}

      {/* ... Other Tabs (Users, Clients, Tasks, DataImport, Approvals, WeeklyPlans, Settings) ... */}
      {/* (Content remains as previously provided, ensuring UserRegionsModal button is present in Users tab) */}
       {activeTab === 'users' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up"><div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4"><CalendarIcon className="w-8 h-8" /></div><div><p className="text-slate-600 text-sm font-medium">{t('total_visits_recorded')}</p><p className="text-4xl font-bold text-blue-800">{userManagementStats.totalVisits}</p></div></div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '150ms' }}><div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4"><UsersIcon className="w-8 h-8" /></div><div><p className="text-slate-600 text-sm font-medium">{t('total_unique_clients')}</p><p className="text-4xl font-bold text-green-800">{userManagementStats.totalUniqueClients}</p></div></div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '300ms' }}><div className="bg-purple-500/20 text-purple-700 p-4 rounded-full me-4"><ChartBarIcon className="w-8 h-8" /></div><div><p className="text-slate-600 text-sm font-medium">{t('avg_visits_per_month')}</p><p className="text-4xl font-bold text-purple-800">{userManagementStats.averageVisitsPerMonth}</p></div></div>
          </div>
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
              <div className="flex flex-wrap justify-between items-center p-4 bg-white/50 border-b border-white/30 gap-4">
                <h3 className="text-xl font-semibold flex items-center text-blue-800"><UsersIcon className="w-6 h-6 me-3"/>{t('reps_list')}</h3>
                <div className="flex items-center gap-3">
                  <button onClick={handleAddUserClick} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-all shadow flex items-center gap-2"><PlusIcon className="w-5 h-5"/><span>{t('add_rep')}</span></button>
                  <button onClick={() => { setSelectedRepsForExport([]); setIsExportModalOpen(true); }} disabled={reps.length === 0} className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-all shadow flex items-center gap-2 disabled:bg-teal-300 disabled:cursor-not-allowed"><DownloadIcon className="w-5 h-5"/><span className="hidden sm:inline">{t('download_client_lists')}</span></button>
                  <button onClick={handleExportUsers} disabled={reps.length === 0} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-all shadow flex items-center gap-2 disabled:bg-green-300 disabled:cursor-not-allowed"><DownloadIcon className="w-5 h-5"/><span className="hidden sm:inline">{t('download_reps_list')}</span></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start text-gray-500">
                      <thead className="text-xs text-blue-800 uppercase bg-white/50">
                          <tr><th className="px-6 py-3">{t('full_name')}</th><th className="px-6 py-3">{t('username')}</th><th className="px-6 py-3">{t('role')}</th><th className="px-6 py-3">{t('actions')}</th></tr>
                      </thead>
                      <tbody>
                          {reps.map(rep => (
                              <tr key={rep.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40">
                                  <td className="px-6 py-4 font-medium text-slate-900">{rep.name}</td><td className="px-6 py-4">{rep.username}</td><td className="px-6 py-4">{t(rep.role)}</td>
                                  <td className="px-6 py-4"><div className="flex items-center gap-4">
                                      <button onClick={() => { setUserForRegions(rep); setIsUserRegionsModalOpen(true); }} className="text-purple-600 hover:text-purple-800" aria-label={t('manage_regions')} title={t('manage_regions')}><MapPinIcon className="w-5 h-5"/></button>
                                      <button onClick={() => handleEditUserClick(rep)} className="text-blue-600 hover:text-blue-800" aria-label={t('edit')}><EditIcon className="w-5 h-5"/></button>
                                      {user?.role === UserRole.Manager && (<><button onClick={() => setDeletingUser(rep)} className="text-red-600 hover:text-red-800" aria-label={t('delete')}><TrashIcon className="w-5 h-5"/></button><button onClick={() => handleResetClick(rep)} className="text-orange-600 hover:text-orange-800" aria-label={t('reset_rep_visits')}><ReplyIcon className="w-5 h-5"/></button></>)}
                                  </div></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {reps.length === 0 && <p className="text-center p-8 text-slate-600">{t('no_data')}</p>}
              </div>
          </div>
        </>
      )}
      
      {activeTab === 'clients' && (
        <>
          {viewingRepClients ? (
            <RepClientManager 
              rep={viewingRepClients} 
              allDoctors={totalDoctors}
              allPharmacies={totalPharmacies}
              regions={regions}
              onBack={() => setViewingRepClients(null)}
              onDataChange={fetchInitialData}
            />
          ) : (
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
                <h3 className="text-xl font-semibold p-4 flex items-center text-blue-800 bg-white/50 border-b border-white/30"><UserGroupIcon className="w-6 h-6 me-3"/>{t('client_management')}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-start text-gray-500">
                        <thead className="text-xs text-blue-800 uppercase bg-white/50">
                            <tr><th className="px-6 py-3">{t('rep_name')}</th><th className="px-6 py-3">{t('doctors')}</th><th className="px-6 py-3">{t('pharmacies')}</th><th className="px-6 py-3">{t('total_clients')}</th><th className="px-6 py-3">{t('doctor_specialization_breakdown')}</th><th className="px-6 py-3">{t('actions')}</th></tr>
                        </thead>
                        <tbody>
                            {clientStatsByRep.map(stat => (
                                <tr key={stat.rep.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40">
                                    <td className="px-6 py-4 font-medium text-slate-900">{stat.rep.name}</td>
                                    <td className="px-6 py-4 text-center">{stat.doctorCount}</td>
                                    <td className="px-6 py-4 text-center">{stat.pharmacyCount}</td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-800">{stat.totalClients}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(stat.specializationCounts).length > 0 ? Object.entries(stat.specializationCounts).map(([spec, count]) => (<span key={spec} className="text-xs bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded-full">{t(spec as any)}: {count}</span>)) : <span className="text-xs text-slate-500">{t('no_doctors_assigned')}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => setViewingRepClients(stat.rep)} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors"><EyeIcon className="w-4 h-4"/>{t('view_clients')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {reps.length === 0 && <p className="text-center p-8 text-slate-600">{t('no_data')}</p>}
                </div>
            </div>
          )}
        </>
      )}
      
      {activeTab === 'tasks' && (
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
              <h3 className="text-xl font-semibold mb-6 text-blue-800 flex items-center gap-2"><ClipboardListIcon className="w-6 h-6" />{t('tasks_list')}</h3>
              <div className="bg-white/30 p-4 rounded-xl mb-8 border border-white/40"><h4 className="font-semibold text-lg mb-4 text-slate-700">{t('assign_new_task')}</h4><form onSubmit={handleCreateTask} className="flex flex-col md:flex-row gap-4 items-end"><div className="w-full md:w-1/3 relative"><label className="block text-sm font-medium text-slate-700 mb-1">{t('select_rep')}</label><div className="relative"><button type="button" onClick={() => setIsTaskRepDropdownOpen(!isTaskRepDropdownOpen)} className="w-full p-2.5 rounded-lg border border-slate-300 bg-white/50 text-start flex justify-between items-center focus:ring-blue-500"><span className={selectedRepsForTask.length === 0 ? "text-slate-500" : "text-slate-800"}>{selectedRepsForTask.length === 0 ? t('select_reps_placeholder') : t('reps_selected', selectedRepsForTask.length)}</span><ChevronDownIcon className="w-4 h-4 text-slate-500"/></button>{isTaskRepDropdownOpen && (<div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"><div className="p-2 border-b border-slate-100"><label className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" checked={selectedRepsForTask.length === reps.length && reps.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /><span className="ms-2 font-semibold text-sm text-slate-800">{t('select_all')}</span></label></div><div className="p-2 space-y-1">{reps.map(rep => (<label key={rep.id} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" checked={selectedRepsForTask.includes(rep.id)} onChange={() => toggleRepSelection(rep.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /><span className="ms-2 text-sm text-slate-700">{rep.name}</span></label>))}</div></div>)}</div></div><div className="w-full md:w-1/2"><label className="block text-sm font-medium text-slate-700 mb-1">{t('task_description')}</label><input type="text" value={newTaskDescription} onChange={e => setNewTaskDescription(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 bg-white/50 focus:ring-blue-500 focus:outline-none" required placeholder={t('task_description')} /></div><button type="submit" disabled={isCreatingTask} className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300">{isCreatingTask ? t('creating') : t('create_task')}</button></form>{taskCreationMessage && (<p className={`mt-3 text-sm font-medium ${taskCreationMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{taskCreationMessage.text}</p>)}</div>
              <div className="overflow-x-auto"><table className="w-full text-sm text-start"><thead className="text-xs text-blue-800 uppercase bg-white/50"><tr><th className="px-6 py-3">{t('task_description')}</th><th className="px-6 py-3">{t('rep_name')}</th><th className="px-6 py-3">{t('status')}</th><th className="px-6 py-3">{t('date')}</th><th className="px-6 py-3">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-200/50">{allTasks.map(task => (<tr key={task.id} className="bg-white/20 hover:bg-white/40"><td className="px-6 py-4 font-medium text-slate-800">{task.description}</td><td className="px-6 py-4">{task.repName}</td><td className="px-6 py-4">{task.isCompleted ? (<span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold flex items-center w-fit gap-1"><CheckCircleIcon className="w-3 h-3" /> {t('completed')}</span>) : (<span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold w-fit">{t('pending')}</span>)}</td><td className="px-6 py-4 text-slate-600">{new Date(task.createdAt).toLocaleDateString()}{task.completedAt && (<div className="text-xs text-green-700 mt-1">{t('task_completed_at', new Date(task.completedAt).toLocaleDateString())}</div>)}</td><td className="px-6 py-4"><button onClick={() => handleDeleteTask(task.id)} className="text-red-600 hover:text-red-800" title={t('delete_task')}><TrashIcon className="w-5 h-5" /></button></td></tr>))}{allTasks.length === 0 && (<tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">{t('no_tasks')}</td></tr>)}</tbody></table></div>
          </div>
      )}

      {activeTab === 'vacations' && (
        <div className="space-y-6">
            {/* Pending Requests Section */}
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
                <h3 className="text-xl font-semibold mb-4 text-blue-800 flex items-center gap-2">
                    <ClipboardListIcon className="w-6 h-6" />
                    {t('pending_requests')}
                    {pendingLeaveRequests.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{pendingLeaveRequests.length}</span>}
                </h3>
                
                {pendingLeaveMessage && (
                    <div className="mb-4 p-2 bg-blue-100 text-blue-800 rounded-lg text-sm">{pendingLeaveMessage}</div>
                )}

                {pendingLeaveRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-start">
                            <thead className="text-xs text-blue-800 uppercase bg-white/50">
                                <tr>
                                    <th className="px-6 py-3">{t('rep_name')}</th>
                                    <th className="px-6 py-3">{t('rep_code')}</th>
                                    <th className="px-6 py-3">{t('date')}</th>
                                    <th className="px-6 py-3">{t('leave_type')}</th>
                                    <th className="px-6 py-3 text-center">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/50">
                                {pendingLeaveRequests.map(req => (
                                    <tr key={req.id} className="bg-white/20 hover:bg-white/40">
                                        <td className="px-6 py-4 font-medium text-slate-900">{req.repName}</td>
                                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">{req.repUsername}</td>
                                        <td className="px-6 py-4">{req.date}</td>
                                        <td className="px-6 py-4">{req.reason}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button 
                                                    onClick={() => handleLeaveStatusUpdate(req.id, 'APPROVED')}
                                                    className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    {t('approve')}
                                                </button>
                                                <button 
                                                    onClick={() => handleLeaveStatusUpdate(req.id, 'REJECTED')}
                                                    className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    {t('reject')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-4 bg-white/30 rounded-lg">{t('no_pending_leave_requests')}</p>
                )}
            </div>

            {/* Existing Vacation Stats Section */}
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
                <h3 className="text-xl font-semibold mb-6 text-blue-800 flex items-center gap-2">
                    <SunIcon className="w-6 h-6" />
                    {t('vacation_stats')}
                </h3>

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 p-4 bg-white/50 rounded-lg">
                    <div>
                        <label htmlFor="vacationMonth" className="block text-sm font-medium text-slate-700 mb-1">{t('select_month')}</label>
                        <input 
                            type="month" 
                            id="vacationMonth"
                            value={selectedVacationMonth}
                            onChange={(e) => setSelectedVacationMonth(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex-grow">
                        <p className="text-sm text-slate-600 italic">
                            {t('vacation_stats_info')}
                        </p>
                    </div>
                    <div className="flex gap-2">
                         <button
                            onClick={handleExportVacationStats}
                            className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all shadow-md flex items-center gap-2"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            {t('download_excel')}
                        </button>
                        <button
                            onClick={handleOpenAbsenceModal}
                            className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 transition-all shadow-md flex items-center gap-2"
                        >
                            <CalendarPlusIcon className="w-5 h-5" />
                            {t('register_absence')}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-start">
                        <thead className="text-xs text-blue-800 uppercase bg-white/50">
                            <tr>
                                <th className="px-6 py-3">{t('rep_name')}</th>
                                <th className="px-6 py-3">{t('rep_code')}</th>
                                <th className="px-6 py-3 text-center">{t('total_working_days_passed')}</th>
                                <th className="px-6 py-3 text-center">{t('days_worked')}</th>
                                <th className="px-6 py-3 text-center">{t('absent_days')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/50">
                            {vacationStats.map((stat, idx) => (
                                <tr key={idx} className="bg-white/20 hover:bg-white/40">
                                    <td className="px-6 py-4 font-medium text-slate-800">{stat.repName}</td>
                                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">{stat.repUsername}</td>
                                    <td className="px-6 py-4 text-center">{stat.totalWorkingDaysPassed}</td>
                                    <td className="px-6 py-4 text-center font-bold text-green-700">{stat.daysWorked}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => stat.absentDays > 0 ? handleAbsentDaysClick(stat.repName, stat.absentDetailsList) : null}
                                            disabled={stat.absentDays === 0}
                                            className={`inline-block px-3 py-1 rounded-full font-bold transition-all ${
                                                stat.absentDays > 0 
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer underline decoration-dotted' 
                                                : 'bg-green-100 text-green-700 cursor-default'
                                            }`}
                                        >
                                            {stat.absentDays}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {vacationStats.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">{t('no_data')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'dataImport' && (<DataImport />)}
      {activeTab === 'approvals' && (<div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6 relative"><h3 className="text-xl font-semibold mb-4 text-blue-800">{t('pending_rep_plans')}</h3>{reviewMessage && (<div className={`p-4 mb-4 text-sm rounded-lg ${reviewMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} role="alert"><span className="font-medium">{reviewMessage.text}</span></div>)}{pendingPlans.length > 0 ? (<div className="space-y-6">{pendingPlans.map(item => (<div key={item.repId} className="bg-white/30 p-4 rounded-lg shadow border border-white/50"><h4 className="font-bold text-lg text-slate-800 mb-3">{item.repName}</h4><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">{WEEK_DAYS_ORDERED.map(day => { const dayPlan = item.plan[day.index]; const regionId = dayPlan?.regionId; const doctorIds = dayPlan?.doctorIds || []; const regionName = regionId ? regions.find(r => r.id === regionId)?.name : t('rest_day'); return (<div key={day.index} className="text-center p-2 bg-slate-100 rounded flex flex-col items-center"><p className="font-semibold text-sm text-slate-700">{day.name}</p><p className={`text-xs ${regionId ? 'text-blue-600' : 'text-slate-500'}`}>{regionName}</p>{doctorIds.length > 0 && (<div className="mt-1 flex flex-wrap justify-center gap-1">{doctorIds.map(docId => (<span key={docId} className="text-xs bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded-full">{allDoctorsMap.get(docId)?.name || t('unknown_doctor')}</span>))}</div>)}</div>); })}</div><div className="flex justify-end items-center gap-3"><button onClick={() => handleReviewPlan(item.repId, 'rejected')} className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors"><XIcon className="w-4 h-4" />{t('reject')}</button><button onClick={() => handleReviewPlan(item.repId, 'approved')} className="flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors"><CheckIcon className="w-4 h-4" />{t('approve')}</button></div></div>))}</div>) : (<p className="text-center text-slate-600 py-8">{t('no_new_plans_to_review')}</p>)}</div>)}
      {activeTab === 'weeklyPlans' && (<div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6"><h3 className="text-xl font-semibold mb-6 text-blue-800">{t('weekly_plans_overview')}</h3>{reviewMessage && (<div className={`p-4 mb-4 text-sm rounded-lg ${reviewMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} role="alert"><span className="font-medium">{reviewMessage.text}</span></div>)}<div className="overflow-x-auto"><table className="w-full text-sm text-start border-separate border-spacing-0"><thead className="text-xs text-blue-800 uppercase bg-white/50"><tr><th scope="col" className="sticky start-0 bg-white/50 px-6 py-3 rounded-se-lg z-10">{t('rep')}</th>{WEEK_DAYS_ORDERED.map(day => <th key={day.index} scope="col" className="px-4 py-3 text-center">{day.name}</th>)}<th scope="col" className="rounded-ss-lg"></th></tr></thead><tbody>{reps.map(rep => { const plan = allPlans[rep.id]; if (!plan) return null; return (<tr key={rep.id} className="group bg-white/20 border-b border-white/30 hover:bg-white/40"><td className="sticky start-0 px-6 py-4 font-medium text-slate-900 whitespace-nowrap bg-white/20 group-hover:bg-white/40"><div className="font-semibold">{rep.name}</div><div className="mt-1">{getPlanStatusBadge(plan.status)}</div>{user?.role === UserRole.Manager && plan.status === 'approved' && (<button onClick={() => handleRevokeApproval(rep.id)} className="mt-2 flex items-center gap-1.5 text-sm text-yellow-800 hover:text-yellow-900 bg-yellow-100 hover:bg-yellow-200 px-3 py-1 rounded-md transition-colors shadow-sm"><ReplyIcon className="w-4 h-4" />{t('revoke_approval')}</button>)}</td>{WEEK_DAYS_ORDERED.map(day => { const dayPlan = plan.plan[day.index]; const regionId = dayPlan?.regionId; const doctorIds = dayPlan?.doctorIds || []; const regionName = regionId ? regions.find(r => r.id === regionId)?.name : t('rest_day'); return (<td key={day.index} className={`px-4 py-4 text-center whitespace-nowrap ${regionId ? 'text-blue-600 font-semibold' : 'text-slate-500'}`} title={regionName}>{regionName}{doctorIds.length > 0 && (<div className="mt-1 flex flex-wrap justify-center gap-1">{doctorIds.map(docId => (<span key={docId} className="text-xs bg-blue-500/20 text-blue-700 px-1 py-0.5 rounded-full">{allDoctorsMap.get(docId)?.name || t('unknown_doctor')}</span>))}</div>)}</td>); })}</tr>); })}</tbody></table></div></div>)}
      {activeTab === 'settings' && (<div className="space-y-8"><div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6"><h3 className="text-xl font-semibold mb-4 text-blue-800">{t('weekend_settings')}</h3><div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">{WEEK_DAYS.map((day, index) => (<label key={index} className="flex items-center space-x-2 space-x-reverse cursor-pointer p-3 bg-white/30 rounded-lg"><input type="checkbox" checked={localWeekends.includes(index)} onChange={() => handleWeekendChange(index)} className="w-5 h-5 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500" /><span className="font-medium text-slate-800">{day}</span></label>))}</div></div><div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6"><h3 className="text-xl font-semibold mb-4 text-blue-800">{t('holidays_settings')}</h3><div className="flex flex-col sm:flex-row items-center gap-3 mb-4"><input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="w-full sm:w-auto flex-grow p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" /><button onClick={handleAddHoliday} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"><CalendarPlusIcon className="w-5 h-5 me-2"/> {t('add_holiday')}</button></div><div className="max-h-60 overflow-y-auto pr-2 space-y-2">{localHolidays.length > 0 ? localHolidays.map(holiday => (<div key={holiday} className="flex justify-between items-center p-3 bg-white/30 rounded-lg"><span className="font-mono text-slate-700">{holiday}</span><button onClick={() => handleRemoveHoliday(holiday)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-5 h-5"/></button></div>)) : <p className="text-center text-slate-500 p-4">{t('no_holidays_added')}</p>}</div></div><div className="flex items-center justify-between mt-6"><div className={`transition-opacity duration-300 ${settingsMessage ? 'opacity-100' : 'opacity-0'}`}>{settingsMessage && <p className="text-green-700 font-semibold">{settingsMessage}</p>}</div><button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-orange-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-orange-300 flex items-center justify-center">{isSavingSettings ? (<><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white me-3"></div>{t('saving_settings')}</>) : (t('save_settings'))}</button></div></div>)}

      {isExportModalOpen && (
        <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title={t('download_rep_client_lists')}>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{t('select_reps_to_download')}</p>
            <div className="border border-slate-300/50 rounded-lg">
                <div className="flex items-center p-3 bg-slate-100/50 rounded-t-lg border-b border-slate-300/50">
                    <input type="checkbox" id="selectAllReps" onChange={handleSelectAllReps} checked={reps.length > 0 && selectedRepsForExport.length === reps.length} className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 me-3" />
                    <label htmlFor="selectAllReps" className="text-sm font-medium text-slate-800 cursor-pointer">{t('select_all')}</label>
                </div>
                <div className="max-h-60 overflow-y-auto p-3 space-y-2">
                    {reps.map(rep => (
                        <div key={rep.id} className="flex items-center">
                            <input type="checkbox" id={`rep-${rep.id}`} value={rep.id} checked={selectedRepsForExport.includes(rep.id)} onChange={() => handleRepSelectionChange(rep.id)} className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 me-3" />
                            <label htmlFor={`rep-${rep.id}`} className="text-sm text-slate-800 cursor-pointer">{rep.name}</label>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-300/50">
              <button type="button" onClick={() => setIsExportModalOpen(false)} className="text-slate-700 bg-transparent hover:bg-slate-200/50 focus:ring-4 focus:outline-none focus:ring-slate-300 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 hover:text-slate-900 focus:z-10 transition-colors">{t('cancel')}</button>
              <button type="button" onClick={handleConfirmClientListExport} disabled={selectedRepsForExport.length === 0} className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors">{t('download_count', selectedRepsForExport.length)}</button>
            </div>
          </div>
        </Modal>
      )}

       <UserEditModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSuccess={handleUserModalSuccess} userToEdit={editingUser} />

        {deletingUser && (
            <Modal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} title={t('confirm_delete_title')}>
                <div>
                    <p className="text-slate-700">{t('confirm_delete_message', deletingUser.name)}</p>
                    <div className="flex items-center justify-end space-x-2 space-x-reverse pt-6">
                        <button type="button" onClick={() => setDeletingUser(null)} className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors">{t('cancel')}</button>
                        <button type="button" onClick={handleConfirmDelete} disabled={isDeleting} className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-red-300 transition-colors">{isDeleting ? t('deleting') : t('confirm')}</button>
                    </div>
                </div>
            </Modal>
        )}
        
        {isDailyVisitsDetailModalOpen && <DailyVisitsDetailModal isOpen={isDailyVisitsDetailModalOpen} onClose={() => setIsDailyVisitsDetailModalOpen(false)} reports={allReports} reps={reps} selectedRepId={selectedRepForDailyVisits} />}
        {isOverdueClientsDetailModalOpen && <OverdueClientsDetailModal isOpen={isOverdueClientsDetailModalOpen} onClose={() => setIsOverdueClientsDetailModalOpen(false)} alerts={overdueAlerts} reps={reps} regions={regions} />}

        {repToReset && (
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={t('confirm_reset_title')}>
                <div>
                    <p className="text-slate-700">{t('confirm_reset_message', repToReset.name)}</p>
                    {reviewMessage && reviewMessage.type === 'error' && (<p className="text-red-500 text-sm mt-4">{reviewMessage.text}</p>)}
                    <div className="flex items-center justify-end space-x-2 space-x-reverse pt-6">
                        <button type="button" onClick={() => setIsResetModalOpen(false)} className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors">{t('cancel')}</button>
                        <button type="button" onClick={handleConfirmReset} disabled={isResetting} className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-red-300 transition-colors">{isResetting ? t('resetting') : t('confirm_reset')}</button>
                    </div>
                </div>
            </Modal>
        )}

        {/* NEW: User Regions Management Modal */}
        {userForRegions && (
            <UserRegionsModal
                isOpen={isUserRegionsModalOpen}
                onClose={() => setIsUserRegionsModalOpen(false)}
                user={userForRegions}
                allRegions={regions}
            />
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

        {/* NEW: Absent Details Modal */}
        {selectedAbsentDetails && (
            <AbsentDetailsModal
                isOpen={isAbsentDetailModalOpen}
                onClose={() => setIsAbsentDetailModalOpen(false)}
                repName={selectedAbsentDetails.repName}
                absentDetails={selectedAbsentDetails.details}
                onUpdate={handleAbsenceUpdate}
            />
        )}

        {/* NEW: Register Absence Modal */}
        {isRegisterAbsenceModalOpen && (
            <Modal 
                isOpen={isRegisterAbsenceModalOpen} 
                onClose={() => setIsRegisterAbsenceModalOpen(false)} 
                title={t('register_absence_title')}
            >
                <form onSubmit={handleRegisterAbsenceSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="absenceRep" className="block text-sm font-medium text-slate-800 mb-1">{t('select_rep')}</label>
                        <select
                            id="absenceRep"
                            value={absenceFormRepId}
                            onChange={(e) => setAbsenceFormRepId(e.target.value)}
                            required
                            className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="" disabled>{t('select_rep')}</option>
                            {reps.map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="absenceDate" className="block text-sm font-medium text-slate-800 mb-1">{t('absence_date')}</label>
                        <input
                            type="date"
                            id="absenceDate"
                            value={absenceFormDate}
                            onChange={(e) => setAbsenceFormDate(e.target.value)}
                            required
                            className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="absenceReasonSelect" className="block text-sm font-medium text-slate-800 mb-1">{t('leave_type')}</label>
                        <select
                             id="absenceReasonSelect"
                             value={absenceReasonSelect}
                             onChange={(e) => setAbsenceReasonSelect(e.target.value)}
                             required
                             className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-2"
                        >
                            <option value="">{t('select_leave_type')}</option>
                            <option value="casual_leave">{t('casual_leave')}</option>
                            <option value="regular_leave">{t('regular_leave')}</option>
                            <option value="sick_leave">{t('sick_leave')}</option>
                            <option value="other">{t('other')}</option>
                        </select>
                        
                        {absenceReasonSelect === 'Other' && (
                            <input
                                type="text"
                                placeholder={t('reason_optional')}
                                value={absenceReasonText}
                                onChange={(e) => setAbsenceReasonText(e.target.value)}
                                className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-blue-500 focus:border-blue-500 animate-fade-in"
                                required
                            />
                        )}
                    </div>

                    {registerAbsenceMessage && (
                        <p className={`text-sm font-medium p-2 rounded ${
                             registerAbsenceMessage === t('absence_added_success') 
                             ? 'text-green-700 bg-green-100' 
                             : 'text-red-700 bg-red-100'
                        }`}>
                            {registerAbsenceMessage}
                        </p>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-200/50 gap-2">
                         <button
                            type="button"
                            onClick={() => setIsRegisterAbsenceModalOpen(false)}
                            className="text-slate-700 bg-transparent hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium px-5 py-2.5 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isRegisteringAbsence || !absenceFormRepId}
                            className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                        >
                            {isRegisteringAbsence ? t('saving') : t('save')}
                        </button>
                    </div>
                </form>
            </Modal>
        )}
    </div>
  );
};

export default ManagerDashboard;