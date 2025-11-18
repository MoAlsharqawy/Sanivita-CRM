import { VisitReport } from '../types';

export const calculateMonthlyStats = (visits: VisitReport[]) => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  let doctorVisits = 0;
  let pharmacyVisits = 0;
  const workingDays = new Set<string>();

  visits.forEach(visit => {
      const visitDate = new Date(visit.date);
      if (visitDate >= startOfMonth && visitDate <= today) {
          const dateStr = visitDate.toISOString().split('T')[0];
          workingDays.add(dateStr);
          if (visit.type === 'DOCTOR_VISIT') {
              doctorVisits++;
          } else if (visit.type === 'PHARMACY_VISIT') {
              pharmacyVisits++;
          }
      }
  });

  const totalMonthlyVisits = doctorVisits + pharmacyVisits;
  const numberOfWorkingDays = workingDays.size;
  const visitsPerWorkingDay = numberOfWorkingDays > 0 ? (totalMonthlyVisits / numberOfWorkingDays) : 0;

  return { doctorVisits, pharmacyVisits, totalMonthlyVisits, visitsPerWorkingDay };
};

export const calculateDailyStats = (visits: VisitReport[]) => {
  const todayStr = new Date().toDateString();
  
  let doctorVisits = 0;
  let pharmacyVisits = 0;

  visits.forEach(visit => {
      const visitDateStr = new Date(visit.date).toDateString();
      if (visitDateStr === todayStr) {
          if (visit.type === 'DOCTOR_VISIT') {
              doctorVisits++;
          } else if (visit.type === 'PHARMACY_VISIT') {
              pharmacyVisits++;
          }
      }
  });

  return { doctorVisits, pharmacyVisits, totalToday: doctorVisits + pharmacyVisits };
};