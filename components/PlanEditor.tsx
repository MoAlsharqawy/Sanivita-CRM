import React, { useState } from 'react';
import { User, Region, WeeklyPlan } from '../types';
import { api } from '../services/mockData';
import { SaveIcon, ArrowRightIcon, MapPinIcon } from './icons';

interface PlanEditorProps {
  user: User;
  regions: Region[];
  initialPlan: WeeklyPlan | null;
  onPlanSaved: (newPlan: WeeklyPlan) => void;
  onBack: () => void;
}

// Order days starting from Saturday
const WORK_WEEK_DAYS = [
    { name: 'السبت', index: 6 },
    { name: 'الأحد', index: 0 },
    { name: 'الاثنين', index: 1 },
    { name: 'الثلاثاء', index: 2 },
    { name: 'الأربعاء', index: 3 },
    { name: 'الخميس', index: 4 },
    { name: 'الجمعة', index: 5 },
];

const PlanEditor: React.FC<PlanEditorProps> = ({ user, regions, initialPlan, onPlanSaved, onBack }) => {
    const [planData, setPlanData] = useState<WeeklyPlan['plan']>(initialPlan?.plan || {});
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleRegionChange = (dayIndex: number, regionId: string) => {
        const newPlan = { ...planData };
        if (regionId === 'none') {
            // Use null to signify no plan, or delete the key. Deleting is cleaner.
            delete newPlan[dayIndex];
        } else {
            newPlan[dayIndex] = parseInt(regionId);
        }
        setPlanData(newPlan);
    };
    
    const handleSave = async () => {
        setSaving(true);
        setMessage('');
        try {
            const updatedPlan = await api.updateRepPlan(user.id, planData);
            setMessage('تم إرسال الخطة للمراجعة بنجاح!');
            setTimeout(() => {
                onPlanSaved(updatedPlan);
            }, 1500);
        } catch (error) {
            setMessage('حدث خطأ أثناء إرسال الخطة.');
            console.error(error);
            setTimeout(() => setMessage(''), 4000);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-blue-800">إعداد الخطة الأسبوعية</h2>
                <button
                    onClick={onBack}
                    className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors"
                    aria-label="العودة"
                >
                    <span>العودة للرئيسية</span>
                    <ArrowRightIcon className="h-6 w-6 ms-2" />
                </button>
            </div>

            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
                {initialPlan?.status === 'rejected' && (
                    <div className="mb-4 p-4 bg-red-100/60 text-red-800 rounded-lg shadow border border-red-200">
                        <p className="font-bold">تم رفض خطتك السابقة.</p>
                        <p className="text-sm">يرجى تعديل الخطة وإرسالها مرة أخرى للاعتماد.</p>
                    </div>
                )}
                <p className="mb-6 text-slate-700">حدد المنطقة التي ستزورها في كل يوم من أيام الأسبوع.</p>
                <div className="space-y-4">
                    {WORK_WEEK_DAYS.map(day => (
                        <div key={day.index} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/30 rounded-lg">
                            <label className="font-bold text-lg text-slate-800 sm:mb-0 mb-2">{day.name}</label>
                            <div className="relative w-full sm:w-64">
                                 <div className="absolute inset-y-0 left-0 ps-3 flex items-center pointer-events-none">
                                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <select
                                    value={planData[day.index] || 'none'}
                                    onChange={(e) => handleRegionChange(day.index, e.target.value)}
                                    className="appearance-none block w-full bg-white/50 border border-slate-300/50 text-slate-900 py-2 px-4 ps-10 rounded-lg focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="none">لا توجد خطة لهذا اليوم</option>
                                    {regions.map(region => (
                                        <option key={region.id} value={region.id}>{region.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                 <div className="flex items-center justify-end mt-6 pt-4 border-t border-slate-300/50">
                     {message && <p className="text-green-700 me-4 font-semibold">{message}</p>}
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg flex items-center gap-2 disabled:bg-orange-300"
                    >
                        <SaveIcon className="w-5 h-5"/>
                        {saving ? 'جاري الإرسال...' : 'إرسال للاعتماد'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PlanEditor;