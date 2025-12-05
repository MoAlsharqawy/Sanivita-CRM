import React, { useState, useEffect } from 'react';
import { Doctor, Pharmacy, Region, Specialization } from '../types';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  repId: string;
  regions: Region[];
  clientToEdit?: Doctor | Pharmacy | null; // If null, we are adding new
  initialType?: 'doctor' | 'pharmacy'; // For adding new
}

const ClientFormModal: React.FC<ClientFormModalProps> = ({ 
  isOpen, onClose, onSuccess, repId, regions, clientToEdit, initialType = 'doctor' 
}) => {
  const { t } = useLanguage();
  const [clientType, setClientType] = useState<'doctor' | 'pharmacy'>(initialType);
  const [name, setName] = useState('');
  const [regionId, setRegionId] = useState<string>('');
  const [specialization, setSpecialization] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (clientToEdit) {
        // Edit Mode
        setName(clientToEdit.name);
        setRegionId(String(clientToEdit.regionId));
        if ('specialization' in clientToEdit) {
          setClientType('doctor');
          setSpecialization(clientToEdit.specialization);
        } else {
          setClientType('pharmacy');
          setSpecialization('');
        }
      } else {
        // Add Mode
        setName('');
        setRegionId('');
        setSpecialization('');
        setClientType(initialType);
      }
      setError('');
      setLoading(false);
    }
  }, [isOpen, clientToEdit, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('error_name_required'));
      return;
    }
    if (!regionId) {
      setError(t('error_region_required'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (clientToEdit) {
        // Update
        if (clientType === 'doctor') {
           await api.updateDoctor(clientToEdit.id, {
             name,
             regionId: parseInt(regionId),
             specialization
           });
        } else {
           await api.updatePharmacy(clientToEdit.id, {
             name,
             regionId: parseInt(regionId)
           });
        }
      } else {
        // Create
        if (clientType === 'doctor') {
          await api.addDoctor({
            name,
            regionId: parseInt(regionId),
            repId,
            specialization: specialization || 'PEDIATRICS' // Default fallback
          });
        } else {
          await api.addPharmacy({
            name,
            regionId: parseInt(regionId),
            repId
          });
        }
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(t('error_unexpected'));
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = !!clientToEdit;
  const title = isEditMode 
    ? t('edit_client') 
    : (clientType === 'doctor' ? t('add_new_doctor') : t('add_new_pharmacy'));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {!isEditMode && (
           <div className="flex gap-4 mb-4 bg-slate-100 p-2 rounded-lg">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="clientType" 
                  checked={clientType === 'doctor'} 
                  onChange={() => setClientType('doctor')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ms-2 text-sm font-medium text-slate-900">{t('doctors')}</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input 
                  type="radio" 
                  name="clientType" 
                  checked={clientType === 'pharmacy'} 
                  onChange={() => setClientType('pharmacy')}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                />
                <span className="ms-2 text-sm font-medium text-slate-900">{t('pharmacies')}</span>
              </label>
           </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1">{t('name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1">{t('region')}</label>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">{t('select_region')}</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {clientType === 'doctor' && (
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('specialization')}</label>
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('select_specialization')}</option>
              <option value={Specialization.Pediatrics}>{t(Specialization.Pediatrics)}</option>
              <option value={Specialization.Pulmonology}>{t(Specialization.Pulmonology)}</option>
            </select>
          </div>
        )}

        {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${clientType === 'doctor' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'} disabled:opacity-50`}
          >
            {loading ? t('loading') : t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ClientFormModal;