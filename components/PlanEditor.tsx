import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, Region, WeeklyPlan, Doctor } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';
import { SaveIcon, ArrowRightIcon, MapPinIcon, DoctorIcon, TrashIcon } from './icons';
import Spinner from './Spinner';

interface PlanEditorProps {
  user: User;
  regions: Region[];
  initialPlan: WeeklyPlan | null;
  onPlanSaved: (newPlan: WeeklyPlan) => void;
  onBack: () => void;
}

const PlanEditor: React.FC<PlanEditorProps> = ({ user, regions, initialPlan, onPlanSaved, onBack }) => {
    const { t } = useLanguage();
    // Initialize planData to match the new structure: { dayIndex: { regionId: number, doctorIds: number[] } | null }
    const [planData, setPlanData] = useState<WeeklyPlan['plan']>(initialPlan?.plan || {});
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
          setMessage(t('error_fetching_doctors')); // Add this translation key
        } finally {
          setLoading(false);
        }
      };
      fetchDoctors();
    }, [t]);

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
      Object.values(planData).forEach(dayPlan => {
        if (dayPlan && dayPlan.doctorIds) {
          dayPlan.doctorIds.forEach(docId => assigned.add(docId));
        }
      });
      return assigned;
    }, [planData]);

    const handleRegionChange = (dayIndex: number, regionIdStr: string) => {
        const newPlan = { ...planData };
        const regionId = parseInt(regionIdStr);

        if (regionIdStr === 'none' || isNaN(regionId)) {
            newPlan[dayIndex] = null;
        } else {
            newPlan[dayIndex] = {
                regionId: regionId,
                doctorIds: newPlan[dayIndex]?.doctorIds || [], // Keep existing doctors if any
            };
        }
        setPlanData(newPlan);
    };
    
    const handleAddDoctor = (dayIndex: number, doctorIdStr: string) => {
        const doctorId = parseInt(doctorIdStr);
        if (isNaN(doctorId) || assignedDoctorIds.has(doctorId)) return; // Prevent adding already assigned doctor or invalid ID

        setPlanData(prevPlan => {
            const newPlan = { ...prevPlan };
            if (newPlan[dayIndex]) {
                const currentDoctorIds = newPlan[dayIndex]?.doctorIds || [];
                if (!currentDoctorIds.includes(doctorId)) {
                    newPlan[dayIndex] = {
                        ...newPlan[dayIndex]!,
                        doctorIds: [...currentDoctorIds, doctorId],
                    };
                }
            } else {
                // Should not happen if region is selected, but as a safeguard
                const regionId = allDoctors.find(d => d.id === doctorId)?.regionId;
                if (regionId) {
                  newPlan[dayIndex] = { regionId, doctorIds: [doctorId] };
                }
            }
            return newPlan;
        });
    };

    const handleRemoveDoctor = (dayIndex: number, doctorId: number) => {
        setPlanData(prevPlan => {
            const newPlan = { ...prevPlan };
            if (newPlan[dayIndex]) {
                newPlan[dayIndex] = {
                    ...newPlan[dayIndex]!,
                    doctorIds: newPlan[dayIndex]!.doctorIds.filter(id => id !== doctorId),
                };
                // If no doctors left for the day, set it to null or just region
                // For simplicity, we'll keep the region if it exists
                if (newPlan[dayIndex]?.doctorIds.length === 0) {
                    // Option 1: remove the whole day plan if no doctors
                    // newPlan[dayIndex] = null;
                    // Option 2: keep region but no doctors
                }
            }
            return newPlan;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const updatedPlan = await api.updateRepPlan(user.id, planData);
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
                <h2 className="text-3xl font-bold text-blue-800">{t('setup_weekly_plan')}</h2>
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
                    <div className="mb-4 p-4 bg-red-100/60 text-red-800 rounded-lg shadow border border-red-200">
                        <p className="font-bold">{t('plan_rejected_notice')}</p>
                        <p className="text-sm">{t('plan_rejected_instructions')}</p>
                    </div>
                )}
                <p className="mb-6 text-slate-700">{t('plan_editor_instructions_doctors')}</p>
                <div className="space-y-4">
                    {WORK_WEEK_DAYS.map(day => {
                        const dayPlan = planData[day.index];
                        const selectedRegionId = dayPlan?.regionId;
                        const doctorsForDay = dayPlan?.doctorIds || [];
                        const availableDoctorsInRegion = allDoctors.filter(doc => 
                            doc.regionId === selectedRegionId && 
                            !assignedDoctorIds.has(doc.id) // Exclude doctors assigned to other days
                        );
                        
                        return (
                            <div key={day.index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white/30 rounded-lg">
                                <label className="font-bold text-lg text-slate-800 sm:mb-0 mb-2 min-w-[100px]">{day.name}</label>
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