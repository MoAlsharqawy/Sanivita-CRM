import React, { useState, useMemo, useEffect } from 'react';
import { User, VisitReport, SystemSettings, WeeklyPlan, Region, Doctor } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { ArrowRightIcon, ChevronRightIcon, ChevronLeftIcon, MapPinIcon, DoctorIcon } from './icons';
import { api } from '../services/api';
import Spinner from './Spinner';

interface WeeklyViewProps {
  user: User;
  visits: VisitReport[];
  settings: SystemSettings | null;
  plan: WeeklyPlan['plan'] | null; // This is now the new, nested plan structure
  regions: Region[];
  onBack: () => void;
}

// Helper to get dates for a week starting from Saturday
const getWeekDates = (currentDate: Date): Date[] => {
    const week: Date[] = [];
    // Find the previous Saturday to start the week
    const d = new Date(currentDate);
    const day = d.getDay(); // Sunday = 0, ..., Saturday = 6
    const diff = (day < 6) ? (day + 1) : 0; // Days to subtract to get to the previous Saturday
    d.setDate(d.getDate() - diff);

    for (let i = 0; i < 7; i++) {
        const date = new Date(d);
        date.setDate(d.getDate() + i);
        week.push(date);
    }
    return week;
};

// Helper to format date to YYYY-MM-DD for comparison
const toYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const WeeklyView: React.FC<WeeklyViewProps> = ({ user, visits, settings, plan, regions, onBack }) => {
  const { t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const doctorsData = await api.getAllDoctors();
        setAllDoctors(doctorsData);
      } catch (error) {
        console.error("Failed to fetch all doctors for WeeklyView:", error);
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, []);

  const WEEK_DAYS = useMemo(() => [t('sunday'), t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday')], [t]);
  const doctorMap = useMemo(() => new Map(allDoctors.map(doc => [doc.id, doc])), [allDoctors]);


  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const visitsByDate = useMemo(() => {
    const map = new Map<string, number>();
    visits.forEach(visit => {
        const dateStr = toYYYYMMDD(new Date(visit.date));
        map.set(dateStr, (map.get(dateStr) || 0) + 1);
    });
    return map;
  }, [visits]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
        return newDate;
    });
  };

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekRangeString = `${weekStart.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long', year: 'numeric' })}`;


  if (loadingDoctors) {
    return <Spinner />;
  }

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-blue-800">{t('weekly_plan')}</h2>
        <button
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors"
          aria-label={t('back_to_dashboard')}
        >
          <span className="hidden md:block">{t('back_to_main')}</span>
          <ArrowRightIcon className="h-6 w-6 ms-2" />
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex justify-between items-center bg-white/40 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/50 mb-8">
        <button onClick={() => navigateWeek('prev')} className="p-2 text-slate-600 hover:text-orange-600 rounded-full hover:bg-slate-200/50 transition-colors" aria-label={t('previous_week')}>
            <ChevronRightIcon className="w-6 h-6" />
        </button>
        <h3 className="text-lg md:text-xl font-bold text-slate-700 text-center">{weekRangeString}</h3>
        <button onClick={() => navigateWeek('next')} className="p-2 text-slate-600 hover:text-orange-600 rounded-full hover:bg-slate-200/50 transition-colors" aria-label={t('next_week')}>
            <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {weekDates.map(date => {
          const dateStr = toYYYYMMDD(date);
          const dayIndex = date.getDay();
          const isWeekend = settings?.weekends.includes(dayIndex) ?? false;
          const isHoliday = settings?.holidays.includes(dateStr) ?? false;
          const isOffDay = isWeekend || isHoliday;
          const visitCount = visitsByDate.get(dateStr) || 0;
          const dayName = WEEK_DAYS[dayIndex];
          const isToday = toYYYYMMDD(new Date()) === dateStr;
          
          const dayPlan = plan ? plan[dayIndex] : null;
          const regionId = dayPlan?.regionId;
          const doctorIds = dayPlan?.doctorIds || [];
          const region = regionId ? regions.find(r => r.id === regionId) : null;

          const cardClasses = `
            p-4 rounded-2xl shadow-lg border flex flex-col items-center justify-between min-h-[160px] transition-all duration-300
            ${isOffDay ? 'bg-slate-800 text-white border-slate-700' : 'bg-white/40 backdrop-blur-lg border-white/50'}
            ${isToday && !isOffDay ? 'ring-2 ring-orange-500' : ''}
          `;

          return (
            <div key={dateStr} className={cardClasses}>
              <div className="text-center w-full">
                <p className={`font-bold text-lg ${isOffDay ? 'text-slate-300' : 'text-slate-800'}`}>{dayName}</p>
                <p className={`text-sm mb-2 ${isOffDay ? 'text-slate-400' : 'text-slate-600'}`}>
                  {date.toLocaleDateString(t('locale'), { day: 'numeric', month: 'numeric' })}
                </p>
                {region && !isOffDay && (
                  <div className="flex items-center justify-center text-xs font-semibold text-slate-700 bg-white/60 px-2 py-1 rounded-full">
                      <MapPinIcon className="w-4 h-4 me-1.5" />
                      <span>{region.name}</span>
                  </div>
                )}
                {!region && !isOffDay && doctorIds.length === 0 && (
                     <div className="text-xs text-slate-400 italic py-1">{t('no_plan_for_day')}</div>
                )}
                 {doctorIds.length > 0 && !isOffDay && (
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                        {doctorIds.map(docId => (
                            <span key={docId} className="flex items-center text-xs bg-blue-500/20 text-blue-700 px-2 py-0.5 rounded-full">
                                <DoctorIcon className="w-3 h-3 me-1" />
                                {doctorMap.get(docId)?.name || t('unknown_doctor')}
                            </span>
                        ))}
                    </div>
                )}
              </div>
              <div className="text-center mt-auto pt-2">
                {isOffDay ? (
                    <span className="text-xs font-semibold bg-red-500/80 text-white px-3 py-1 rounded-full">
                        {isHoliday ? t('official_holiday') : t('weekend_holiday')}
                    </span>
                ) : (
                  <>
                    <p className={`text-4xl font-bold ${visitCount > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{visitCount}</p>
                    <p className="text-xs text-slate-500">{t('visit_count_label')}</p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyView;