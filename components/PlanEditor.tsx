
import React, { useState, useMemo, useEffect } from 'react';
import { User, Region, WeeklyPlan, Doctor, DayPlanDetails } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';
import { SaveIcon, ArrowRightIcon, MapPinIcon, DoctorIcon, TrashIcon } from './icons';
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
        // Day indices: 6(Sat), 0(Sun), 1(Mon), 2(Tue), 3(Wed), 4(Thu), 5(Fri)
        // Offset logic: 
        // If dayIndex is 6 (Sat), offset is 0.
        // If dayIndex is 0 (Sun), offset is 1.
        // ... 
        // If dayIndex is 5 (Fri), offset is 6.
        
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
            // Explicitly cast/check dayPlan
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
            // Ensure we work with a safe object
            const newPlan: WeeklyPlan['plan'] = { ...(prevPlan || {}) };
            const regionId = parseInt(regionIdStr);

            if (regionIdStr === 'none' || isNaN(regionId)) {
                newPlan[dayIndex] = null;
            } else {
                const existingDayPlanEntry = newPlan[dayIndex] as DayPlanDetails | null | undefined;
                
                // If the region has changed, clear the doctors list as they likely don't belong to the new region.
                // If it's the same region, preserve existing doctors.
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
        if (isNaN(doctorId) || assignedDoctorIds.has(doctorId)) return; // Prevent adding already assigned doctor or invalid ID

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
                // Handle case where day plan doesn't exist yet
                // We need to find the region from the doctor, as the day plan is empty
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
            // Clean up plan data before sending
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
        <div className="container mx-auto">
             <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                    <h2 className="text-3xl font-bold text-blue-800">{t('setup_weekly_plan')}</h2>
                    {startDate && (
                         <p className="text-sm text-slate-600 mt-1">
                             {t('planning_for_week_starting', startDate.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long', year: 'numeric' }))}
                         </p>
                    )}
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none focus:ring-colors"
                    aria-label={t('back')}
                >
                    <span>{t('back_to_main')}</span>
                    <ArrowRightIcon className="h-6 w-6 ms-2" />
                </button>
            </div>

            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
                {initialPlan?.status === 'rejected' && (
                    <div className="mb-4 p-4 bg-red-100/60 text-red-800 rounded-lg shadow border border-red-200">
                        <p className="font-bold">{t('plan_rejected_notice')}</p>
                        <p className="text-sm">{t('plan_rejected_instructions')}</p>
                    </div>
                )}
                <p className="mb-6 text-slate-700">{t('plan_editor_instructions_doctors')}</p>
                <div className="space-y-4">
                    {WORK_WEEK_DAYS.map(day => {
                        const dayPlan = planData[day.index] as DayPlanDetails | null | undefined;
                        const selectedRegionId = dayPlan?.regionId;
                        const doctorsForDay = dayPlan?.doctorIds || [];
                        const availableDoctorsInRegion = allDoctors.filter(doc => 
                            doc.regionId === selectedRegionId && 
                            !assignedDoctorIds.has(doc.id) // Exclude doctors assigned to other days
                        );
                        
                        return (
                            <div key={day.index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/30 rounded-lg">
                                <div className="sm:mb-0 mb-2 min-w-[120px]">
                                    <label className="font-bold text-lg text-slate-800 block">{day.name}</label>
                                    {startDate && (
                                        <span className="text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-full mt-1 inline-block">
                                            {getDayDateLabel(day.index)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row flex-grow items-stretch sm:items-center gap-3 w-full">
                                    {/* Region Selector */}
                                    <div className="relative w-full sm:w-1/2">
                                        <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                            <MapPinIcon className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <select
                                            value={selectedRegionId || 'none'}
                                            onChange={(e) => handleRegionChange(day.index, e.target.value)}
                                            className="appearance-none block w-full bg-white/50 border border-slate-300/50 text-slate-900 py-2 px-4 ps-10 rounded-lg focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                        >
                                            <option value="none">{t('no_plan_for_this_day')}</option>
                                            {regions.map(region => (
                                                <option key={region.id} value={region.id}>{region.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Doctor Selector (Conditional) */}
                                    {selectedRegionId && (
                                        <div className="relative w-full sm:w-1/2">
                                            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                                <DoctorIcon className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <select
                                                value="add_doctor" // This is a placeholder value, actual selection happens via onChange
                                                onChange={(e) => handleAddDoctor(day.index, e.target.value)}
                                                disabled={availableDoctorsInRegion.length === 0}
                                                className="appearance-none block w-full bg-white/50 border border-slate-300/50 text-slate-900 py-2 px-4 ps-10 rounded-lg focus:outline-none focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-200/50 disabled:cursor-not-allowed"
                                            >
                                                <option value="add_doctor" disabled>{t('add_doctor_to_day')}</option>
                                                {availableDoctorsInRegion.map(doc => (
                                                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Selected Doctors Display */}
                                {doctorsForDay.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 sm:ms-4 w-full sm:w-auto">
                                        {doctorsForDay.map(docId => {
                                            const doctor = doctorMap.get(docId);
                                            return doctor ? (
                                                <span key={docId} className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                                                    {doctor.name}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveDoctor(day.index, docId)} 
                                                        className="ms-1 text-blue-600 hover:text-blue-900 focus:outline-none"
                                                        aria-label={t('remove_doctor', doctor.name)}
                                                    >
                                                        <TrashIcon className="w-4 h-4"/>
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                 <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-300/50">
                     {message && <p className="text-green-700 me-4 font-semibold">{message}</p>}
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg flex items-center gap-2 disabled:bg-orange-300"
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
