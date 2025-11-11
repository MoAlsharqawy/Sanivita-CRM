import React, { useMemo, useState } from 'react';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { VisitReport, User } from '../types';
import { DoctorIcon, PharmacyIcon } from './icons';

interface DailyVisitsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: VisitReport[];
  reps: User[];
  selectedRepId: string | 'all'; // The initially selected rep from the dashboard
}

const DailyVisitsDetailModal: React.FC<DailyVisitsDetailModalProps> = ({
  isOpen,
  onClose,
  reports,
  reps,
  selectedRepId: initialSelectedRepId,
}) => {
  const { t } = useLanguage();
  const [currentRepFilter, setCurrentRepFilter] = useState<string | 'all'>(initialSelectedRepId);

  // Filter for today's visits
  const todaysReports = useMemo(() => {
    const todayStr = new Date().toDateString();
    return reports.filter(report =>
      new Date(report.date).toDateString() === todayStr
    );
  }, [reports]);

  // Apply the rep filter
  const filteredDailyReports = useMemo(() => {
    if (currentRepFilter === 'all') {
      return todaysReports;
    }
    return todaysReports.filter(report => report.repName === reps.find(r => r.id === currentRepFilter)?.name);
  }, [todaysReports, currentRepFilter, reps]);

  // Determine the modal title
  const modalTitle = useMemo(() => {
    if (currentRepFilter === 'all') {
      return t('daily_visits_all_reps');
    }
    const repName = reps.find(r => r.id === currentRepFilter)?.name || t('unknown');
    return t('daily_visits_for_rep', repName);
  }, [currentRepFilter, reps, t]);

  // Reset filter when modal opens or initialSelectedRepId changes to ensure consistency
  React.useEffect(() => {
    if (isOpen) {
      setCurrentRepFilter(initialSelectedRepId);
    }
  }, [isOpen, initialSelectedRepId]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className="space-y-4">
        {/* Rep Filter if 'All' reps were selected initially */}
        {initialSelectedRepId === 'all' && (
            <div className="mb-4">
                <label htmlFor="repFilter" className="block text-sm font-medium text-slate-800 mb-2">
                    {t('filter_by_rep')}
                </label>
                <select
                    id="repFilter"
                    value={currentRepFilter}
                    onChange={(e) => setCurrentRepFilter(e.target.value)}
                    className="w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                    <option value="all">{t('all_reps')}</option>
                    {reps.map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.name}</option>
                    ))}
                </select>
            </div>
        )}


        {filteredDailyReports.length > 0 ? (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filteredDailyReports.map((visit) => (
              <li key={visit.id} className="p-4 bg-white/30 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex items-center">
                    {visit.type === 'DOCTOR_VISIT' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3 flex-shrink-0" /> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3 flex-shrink-0" />}
                    <div>
                      <p className="font-bold text-slate-800 flex items-center flex-wrap">
                        {visit.targetName}
                        {visit.targetSpecialization && (
                          <span className="text-xs bg-gray-200 text-gray-700 font-medium px-2 py-0.5 rounded-full ms-2">{t(visit.targetSpecialization)}</span>
                        )}
                        {visit.visitType && (
                          <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full ms-2">{t(visit.visitType)}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {new Date(visit.date).toLocaleString(t('locale'), { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${visit.type === 'DOCTOR_VISIT' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                    {t(visit.type)}
                  </span>
                </div>
                {/* Show Rep Name only if filtering 'all' or in all-reps view */}
                {initialSelectedRepId === 'all' && (
                    <p className="mt-1 text-xs text-slate-600 ps-9">
                        <span className="font-semibold">{t('rep_name')}:</span> {visit.repName}
                    </p>
                )}
                <p className="mt-2 text-sm text-slate-700 ps-9">{visit.notes}</p>
                {visit.productName && (
                  <p className="mt-1 text-xs text-slate-600 ps-9">
                    <span className="font-semibold">{t('products_label')}</span> {visit.productName}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-slate-600 py-8 text-lg">{t('no_daily_visits')}</p>
        )}
      </div>
    </Modal>
  );
};

export default DailyVisitsDetailModal;