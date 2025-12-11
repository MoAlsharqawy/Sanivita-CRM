
import React from 'react';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { DownloadIcon } from './icons';
import { exportDoctorsListToExcel } from '../services/exportService';

interface FrequencyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  doctors: { name: string; region: string; specialization: string; visits: number; lastVisitDate?: string | null }[];
  repName: string;
  frequencyLabel: string;
}

const FrequencyDetailModal: React.FC<FrequencyDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  doctors,
  repName,
  frequencyLabel
}) => {
  const { t } = useLanguage();

  const handleDownload = () => {
      const fileName = `frequency_details_${repName}_${frequencyLabel.replace('/', '_')}`;
      exportDoctorsListToExcel(doctors, fileName, t);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex justify-end mb-2">
            <button 
                onClick={handleDownload}
                className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
            >
                <DownloadIcon className="w-4 h-4" />
                {t('download_excel')}
            </button>
        </div>

        {doctors.length > 0 ? (
          <div className="max-h-96 overflow-y-auto overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-start text-slate-600 whitespace-nowrap">
              <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3">{t('name')}</th>
                  <th className="px-4 py-3">{t('specialization')}</th>
                  <th className="px-4 py-3">{t('region')}</th>
                  <th className="px-4 py-3 text-center">{t('last_visit_date')}</th>
                  <th className="px-4 py-3 text-center">{t('visit_count')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doctors.map((doc, index) => (
                  <tr key={index} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{doc.name}</td>
                    <td className="px-4 py-3">{t(doc.specialization)}</td>
                    <td className="px-4 py-3">{doc.region}</td>
                    <td className="px-4 py-3 text-center text-xs">
                        {doc.lastVisitDate ? new Date(doc.lastVisitDate).toLocaleDateString(t('locale')) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-blue-600">{doc.visits}</td>
                  </tr>
                ))}
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

export default FrequencyDetailModal;
