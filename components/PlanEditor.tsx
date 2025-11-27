
import React, { useState, useMemo, useEffect } from 'react';
import { User, Region, WeeklyPlan, Doctor, DayPlanDetails } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';
import { SaveIcon, ArrowRightIcon, MapPinIcon, DoctorIcon, TrashIcon, CalendarIcon, CheckCircleIcon } from './icons';
import Spinner from './Spinner';

interface PlanEditorProps {
  user: User;
  regions: Region[];
  initialPlan: WeeklyPlan | null;
  startDate?: Date; // Optional, defaults to current logic if not provided
  onPlanSaved: (newPlan: WeeklyPlan) => void;
  onBack: () => void;
}

const PlanEditor: React.FC<PlanEditorProps> = ({ user, regions, initialPlan, startDate, onPlanSaved, onBack }) => {
    const { t } = useLanguage();
    
    // Robustly initialize planData. Fallback to empty object if initialPlan.plan is undefined/null
    const [planData, setPlanData] = useState<WeeklyPlan['plan']>(() => {
        return initialPlan?.plan ? { ...initialPlan.plan } : {};
    });

    const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
      const fetchDoctors = async () => {
        setLoading(true);
        try {
          const doctorsData = await api.getAllDoctors();
          setAllDoctors(doctorsData);
        } catch (error) {
          console.error("Failed to fetch doctors:", error);
          setMessage(t('error_fetching_doctors'));
        } finally {
          setLoading(false);
        }
      };
      fetchDoctors();
    }, [t]);

    // Helper to get the specific date for a day index
    const getDayDateLabel = (dayIndex: number) => {
        if (!startDate) return '';
        const d = new Date(startDate);
        // startDate is expected to be Saturday.
        const offset = dayIndex === 6 ? 0 : dayIndex + 1;
        d.setDate(d.getDate() + offset);
        return d.toLocaleDateString(t('locale'), { day: 'numeric', month: 'numeric' });
    };


    const WORK_WEEK_DAYS = useMemo(() => [
        { name: t('saturday'), index: 6 },
        { name: t('sunday'), index: 0 },
        { name: t('monday'), index: 1 },
        { name: t('tuesday'), index: 2 },
        { name: t('wednesday'), index: 3 },
        { name: t('thursday'), index: 4 },
        { name: t('friday'), index: 5 },
    ], [t]);

    const doctorMap = useMemo(() => new Map(allDoctors.map(doc => [doc.id, doc])), [allDoctors]);

    // Get all doctor IDs that are already assigned to any day in the plan
    const assignedDoctorIds = useMemo(() => {
      const assigned = new Set<number>();
      if (!planData) return assigned;

      try {
        Object.values(planData).forEach(dayPlan => {
            const details = dayPlan as DayPlanDetails | null;
            if (details && Array.isArray(details.doctorIds)) {
                details.doctorIds.forEach(docId => {
                     if (typeof docId === 'number') assigned.add(docId);
                });
            }
        });
      } catch (e) {
        console.error("Error calculating assigned doctors:", e);
      }
      return assigned;
    }, [planData]);

    const handleRegionChange = (dayIndex: number, regionIdStr: string) => {
        setPlanData(prevPlan => {
            const newPlan: WeeklyPlan['plan'] = { ...(prevPlan || {}) };
            const regionId = parseInt(regionIdStr);

            if (regionIdStr === 'none' || isNaN(regionId)) {
                newPlan[dayIndex] = null;
            } else {
                const existingDayPlanEntry = newPlan[dayIndex] as DayPlanDetails | null | undefined;
                
                // If the region has changed, clear the doctors list
                const doctorIds = (existingDayPlanEntry?.regionId === regionId) 
                    ? (existingDayPlanEntry?.doctorIds || []) 
                    : [];

                newPlan[dayIndex] = {
                    regionId: regionId,
                    doctorIds: doctorIds, 
                };
            }
            return newPlan;
        });
    };
    
    const handleAddDoctor = (dayIndex: number, doctorIdStr: string) => {
        const doctorId = parseInt(doctorIdStr);
        if (isNaN(doctorId) || assignedDoctorIds.has(doctorId)) return; 

        setPlanData(prevPlan => {
            const newPlan: WeeklyPlan['plan'] = { ...(prevPlan || {}) };
            const currentDayPlanEntry = newPlan[dayIndex] as DayPlanDetails | null | undefined;

            if (currentDayPlanEntry) {
                const currentDoctorIds = currentDayPlanEntry.doctorIds || []; 
                if (!currentDoctorIds.includes(doctorId)) {
                    newPlan[dayIndex] = {
                        ...currentDayPlanEntry,
                        doctorIds: [...currentDoctorIds, doctorId],
                    };
                }
            } else {
                // Handle case where day plan doesn't exist yet (implicit region selection)
                const doctor = allDoctors.find(d => d.id === doctorId);
                const regionId = doctor?.regionId;
                
                if (regionId !== undefined) {
                  newPlan[dayIndex] = { regionId, doctorIds: [doctorId] };
                }
            }
            return newPlan;
        });
    };

    const handleRemoveDoctor = (dayIndex: number, doctorId: number) => {
        setPlanData(prevPlan => {
            const newPlan: WeeklyPlan['plan'] = { ...(prevPlan || {}) };
            const currentDayPlanEntry = newPlan[dayIndex] as DayPlanDetails | null | undefined;
            
            if (currentDayPlanEntry && currentDayPlanEntry.doctorIds) {
                newPlan[dayIndex] = {
                    ...currentDayPlanEntry,
                    doctorIds: currentDayPlanEntry.doctorIds.filter(id => id !== doctorId),
                };
            }
            return newPlan;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const cleanedPlan: WeeklyPlan['plan'] = {};
            WORK_WEEK_DAYS.forEach(day => {
                const dayPlan = planData[day.index];
                if (dayPlan) {
                    cleanedPlan[day.index] = dayPlan;
                } else {
                    cleanedPlan[day.index] = null;
                }
            });

            const updatedPlan = await api.updateRepPlan(user.id, cleanedPlan);
            setMessage(t('plan_submitted_success'));
            setTimeout(() => {
                onPlanSaved(updatedPlan);
            }, 1500);
        } catch (error) {
            setMessage(t('plan_submitted_error'));
            console.error(error);
            setTimeout(() => setMessage(''), 4000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
      return <Spinner />;
    }

    return (
        <div className="container mx-auto pb-10">
             <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-bold text-blue-800">{t('setup_weekly_plan')}</h2>
                    {startDate && (
                         <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                             <CalendarIcon className="w-4 h-4"/>
                             {t('planning_for_week_starting', startDate.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long', year: 'numeric' }))}
                         </p>
                    )}
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors"
                    aria-label={t('back')}
                >
                    <span>{t('back_to_main')}</span>
                    <ArrowRightIcon className="h-6 w-6 ms-2" />
                </button>
            </div>

            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
                {initialPlan?.status === 'rejected' && (
                    <div className="mb-6 p-4 bg-red-100/80 text-red-800 rounded-lg shadow-sm border border-red-200">
                        <p className="font-bold flex items-center gap-2"><TrashIcon className="w-5 h-5"/>{t('plan_rejected_notice')}</p>
                        <p className="text-sm mt-1 ms-7">{t('plan_rejected_instructions')}</p>
                    </div>
                )}
                
                <p className="mb-6 text-slate-700 bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm">
                    {t('plan_editor_instructions_doctors')}
                </p>

                <div className="space-y-6">
                    {WORK_WEEK_DAYS.map(day => {
                        const dayPlan = planData[day.index] as DayPlanDetails | null | undefined;
                        const selectedRegionId = dayPlan?.regionId;
                        const doctorsForDay = dayPlan?.doctorIds || [];
                        const availableDoctorsInRegion = allDoctors.filter(doc => 
                            doc.regionId === selectedRegionId && 
                            !assignedDoctorIds.has(doc.id) 
                        );
                        
                        // Determine visual state based on whether a plan exists for this day
                        const hasPlan = !!selectedRegionId;
                        
                        return (
                            <div 
                                key={day.index} 
                                className={`
                                    rounded-xl transition-all duration-300 overflow-hidden
                                    ${hasPlan 
                                        ? 'bg-white shadow-md border-l-8 border-l-blue-500 border-y border-r border-slate-200' 
                                        : 'bg-slate-50/80 border border-slate-200 opacity-90 hover:opacity-100 hover:bg-white'}
                                `}
                            >
                                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
                                    
                                    {/* Left Column: Day Header & Settings */}
                                    <div className="lg:w-1/3 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <label className={`font-bold text-xl ${hasPlan ? 'text-blue-900' : 'text-slate-600'}`}>
                                                        {day.name}
                                                    </label>
                                                    {hasPlan && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                                                </div>
                                                {startDate && (
                                                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {getDayDateLabel(day.index)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 mt-1">
                                            {/* Region Selector */}
                                            <div className="relative">
                                                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                                    <MapPinIcon className={`h-5 w-5 ${hasPlan ? 'text-blue-500' : 'text-slate-400'}`} />
                                                </div>
                                                <select
                                                    value={selectedRegionId || 'none'}
                                                    onChange={(e) => handleRegionChange(day.index, e.target.value)}
                                                    className={`appearance-none block w-full py-2.5 px-4 ps-10 rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors cursor-pointer
                                                        ${hasPlan 
                                                            ? 'bg-blue-50 text-blue-900 border border-blue-200 focus:ring-blue-500 focus:border-blue-500' 
                                                            : 'bg-white border border-slate-300 text-slate-700 focus:ring-slate-400'
                                                        }`}
                                                >
                                                    <option value="none">{t('no_plan_for_this_day')}</option>
                                                    {regions.map(region => (
                                                        <option key={region.id} value={region.id}>{region.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Doctor Selector */}
                                            {hasPlan && (
                                                <div className="relative animate-fade-in">
                                                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                                        <DoctorIcon className="h-5 w-5 text-slate-400" />
                                                    </div>
                                                    <select
                                                        value="add_doctor" 
                                                        onChange={(e) => handleAddDoctor(day.index, e.target.value)}
                                                        disabled={availableDoctorsInRegion.length === 0}
                                                        className="appearance-none block w-full bg-white border border-slate-300 text-slate-900 py-2.5 px-4 ps-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                                                    >
                                                        <option value="add_doctor" disabled>{t('add_doctor_to_day')}</option>
                                                        {availableDoctorsInRegion.map(doc => (
                                                            <option key={doc.id} value={doc.id}>{doc.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: Selected Doctors (Plan Details) */}
                                    <div className="lg:w-2/3 bg-slate-50/50 rounded-lg p-3 border border-slate-100 min-h-[100px] flex flex-col">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                                            <CalendarIcon className="w-3 h-3"/> {t('planned_visits')}
                                        </p>
                                        
                                        {doctorsForDay.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {doctorsForDay.map(docId => {
                                                    const doctor = doctorMap.get(docId);
                                                    return doctor ? (
                                                        <div 
                                                            key={docId} 
                                                            className="flex items-center gap-2 bg-white border border-blue-200 text-blue-900 text-sm font-medium px-3 py-1.5 rounded-full shadow-sm animate-fade-in"
                                                        >
                                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                            {doctor.name}
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleRemoveDoctor(day.index, docId)} 
                                                                className="ms-1 text-slate-400 hover:text-red-500 focus:outline-none transition-colors p-0.5 rounded-full hover:bg-red-50"
                                                                aria-label={t('remove_doctor', doctor.name)}
                                                            >
                                                                <TrashIcon className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    ) : null;
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex-grow flex items-center justify-center text-slate-400 text-sm italic">
                                                {hasPlan 
                                                    ? t('no_doctors_selected_yet') 
                                                    : t('select_region_to_start')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                 <div className="flex items-center justify-end mt-8 pt-6 border-t border-slate-300/50 sticky bottom-0 bg-white/80 backdrop-blur p-4 rounded-b-2xl z-10">
                     {message && <p className="text-green-700 me-4 font-semibold animate-fade-in">{message}</p>}
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-orange-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-orange-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 disabled:bg-orange-300"
                    >
                        <SaveIcon className="w-5 h-5"/>
                        {saving ? t('submitting_for_approval') : t('submit_for_approval')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PlanEditor;
