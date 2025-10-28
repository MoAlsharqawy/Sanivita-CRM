import React, { useState, useMemo } from 'react';
import { User, VisitReport, SystemSettings, WeeklyPlan, Region } from '../types';
import { ArrowRightIcon, ChevronRightIcon, ChevronLeftIcon, MapPinIcon } from './icons';

interface WeeklyViewProps {
  user: User;
  visits: VisitReport[];
  settings: SystemSettings | null;
  plan: WeeklyPlan['plan'] | null;
  regions: Region[];
  onBack: () => void;
}

const WEEK_DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

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
  const [currentDate, setCurrentDate] = useState(new Date());

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
  const weekRangeString = `${weekStart.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}`;


  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-blue-800">الخطة الأسبوعية</h2>
        <button
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors"
          aria-label="العودة إلى لوحة التحكم"
        >
          <span className="hidden md:block">العودة للرئيسية</span>
          <ArrowRightIcon className="h-6 w-6 ms-2" />
        </button>
      </div>

      {/* Week Navigator */}
      <div className="flex justify-between items-center bg-white/40 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/50 mb-8">
        <button onClick={() => navigateWeek('prev')} className="p-2 text-slate-600 hover:text-orange-600 rounded-full hover:bg-slate-200/50 transition-colors" aria-label="الأسبوع السابق">
            <ChevronRightIcon className="w-6 h-6" />
        </button>
        <h3 className="text-lg md:text-xl font-bold text-slate-700 text-center">{weekRangeString}</h3>
        <button onClick={() => navigateWeek('next')} className="p-2 text-slate-600 hover:text-orange-600 rounded-full hover:bg-slate-200/50 transition-colors" aria-label="الأسبوع التالي">
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
          const dayName = WEEK_DAYS_AR[dayIndex];
          const isToday = toYYYYMMDD(new Date()) === dateStr;
          
          const regionId = plan ? plan[dayIndex] : null;
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
                  {date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' })}
                </p>
                {region && !isOffDay && (
                  <div className="flex items-center justify-center text-xs font-semibold text-slate-700 bg-white/60 px-2 py-1 rounded-full">
                      <MapPinIcon className="w-4 h-4 me-1.5" />
                      <span>{region.name}</span>
                  </div>
                )}
                {!region && !isOffDay && (
                     <div className="text-xs text-slate-400 italic py-1">لا توجد خطة</div>
                )}
              </div>
              <div className="text-center mt-auto pt-2">
                {isOffDay ? (
                    <span className="text-xs font-semibold bg-red-500/80 text-white px-3 py-1 rounded-full">
                        {isHoliday ? 'عطلة رسمية' : 'عطلة'}
                    </span>
                ) : (
                  <>
                    <p className={`text-4xl font-bold ${visitCount > 0 ? 'text-blue-700' : 'text-slate-400'}`}>{visitCount}</p>
                    <p className="text-xs text-slate-500">زيارة</p>
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