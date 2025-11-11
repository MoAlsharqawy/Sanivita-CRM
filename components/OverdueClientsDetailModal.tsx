
import React, { useMemo, useState, useEffect } from 'react';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { ClientAlert, User, Region } from '../types';
import { DoctorIcon, PharmacyIcon } from './icons';

interface OverdueClientsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ClientAlert[]; // Full list of all overdue alerts
  reps: User[];
  regions: Region[];
}

const OverdueClientsDetailModal: React.FC<OverdueClientsDetailModalProps> = ({
  isOpen,
  onClose,
  alerts,
  reps,
  regions,
}) => {
  const { t } = useLanguage();
  const [currentRepFilter, setCurrentRepFilter] = useState<string | 'all'>('all');

  useEffect(() => {
    if (isOpen) {
      setCurrentRepFilter('all'); // Reset filter whenever the modal opens
    }
  }, [isOpen]);

  const filteredAlerts = useMemo(() => {
    if (currentRepFilter === 'all') {
      return alerts;
    }
    return alerts.filter(alert => alert.repId === currentRepFilter);
  }, [alerts, currentRepFilter]);

  const regionMap = useMemo(() => new Map(regions.map(r => [r.id, r.name])), [regions]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('overdue_clients_details_title', alerts.length)}>
      <div className="space-y-4">
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

        {filteredAlerts.length > 0 ? (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {filteredAlerts.map((alert) => (
              <li key={alert.id} className="p-4 bg-white/30 rounded-lg shadow-sm">
                <div className="flex items-start">
                  {alert.type === 'doctor' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3 flex-shrink-0" /> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3 flex-shrink-0" />}
                  <div>
                    <p className="font-bold text-slate-800">{alert.name}</p>
                    <p className="text-sm text-slate-600">
                      {t(alert.type === 'doctor' ? 'client_type_doctor' : 'client_type_pharmacy')} - {alert.repName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {regionMap.get(parseInt(alert.regionName, 10)) || alert.regionName}
                    </p>
                    <p className="mt-1 font-semibold text-red-600">
                      {alert.daysSinceLastVisit === null ? t('never_visited') : t('days_ago', alert.daysSinceLastVisit)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-slate-600 py-8 text-lg">{t('no_overdue_clients_found')}</p>
        )}
      </div>
    </Modal>
  );
};

export default OverdueClientsDetailModal;
