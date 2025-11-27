import React, { useState, useEffect } from 'react';
import { User, Region } from '../types';
import { api } from '../services/api';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import Spinner from './Spinner';

interface UserRegionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  allRegions: Region[];
}

const UserRegionsModal: React.FC<UserRegionsModalProps> = ({ isOpen, onClose, user, allRegions }) => {
  const { t } = useLanguage();
  const [selectedRegionIds, setSelectedRegionIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setMessage(null);
      api.getRegionsForRep(user.id)
        .then(regions => {
          setSelectedRegionIds(regions.map(r => r.id));
        })
        .catch(err => {
          console.error(err);
          setMessage({ text: t('error_unexpected'), type: 'error' });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, user.id, t]);

  const handleToggleRegion = (regionId: number) => {
    setSelectedRegionIds(prev => 
      prev.includes(regionId) 
        ? prev.filter(id => id !== regionId) 
        : [...prev, regionId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateUserRegions(user.id, selectedRegionIds);
      setMessage({ text: t('regions_updated_success'), type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage({ text: t('error_unexpected'), type: 'error' });
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('manage_regions_for', user.name)}>
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <p className="text-slate-700 font-medium">{t('select_regions_instruction')}</p>
          
          <div className="max-h-60 overflow-y-auto p-2 border border-slate-200/50 rounded-lg space-y-2 bg-white/50">
            {allRegions.map(region => (
              <label key={region.id} className="flex items-center p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedRegionIds.includes(region.id)}
                  onChange={() => handleToggleRegion(region.id)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ms-3 text-slate-800">{region.name}</span>
              </label>
            ))}
            {allRegions.length === 0 && <p className="text-center text-slate-500">{t('no_data')}</p>}
          </div>

          {selectedRegionIds.length === 0 && (
             <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded">{t('no_regions_selected')}</p>
          )}

          {message && (
            <p className={`text-sm p-2 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </p>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200/50 gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center gap-2"
            >
              {saving ? t('saving_regions') : t('save')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default UserRegionsModal;