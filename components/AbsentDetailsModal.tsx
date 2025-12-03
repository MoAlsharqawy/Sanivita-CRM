
import React, { useState } from 'react';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { TrashIcon, CheckIcon } from './icons';

interface AbsentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repName: string;
  absentDetails: { id?: number; date: string; reason: string; isManual: boolean }[];
  onUpdate?: () => void; // Callback to refresh data after deletion
}

const AbsentDetailsModal: React.FC<AbsentDetailsModalProps> = ({ isOpen, onClose, repName, absentDetails, onUpdate }) => {
  const { t } = useLanguage();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortedDetails = [...absentDetails].sort((a, b) => a.date.localeCompare(b.date));

  const handleDelete = async (id: number) => {
      setDeletingId(id);
      try {
          await api.deleteRepAbsence(id);
          if (onUpdate) onUpdate();
      } catch (error) {
          console.error("Failed to delete absence", error);
      } finally {
          setDeletingId(null);
      }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('absent_details_title', repName)}>
      <div className="space-y-4">
        {sortedDetails.length > 0 ? (
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-start text-slate-600">
              <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-6 py-3">{t('date')}</th>
                  <th className="px-6 py-3">{t('day_name')}</th>
                  <th className="px-6 py-3">{t('reason')}</th>
                  <th className="px-6 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedDetails.map((detail, index) => {
                  const date = new Date(detail.date);
                  return (
                    <tr key={index} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {date.toLocaleDateString(t('locale'))}
                      </td>
                      <td className="px-6 py-3">
                        {date.toLocaleDateString(t('locale'), { weekday: 'long' })}
                      </td>
                      <td className="px-6 py-3">
                         <span className={`px-2 py-1 rounded-full text-xs font-semibold ${detail.isManual ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                             {detail.reason}
                         </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                          {detail.isManual && detail.id && (
                              <button 
                                onClick={() => handleDelete(detail.id!)}
                                disabled={deletingId === detail.id}
                                className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                                title={t('confirm_delete_absence')}
                              >
                                  {deletingId === detail.id ? <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div> : <TrashIcon className="w-4 h-4" />}
                              </button>
                          )}
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
