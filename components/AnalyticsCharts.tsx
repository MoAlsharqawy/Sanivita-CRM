import React, { useEffect, useRef } from 'react';
import { VisitReport } from '../types';
import { useLanguage } from '../hooks/useLanguage';

declare const Chart: any;

interface AnalyticsChartsProps {
  reports: VisitReport[];
}

const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ reports }) => {
  const { t } = useLanguage();
  const visitsByRepChartRef = useRef<HTMLCanvasElement>(null);
  const visitTypeChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    // Destroy previous charts before redrawing
    Object.values(chartInstances.current).forEach((chart: any) => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    chartInstances.current = {};

    if (reports.length === 0) {
      return; // Don't render charts if there's no data
    }

    // --- Chart 1: Visits by Rep ---
    if (visitsByRepChartRef.current) {
      const ctx = visitsByRepChartRef.current.getContext('2d');
      if (ctx) {
        const visitsByRep = reports.reduce((acc, report) => {
          acc[report.repName] = (acc[report.repName] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number });

        const labels = Object.keys(visitsByRep);
        const data = Object.values(visitsByRep);

        chartInstances.current.visitsByRep = new Chart(ctx, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: t('visit_count_label'),
              data,
              backgroundColor: 'rgba(59, 130, 246, 0.6)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            },
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });
      }
    }

    // --- Chart 2: Visit Type Distribution ---
    if (visitTypeChartRef.current) {
      const ctx = visitTypeChartRef.current.getContext('2d');
      if (ctx) {
        const doctorVisits = reports.filter(r => r.type === 'DOCTOR_VISIT').length;
        const pharmacyVisits = reports.filter(r => r.type === 'PHARMACY_VISIT').length;

        chartInstances.current.visitType = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: [t('doctors'), t('pharmacies')],
            datasets: [{
              data: [doctorVisits, pharmacyVisits],
              backgroundColor: [
                'rgba(59, 130, 246, 0.7)',
                'rgba(249, 115, 22, 0.7)',
              ],
              borderColor: [
                'rgba(59, 130, 246, 1)',
                'rgba(249, 115, 22, 1)',
              ],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
              }
            }
          }
        });
      }
    }

  }, [reports, t]);

  return (
    <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50 mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
       <h3 className="text-xl font-semibold mb-4 text-blue-700">{t('analytics_overview')}</h3>
       {reports.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" style={{ minHeight: '300px' }}>
          <div>
            <h4 className="text-md font-semibold text-center text-slate-700 mb-2">{t('visits_by_rep')}</h4>
            <div className="relative h-64 md:h-72">
                <canvas ref={visitsByRepChartRef}></canvas>
            </div>
          </div>
          <div>
            <h4 className="text-md font-semibold text-center text-slate-700 mb-2">{t('visit_distribution')}</h4>
             <div className="relative h-64 md:h-72">
               <canvas ref={visitTypeChartRef}></canvas>
            </div>
          </div>
        </div>
       ) : (
         <div className="text-center py-12 text-slate-600">{t('no_data_for_charts')}</div>
       )}
    </div>
  );
};

export default AnalyticsCharts;