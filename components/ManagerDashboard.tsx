



import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Region, User, VisitReport, UserRole, Doctor, Pharmacy, ClientAlert, SystemSettings, WeeklyPlan, Specialization } from '../types';
import { exportToExcel, exportToPdf, exportUsersToExcel, exportMultipleRepClientsToExcel, exportClientsToExcel } from '../services/exportService';
import { FilterIcon, DownloadIcon, CalendarIcon, DoctorIcon, PharmacyIcon, WarningIcon, UserIcon as UsersIcon, ChartBarIcon, CogIcon, CalendarPlusIcon, TrashIcon, MapPinIcon, CheckIcon, XIcon, UploadIcon, EditIcon, PlusIcon, UserGroupIcon, GraphIcon, EyeIcon, ReplyIcon, ClipboardListIcon, ChevronDownIcon, ChevronUpIcon } from './icons';
import Modal from './Modal';
import { useAuth } from '../hooks/useAuth';
import { useLanguage, TranslationFunction } from '../hooks/useLanguage';
import DataImport from './DataImport';
import Spinner from './Spinner';
import UserEditModal from './UserEditModal';
import AnalyticsCharts from './AnalyticsCharts';
import DailyVisitsDetailModal from './DailyVisitsDetailModal';
import OverdueClientsDetailModal from './OverdueClientsDetailModal'; // New import

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


  type ManagerTab = 'reports' | 'users' | 'clients' | 'approvals' | 'settings' | 'weeklyPlans' | 'dataImport';


  // Tab and Modal states
  const [activeTab, setActiveTab] = useState<ManagerTab>('reports');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedRepsForExport, setSelectedRepsForExport] = useState<string[]>([]);
  const [selectedRepForDailyVisits, setSelectedRepForDailyVisits] = useState<string | 'all'>('all');
  const [isDailyVisitsDetailModalOpen, setIsDailyVisitsDetailModalOpen] = useState(false);
  const [isOverdueClientsDetailModalOpen, setIsOverdueClientsDetailModalOpen] = useState(false); // New state for overdue clients detail modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingRepClients, setViewingRepClients] = useState<User | null>(null);
  // New state for reset visits functionality
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [repToReset, setRepToReset] = useState<User | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  // State for the new expandable List card
  const [isListCardExpanded, setIsListCardExpanded] = useState(false);


  // Settings tab local state
  const [localWeekends, setLocalWeekends] = useState<number[]>([]);
  const [localHolidays, setLocalHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false); // New state for settings button

  // Filter states
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  // Changed default to 'today'
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<'none' | 'today' | 'currentWeek' | 'currentMonth'>('today');
  
  // New state to control expanded view of reports
  const [isReportExpanded, setIsReportExpanded] = useState(false);


  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, usersData, regionsData, doctorsData, pharmaciesData, alertsData, settingsData, plansData] = await Promise.all([
        api.getAllVisitReports(),
        api.getUsers(),
        api.getRegions(),
        api.getAllDoctors(), // Fetch all doctors
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
      if (settingsData) {
        setLocalWeekends(settingsData.weekends);
        setLocalHolidays(settingsData.holidays.sort((a,b) => new Date(a).getTime() - new Date(b).getTime()));
      }
      setAllPlans(plansData);
      setAllDoctorsMap(new Map(doctorsData.map(doc => [doc.id, doc]))); // Create doctor map
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch data on initial component mount
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    // Refetch data whenever the active tab changes to ensure fresh data
    // This is especially important for tabs where data might have been modified
    // in another tab (e.g., users after data import).
    fetchInitialData();
  }, [activeTab, fetchInitialData]); // Add activeTab as a dependency

  useMemo(() => {
    let reports = allReports;
    let currentStartDate = startDate;
    let currentEndDate = endDate;

    // Apply quick filters if selected, overriding manual inputs
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
      // Add one day to endDate to include visits on the selected end date
      const endOfDay = new Date(currentEndDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      reports = reports.filter(r => new Date(r.date) < endOfDay);
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

  const visitFrequency = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const visitCounts: Record<string, number> = {};
    
    // Filter based on selected Rep for consistent stats
    const relevantReports = selectedRep === 'all'
        ? allReports
        : allReports.filter(r => r.repName === selectedRep);

    relevantReports.forEach(visit => {
        const visitDate = new Date(visit.date);
        // Filter for current month and Doctor visits only
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
  }, [allReports, selectedRep]);

  const handleReviewPlan = async (repId: string, status: 'approved' | 'rejected') => {
      try {
          await api.reviewRepPlan(repId, status);
           // Optimistic update
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
          setReviewMessage({ text: t('error_permission_denied'), type: 'error' }); // Reusing permission denied translation
          setTimeout(() => setReviewMessage(null), 3000);
          return;
      }
      try {
          await api.revokePlanApproval(repId);
           // Optimistic update
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

  // NEW: Handle reset visits click
  const handleResetClick = (rep: User) => {
      if (user?.role !== UserRole.Manager) {
          setReviewMessage({ text: t('error_permission_denied'), type: 'error' });
          setTimeout(() => setReviewMessage(null), 3000);
          return;
      }
      setRepToReset(rep);
      setIsResetModalOpen(true);
  };

  // NEW: Handle confirmation of reset visits
  const handleConfirmReset = async () => {
      if (!repToReset) return;

      setIsResetting(true);
      try {
          await api.resetRepData(repToReset.id);
          setReviewMessage({ text: t('reset_success', repToReset.name), type: 'success' });
          // Re-fetch all data to reflect the changes
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
    // If resetting in expanded mode, we might want to stay expanded or reset to today.
    // Let's reset to Today default.
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
          // Expanding: Switch to Current Week for better context
          handleQuickFilterClick('currentWeek');
      } else {
          // Collapsing: Switch back to Today Only
          handleQuickFilterClick('today');
          // Reset other filters to avoid hidden state affecting the view
          setSelectedRep('all');
          setSelectedRegion('all');
      }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartDate(e.target.value);
    setSelectedQuickFilter('none'); // Clear quick filter if manual date is set
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
    setSelectedQuickFilter('none'); // Clear quick filter if manual date is set
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
      console.log('handleSaveSettings triggered');
      setIsSavingSettings(true); // Start saving
      console.log('isSavingSettings set to true');

      setSettingsMessage(''); // Clear previous messages

      if (!systemSettings) {
          console.error('System settings are null when trying to save.');
          setSettingsMessage(t('settings_saved_error')); // Provide specific error feedback
          setIsSavingSettings(false); // Ensure button is re-enabled
          return;
      }
      const newSettings = { weekends: localWeekends, holidays: localHolidays };
      try {
          console.log('Attempting to update system settings with:', newSettings);
          await api.updateSystemSettings(newSettings);
          setSystemSettings(newSettings); // Update local state with potentially new settings from DB
          setSettingsMessage(t('settings_saved_success'));
          console.log('Settings saved successfully.');
          setTimeout(() => setSettingsMessage(''), 3000);
      } catch (error: any) {
          console.error("Failed to save settings:", error);
          // Ensure the error message from API is displayed if available, otherwise generic.
          setSettingsMessage(error.message ? t(error.message) : t('settings_saved_error'));
          setTimeout(() => setSettingsMessage(''), 5000); // Give user more time to read error
      } finally {
          setIsSavingSettings(false); // End saving
          console.log('isSavingSettings set to false (finally block)');
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
    fetchInitialData(); // Refetch all data including users after successful user add/edit
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      fetchInitialData(); // Refetch all data including users after successful user deletion
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
              <li className="me-2">
                  <button 
                      onClick={() => setActiveTab('reports')}
                      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg group ${activeTab === 'reports' ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                  >
                      <ChartBarIcon className="w-5 h-5 me-2" />
                      {t('reports')}
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
          {/* Welcome Widget */}
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

          {/* Monthly Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
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

          {/* Daily Visits Card */}
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4">
                    <CalendarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_monthly_visits' : 'monthly_visits_for', selectedRep)}</p>
                    <p className="text-4xl font-bold text-blue-800">{displayedStats.visitsThisMonth}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                <div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4">
                    <DoctorIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_doctors' : 'doctors_of', selectedRep)}</p>
                    <p className="text-4xl font-bold text-green-800">{displayedStats.doctorCount}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '500ms' }}>
                <div className="bg-orange-500/20 text-orange-700 p-4 rounded-full me-4">
                    <PharmacyIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t(selectedRep === 'all' ? 'total_pharmacies' : 'pharmacies_of', selectedRep)}</p>
                    <p className="text-4xl font-bold text-orange-800">{displayedStats.pharmacyCount}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '600ms' }}>
                <div className="bg-red-500/20 text-red-700 p-4 rounded-full me-4">
                    <WarningIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t('overdue_visits')}</p>
                    <p className="text-4xl font-bold text-red-800">{filteredAlerts.length}</p>
                </div>
            </div>
          </div>

          {/* Visits Frequency Card - NEW */}
          <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '650ms' }}>
                <div className="flex items-center mb-4">
                    <div className="bg-indigo-500/20 text-indigo-700 p-3 rounded-full me-3">
                        <GraphIcon className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 text-md font-medium">{t('visit_frequency_monthly')} {selectedRep !== 'all' ? `(${selectedRep})` : ''}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center">
                         <p className="text-3xl font-bold text-slate-800">{visitFrequency.freq1}</p>
                         <p className="text-sm text-slate-600 font-semibold mt-1">{t('freq_1_mo')}</p>
                    </div>
                    <div className="flex flex-col items-center border-x border-slate-300/50">
                         <p className="text-3xl font-bold text-blue-800">{visitFrequency.freq2}</p>
                         <p className="text-sm text-slate-600 font-semibold mt-1">{t('freq_2_mo')}</p>
                    </div>
                    <div className="flex flex-col items-center">
                         <p className="text-3xl font-bold text-green-800">{visitFrequency.freq3}</p>
                         <p className="text-sm text-slate-600 font-semibold mt-1">{t('freq_3_mo')}</p>
                    </div>
                </div>
            </div>

            {/* List Summary Card (Expandable) - NEW */}
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
                <div className="flex justify-between items-start">
                    <div className="flex items-center">
                        <div className="bg-pink-500/20 text-pink-700 p-3 rounded-full me-3">
                            <ClipboardListIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-blue-800">{t('clients_list_summary')}</h3>
                            <p className="text-sm text-slate-600 mt-1">{t('total_doctors')}: <span className="font-bold text-slate-800">{totalDoctors.length}</span></p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsListCardExpanded(!isListCardExpanded)}
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors border border-slate-300 px-3 py-1.5 rounded-lg bg-white/50 hover:bg-white"
                    >
                        {isListCardExpanded ? (
                            <>
                                {t('less_details')}
                                <ChevronUpIcon className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                {t('more_details')}
                                <ChevronDownIcon className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>

                {/* Summary Chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                     {Object.entries(totalSpecializationCounts).map(([spec, count]) => (
                        <span key={spec} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/60 text-slate-700 border border-white/60 shadow-sm">
                            <span className="opacity-70 me-1">{t(spec)}:</span>
                            <span className="font-bold">{count}</span>
                        </span>
                    ))}
                </div>

                {/* Expanded Content */}
                {isListCardExpanded && (
                    <div className="mt-6 border-t border-slate-300/50 pt-4 animate-fade-in">
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                             {clientStatsByRep.map(stat => (
                                <div key={stat.rep.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/30 p-3 rounded-lg border border-white/40 hover:bg-white/50 transition-colors">
                                    <div className="font-bold text-slate-800 mb-2 sm:mb-0 sm:w-1/4 truncate" title={stat.rep.name}>
                                        {stat.rep.name}
                                    </div>
                                    <div className="flex flex-wrap gap-2 flex-grow sm:justify-end">
                                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold border border-blue-200">
                                            {t('total')}: {stat.doctorCount}
                                        </span>
                                        {Object.entries(stat.specializationCounts).map(([spec, count]) => (
                                            <span key={spec} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full border border-slate-200">
                                                {t(spec)}: <span className="font-bold text-slate-800">{count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

          {/* Analytics Charts */}
          <AnalyticsCharts reports={filteredReports} />

          {/* Filters Section - Collapsible */}
          <div className="bg-white/40 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/50 mb-8 transition-all duration-300 ease-in-out">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center text-blue-700"><FilterIcon className="w-5 h-5 me-2"/>{t('filter_options')}</h3>
                <button 
                    onClick={handleToggleReportExpand}
                    className="flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-orange-600 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-orange-200"
                >
                    {isReportExpanded ? (
                        <>
                            {t('show_less_options')}
                            <ChevronUpIcon className="w-4 h-4" />
                        </>
                    ) : (
                        <>
                            {t('show_more_options')}
                            <ChevronDownIcon className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
            
            {/* Extended Filters - Visible only when expanded */}
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
                            <button 
                                onClick={() => handleQuickFilterClick('today')} 
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'today' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                {t('today')}
                            </button>
                            <button 
                                onClick={() => handleQuickFilterClick('currentWeek')} 
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'currentWeek' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                {t('current_week')}
                            </button>
                            <button 
                                onClick={() => handleQuickFilterClick('currentMonth')} 
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedQuickFilter === 'currentMonth' ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                {t('current_month')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {!isReportExpanded && (
                <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                    <CheckIcon className="w-4 h-4 text-green-600" />
                    <span>{t('showing_today_reports_only')}</span>
                </div>
            )}
          </div>

          {/* Alerts Table - Modified to show only title and button */}
          {filteredAlerts.length > 0 && (
            <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden mb-8">
              <h3 className="text-xl font-semibold p-4 flex items-center text-red-700 bg-red-100/50">
                <WarningIcon className="w-6 h-6 me-3"/>
                {t('overdue_visits_alerts_table')} ({filteredAlerts.length})
              </h3>
              {/* Removed the table content here. It will now be displayed in the modal. */}
              <div className="flex justify-center p-4">
                <button
                    onClick={() => setIsOverdueClientsDetailModalOpen(true)}
                    className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
                >
                    <EyeIcon className="w-5 h-5" />
                    {t('view_details')}
                </button>
            </div>
            </div>
          )}
          
          {/* Export Buttons */}
          <div className="flex flex-col sm:flex-row justify-end items-center mb-4 gap-3">
                <span className="text-slate-700 font-medium">{t('export_reports', filteredReports.length)}</span>
                <button onClick={() => exportToExcel(filteredReports, 'reports', t)} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                    <DownloadIcon className="w-5 h-5 me-2"/> Excel
                </button>
                <button onClick={() => exportToPdf(filteredReports, 'reports', t)} className="w-full sm:w-auto flex items-center justify-center bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600 transition-colors">
                    <DownloadIcon className="w-5 h-5 me-2"/> PDF
                </button>
            </div>

          {/* Reports Table */}
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start text-gray-500">
                <thead className="text-xs text-blue-800 uppercase bg-white/50">
                  <tr>
                    <th scope="col" className="px-6 py-3">{t('date')}</th>
                    <th scope="col" className="px-6 py-3">{t('visit_type')}</th>
                    <th scope="col" className="px-6 py-3">{t('rep')}</th>
                    <th scope="col" className="px-6 py-3">{t('region')}</th>
                    <th scope="col" className="px-6 py-3">{t('client')}</th>
                    <th scope="col" className="px-6 py-3">{t('target_specialization')}</th>
                    <th scope="col" className="px-6 py-3">{t('product')}</th>
                    <th scope="col" className="px-6 py-3">{t('doctor_visit_type')}</th>
                    <th scope="col" className="px-6 py-3">{t('notes')}</th>
                  </tr>
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

      {activeTab === 'users' && (
        <>
          {/* User Management Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up">
                <div className="bg-blue-500/20 text-blue-700 p-4 rounded-full me-4">
                    <CalendarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t('total_visits_recorded')}</p>
                    <p className="text-4xl font-bold text-blue-800">{userManagementStats.totalVisits}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <div className="bg-green-500/20 text-green-700 p-4 rounded-full me-4">
                    <UsersIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t('total_unique_clients')}</p>
                    <p className="text-4xl font-bold text-green-800">{userManagementStats.totalUniqueClients}</p>
                </div>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 flex items-center animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="bg-purple-500/20 text-purple-700 p-4 rounded-full me-4">
                    <ChartBarIcon className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-slate-600 text-sm font-medium">{t('avg_visits_per_month')}</p>
                    <p className="text-4xl font-bold text-purple-800">{userManagementStats.averageVisitsPerMonth}</p>
                </div>
            </div>
          </div>
          <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
              <div className="flex flex-wrap justify-between items-center p-4 bg-white/50 border-b border-white/30 gap-4">
                <h3 className="text-xl font-semibold flex items-center text-blue-800">
                    <UsersIcon className="w-6 h-6 me-3"/>
                    {t('reps_list')}
                </h3>
                <div className="flex items-center gap-3">
                  <button onClick={handleAddUserClick} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-all shadow flex items-center gap-2">
                    <PlusIcon className="w-5 h-5"/>
                    <span>{t('add_rep')}</span>
                  </button>
                  <button
                      onClick={() => { setSelectedRepsForExport([]); setIsExportModalOpen(true); }}
                      disabled={reps.length === 0}
                      className="bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 transition-all shadow flex items-center gap-2 disabled:bg-teal-300 disabled:cursor-not-allowed"
                  >
                      <DownloadIcon className="w-5 h-5"/>
                      <span className="hidden sm:inline">{t('download_client_lists')}</span>
                  </button>
                  <button
                      onClick={handleExportUsers}
                      disabled={reps.length === 0}
                      className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-all shadow flex items-center gap-2 disabled:bg-green-300 disabled:cursor-not-allowed"
                  >
                      <DownloadIcon className="w-5 h-5"/>
                      <span className="hidden sm:inline">{t('download_reps_list')}</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start text-gray-500">
                      <thead className="text-xs text-blue-800 uppercase bg-white/50">
                          <tr>
                              <th scope="col" className="px-6 py-3">{t('full_name')}</th>
                              <th scope="col" className="px-6 py-3">{t('username')}</th>
                              <th scope="col" className="px-6 py-3">{t('role')}</th>
                              <th scope="col" className="px-6 py-3">{t('actions')}</th>
                          </tr>
                      </thead>
                      <tbody>
                          {reps.map(rep => (
                              <tr key={rep.id} className="bg-white/20 border-b border-white/30 hover:bg-white/40">
                                  <td className="px-6 py-4 font-medium text-slate-900">{rep.name}</td>
                                  <td className="px-6 py-4">{rep.username}</td>
                                  <td className="px-6 py-4">{t(rep.role)}</td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-4">
                                          <button onClick={() => handleEditUserClick(rep)} className="text-blue-600 hover:text-blue-800" aria-label={t('edit')}>
                                              <EditIcon className="w-5 h-5"/>
                                          </button>
                                          {user?.role === UserRole.Manager && ( // Only Manager can delete and reset
                                            <>
                                              <button onClick={() => setDeletingUser(rep)} className="text-red-600 hover:text-red-800" aria-label={t('delete')}>
                                                  <TrashIcon className="w-5 h-5"/>
                                              </button>
                                              <button onClick={() => handleResetClick(rep)} className="text-orange-600 hover:text-orange-800" aria-label={t('reset_rep_visits')}>
                                                  <ReplyIcon className="w-5 h-5"/> {/* Using ReplyIcon for reset, as it indicates a fresh start */}
                                              </button>
                                            </>
                                          )}
                                      </div>
                                  </td>
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
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 overflow-hidden">
            <h3 className="text-xl font-semibold p-4 flex items-center text-blue-800 bg-white/50 border-b border-white/30">
                <UserGroupIcon className="w-6 h-6 me-3"/>
                {t('client_management')}
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-start text-gray-500">
                    <thead className="text-xs text-blue-800 uppercase bg-white/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">{t('rep_name')}</th>
                            <th scope="col" className="px-6 py-3">{t('doctors')}</th>
                            <th scope="col" className="px-6 py-3">{t('pharmacies')}</th>
                            <th scope="col" className="px-6 py-3">{t('total_clients')}</th>
                            <th scope="col" className="px-6 py-3">{t('doctor_specialization_breakdown')}</th>
                            <th scope="col" className="px-6 py-3">{t('actions')}</th>
                        </tr>
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
                                    {Object.entries(stat.specializationCounts).length > 0 ? Object.entries(stat.specializationCounts).map(([spec, count]) => (
                                      <span key={spec} className="text-xs bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded-full">
                                        {t(spec as any)}: {count}
                                      </span>
                                    )) : <span className="text-xs text-slate-500">{t('no_doctors_assigned')}</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                    <button onClick={() => setViewingRepClients(stat.rep)} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors">
                                        <EyeIcon className="w-4 h-4"/>
                                        {t('view_clients')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {reps.length === 0 && <p className="text-center p-8 text-slate-600">{t('no_data')}</p>}
            </div>
        </div>
      )}

      {activeTab === 'dataImport' && (
        <DataImport />
      )}

       {activeTab === 'approvals' && (
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6 relative">
            <h3 className="text-xl font-semibold mb-4 text-blue-800">{t('pending_rep_plans')}</h3>

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
                                    const dayPlan = item.plan[day.index];
                                    const regionId = dayPlan?.regionId;
                                    const doctorIds = dayPlan?.doctorIds || [];
                                    const regionName = regionId ? regions.find(r => r.id === regionId)?.name : t('rest_day');
                                    
                                    return (
                                        <div key={day.index} className="text-center p-2 bg-slate-100 rounded flex flex-col items-center">
                                            <p className="font-semibold text-sm text-slate-700">{day.name}</p>
                                            <p className={`text-xs ${regionId ? 'text-blue-600' : 'text-slate-500'}`}>{regionName}</p>
                                            {doctorIds.length > 0 && (
                                                <div className="mt-1 flex flex-wrap justify-center gap-1">
                                                    {doctorIds.map(docId => (
                                                        <span key={docId} className="text-xs bg-blue-500/20 text-blue-700 px-1.5 py-0.5 rounded-full">
                                                            {allDoctorsMap.get(docId)?.name || t('unknown_doctor')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end items-center gap-3">
                                <button onClick={() => handleReviewPlan(item.repId, 'rejected')} className="flex items-center gap-2 text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors">
                                    <XIcon className="w-4 h-4" />
                                    {t('reject')}
                                </button>
                                <button onClick={() => handleReviewPlan(item.repId, 'approved')} className="flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors">
                                    <CheckIcon className="w-4 h-4" />
                                    {t('approve')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-center text-slate-600 py-8">{t('no_new_plans_to_review')}</p>
            )}
        </div>
      )}

      {activeTab === 'weeklyPlans' && (
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6">
            <h3 className="text-xl font-semibold mb-6 text-blue-800">{t('weekly_plans_overview')}</h3>
            {reviewMessage && ( // Display messages also on the weekly plans tab
                <div className={`p-4 mb-4 text-sm rounded-lg ${reviewMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} role="alert">
                    <span className="font-medium">{reviewMessage.text}</span>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-start border-separate border-spacing-0">
                    <thead className="text-xs text-blue-800 uppercase bg-white/50">
                        <tr>
                            <th scope="col" className="sticky start-0 bg-white/50 px-6 py-3 rounded-se-lg z-10">{t('rep')}</th>
                            {WEEK_DAYS_ORDERED.map(day => <th key={day.index} scope="col" className="px-4 py-3 text-center">{day.name}</th>)}
                             <th scope="col" className="rounded-ss-lg"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {reps.map(rep => {
                            const plan = allPlans[rep.id];
                            if (!plan) return null; // Should not happen due to data hydration

                            return (
                                <tr key={rep.id} className="group bg-white/20 border-b border-white/30 hover:bg-white/40">
                                    <td className="sticky start-0 px-6 py-4 font-medium text-slate-900 whitespace-nowrap bg-white/20 group-hover:bg-white/40">
                                        <div className="font-semibold">{rep.name}</div>
                                        <div className="mt-1">{getPlanStatusBadge(plan.status)}</div>
                                        {user?.role === UserRole.Manager && plan.status === 'approved' && (
                                            <button 
                                                onClick={() => handleRevokeApproval(rep.id)}
                                                className="mt-2 flex items-center gap-1.5 text-sm text-yellow-800 hover:text-yellow-900 bg-yellow-100 hover:bg-yellow-200 px-3 py-1 rounded-md transition-colors shadow-sm"
                                            >
                                                <ReplyIcon className="w-4 h-4" />
                                                {t('revoke_approval')}
                                            </button>
                                        )}
                                    </td>
                                    {WEEK_DAYS_ORDERED.map(day => {
                                        const dayPlan = plan.plan[day.index];
                                        const regionId = dayPlan?.regionId;
                                        const doctorIds = dayPlan?.doctorIds || [];
                                        const regionName = regionId ? regions.find(r => r.id === regionId)?.name : t('rest_day');
                                        return (
                                            <td key={day.index} className={`px-4 py-4 text-center whitespace-nowrap ${regionId ? 'text-blue-600 font-semibold' : 'text-slate-500'}`} title={regionName}>
                                                {regionName}
                                                {doctorIds.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                                                        {doctorIds.map(docId => (
                                                            <span key={docId} className="text-xs bg-blue-500/20 text-blue-700 px-1 py-0.5 rounded-full">
                                                                {allDoctorsMap.get(docId)?.name || t('unknown_doctor')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
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
                <h3 className="text-xl font-semibold mb-4 text-blue-800">{t('weekend_settings')}</h3>
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
                <h3 className="text-xl font-semibold mb-4 text-blue-800">{t('holidays_settings')}</h3>
                <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
                    <input 
                        type="date"
                        value={newHoliday}
                        onChange={(e) => setNewHoliday(e.target.value)}
                        className="w-full sm:w-auto flex-grow p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500"
                    />
                    <button onClick={handleAddHoliday} className="w-full sm:w-auto flex items-center justify-center bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        <CalendarPlusIcon className="w-5 h-5 me-2"/> {t('add_holiday')}
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
                    )) : <p className="text-center text-slate-500 p-4">{t('no_holidays_added')}</p>}
                </div>
            </div>

            <div className="flex items-center justify-between mt-6">
                <div className={`transition-opacity duration-300 ${settingsMessage ? 'opacity-100' : 'opacity-0'}`}>
                    {settingsMessage && <p className="text-green-700 font-semibold">{settingsMessage}</p>}
                </div>
                <button 
                    onClick={handleSaveSettings} 
                    disabled={isSavingSettings} // Disable button while saving
                    className="bg-orange-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:bg-orange-300 flex items-center justify-center"
                >
                    {isSavingSettings ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white me-3"></div>
                            {t('saving_settings')}
                        </>
                    ) : (
                        t('save_settings')
                    )}
                </button>
            </div>
        </div>
      )}

      {isExportModalOpen && (
        <Modal 
          isOpen={isExportModalOpen} 
          onClose={() => setIsExportModalOpen(false)} 
          title={t('download_rep_client_lists')}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{t('select_reps_to_download')}</p>
            
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
                        {t('select_all')}
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
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmClientListExport}
                disabled={selectedRepsForExport.length === 0}
                className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                {t('download_count', selectedRepsForExport.length)}
              </button>
            </div>
          </div>
        </Modal>
      )}

       <UserEditModal 
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            onSuccess={handleUserModalSuccess}
            userToEdit={editingUser}
        />

        {deletingUser && (
            <Modal isOpen={!!deletingUser} onClose={() => setDeletingUser(null)} title={t('confirm_delete_title')}>
                <div>
                    <p className="text-slate-700">{t('confirm_delete_message', deletingUser.name)}</p>
                    <div className="flex items-center justify-end space-x-2 space-x-reverse pt-6">
                        <button
                            type="button"
                            onClick={() => setDeletingUser(null)}
                            className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-red-300 transition-colors"
                        >
                            {isDeleting ? t('deleting') : t('confirm')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        
        {viewingRepClients && 
            <ClientListModal 
                rep={viewingRepClients} 
                onClose={() => setViewingRepClients(null)} 
                totalDoctors={totalDoctors}
                totalPharmacies={totalPharmacies}
                regions={regions}
            />
        }

        {isDailyVisitsDetailModalOpen && (
            <DailyVisitsDetailModal
                isOpen={isDailyVisitsDetailModalOpen}
                onClose={() => setIsDailyVisitsDetailModalOpen(false)}
                reports={allReports}
                reps={reps}
                selectedRepId={selectedRepForDailyVisits}
            />
        )}

        {isOverdueClientsDetailModalOpen && (
          <OverdueClientsDetailModal
            isOpen={isOverdueClientsDetailModalOpen}
            onClose={() => setIsOverdueClientsDetailModalOpen(false)}
            alerts={overdueAlerts} // Pass the full list of overdue alerts
            reps={reps}
            regions={regions}
          />
        )}

        {/* NEW: Reset Visits Confirmation Modal */}
        {repToReset && (
            <Modal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} title={t('confirm_reset_title')}>
                <div>
                    <p className="text-slate-700">{t('confirm_reset_message', repToReset.name)}</p>
                    {reviewMessage && reviewMessage.type === 'error' && (
                        <p className="text-red-500 text-sm mt-4">{reviewMessage.text}</p>
                    )}
                    <div className="flex items-center justify-end space-x-2 space-x-reverse pt-6">
                        <button
                            type="button"
                            onClick={() => setIsResetModalOpen(false)}
                            className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmReset}
                            disabled={isResetting}
                            className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-red-300 transition-colors"
                        >
                            {isResetting ? t('resetting') : t('confirm_reset')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};


// A sub-component for the client list modal to keep the main component cleaner
interface ClientListModalProps {
    rep: User;
    onClose: () => void;
    totalDoctors: Doctor[]; // Explicitly passed
    totalPharmacies: Pharmacy[]; // Explicitly passed
    regions: Region[]; // Explicitly passed
}

const ClientListModal: React.FC<ClientListModalProps> = ({ rep, onClose, totalDoctors, totalPharmacies, regions }) => {
    const { t } = useLanguage();

    const [activeModalTab, setActiveModalTab] = useState<'doctors' | 'pharmacies'>('doctors');
    const repDoctors = useMemo(() => totalDoctors.filter((d: Doctor) => d.repId === rep.id), [rep.id, totalDoctors]);
    const repPharmacies = useMemo(() => totalPharmacies.filter((p: Pharmacy) => p.repId === rep.id), [rep.id, totalPharmacies]);
    const regionMap = useMemo(() => new Map(regions.map((r: Region) => [r.id, r.name])), [regions]);


    const handleExport = () => {
        exportClientsToExcel(repDoctors, repPharmacies, regions, `clients_${rep.username}`, t);
    };

    return (
      <Modal isOpen={true} onClose={onClose} title={t('clients_for_rep', rep.name)}>
          <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-300/50">
                  <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg p-1 bg-slate-200/60">
                      <button type="button" role="tab" aria-selected={activeModalTab === 'doctors'} onClick={() => setActiveModalTab('doctors')} className={`flex items-center justify-center gap-2 w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 ${activeModalTab === 'doctors' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}>
                          <DoctorIcon className="w-5 h-5"/> {t('doctors')} ({repDoctors.length})
                      </button>
                      <button type="button" role="tab" aria-selected={activeModalTab === 'pharmacies'} onClick={() => setActiveModalTab('pharmacies')} className={`flex items-center justify-center gap-2 w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 ${activeModalTab === 'pharmacies' ? 'bg-orange-500 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}>
                          <PharmacyIcon className="w-5 h-5"/> {t('pharmacies')} ({repPharmacies.length})
                      </button>
                  </div>
                  <button onClick={handleExport} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-all shadow flex items-center gap-2">
                      <DownloadIcon className="w-5 h-5"/>
                      <span>{t('download_list')}</span>
                  </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                  {activeModalTab === 'doctors' ? (
                      repDoctors.length > 0 ? (
                          <table className="w-full text-sm text-start">
                              <thead className="text-xs text-blue-800 uppercase bg-slate-100/50 sticky top-0">
                                  <tr>
                                      <th className="px-4 py-2">{t('name')}</th>
                                      <th className="px-4 py-2">{t('specialization')}</th>
                                      <th className="px-4 py-2">{t('region')}</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {repDoctors.map(doctor => (
                                      <tr key={doctor.id} className="border-b border-slate-200/50">
                                          <td className="px-4 py-2 font-medium text-slate-800">{doctor.name}</td>
                                          <td className="px-4 py-2">{t(doctor.specialization)}</td>
                                          <td className="px-4 py-2">{regionMap.get(doctor.regionId) || t('unknown')}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : <p className="text-center p-8 text-slate-600">{t('no_doctors_assigned')}</p>
                  ) : (
                      repPharmacies.length > 0 ? (
                           <table className="w-full text-sm text-start">
                              <thead className="text-xs text-orange-800 uppercase bg-slate-100/50 sticky top-0">
                                  <tr>
                                      <th className="px-4 py-2">{t('name')}</th>
                                      <th className="px-4 py-2">{t('region')}</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {repPharmacies.map(pharmacy => (
                                      <tr key={pharmacy.id} className="border-b border-slate-200/50">
                                          <td className="px-4 py-2 font-medium text-slate-800">{pharmacy.name}</td>
                                          <td className="px-4 py-2">{regionMap.get(pharmacy.regionId) || t('unknown')}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      ) : <p className="text-center p-8 text-slate-600">{t('no_pharmacies_assigned')}</p>
                  )}
              </div>
          </div>
      </Modal>
    );
}


export default ManagerDashboard;
