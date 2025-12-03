
import React from 'react';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { CalendarIcon } from './icons';

interface AbsentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repName: string;
  absentDates: string[]; // YYYY-MM-DD format
}

const AbsentDetailsModal: React.FC<AbsentDetailsModalProps> = ({ isOpen, onClose, repName, absentDates }) => {
  const { t } = useLanguage();

  const sortedDates = [...absentDates].sort();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('absent_details_title', repName)}>
      <div className="space-y-4">
        {sortedDates.length > 0 ? (
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-start text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-6 py-3">{t('date')}</th>
                  <th className="px-6 py-3">{t('day_name')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedDates.map((dateStr, index) => {
                  const date = new Date(dateStr);
                  return (
                    <tr key={index} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {date.toLocaleDateString(t('locale'))}
                      </td>
                      <td className="px-6 py-3">
                        {date.toLocaleDateString(t('locale'), { weekday: 'long' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">{t('no_data')}</p>
        )}
        
        <div className="flex justify-end pt-4 border-t border-slate-200/50">
            <button
                onClick={onClose}
                className="text-slate-700 bg-transparent hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium px-5 py-2.5 transition-colors"
            >
                {t('cancel')}
            </button>
        </div>
      </div>
    </Modal>
  );
};

export default AbsentDetailsModal;
