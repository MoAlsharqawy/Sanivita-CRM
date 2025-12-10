
import React, { useState, useMemo } from 'react';
import { User, Doctor, Pharmacy, Region } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { DoctorIcon, PharmacyIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon, ArrowRightIcon } from './icons';
import ClientFormModal from './ClientFormModal';
import Modal from './Modal';
import { api } from '../services/api';

interface RepClientManagerProps {
  rep: User;
  allDoctors: Doctor[];
  allPharmacies: Pharmacy[];
  regions: Region[];
  onBack: () => void;
  onDataChange: () => void; // Trigger refresh in parent
}

const RepClientManager: React.FC<RepClientManagerProps> = ({ 
  rep, allDoctors, allPharmacies, regions, onBack, onDataChange 
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'doctors' | 'pharmacies'>('doctors');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Doctor | Pharmacy | null>(null);
  
  // Delete Confirmation State
  const [clientToDelete, setClientToDelete] = useState<Doctor | Pharmacy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Derived Data
  const repDoctors = useMemo(() => allDoctors.filter(d => d.repId === rep.id), [allDoctors, rep.id]);
  const repPharmacies = useMemo(() => allPharmacies.filter(p => p.repId === rep.id), [allPharmacies, rep.id]);
  const regionMap = useMemo(() => new Map(regions.map(r => [r.id, r.name])), [regions]);

  const filteredList = useMemo(() => {
    const list = activeTab === 'doctors' ? repDoctors : repPharmacies;
    if (!searchTerm.trim()) return list;
    return list.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [activeTab, repDoctors, repPharmacies, searchTerm]);

  // Handlers
  const handleAddClick = () => {
    setClientToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (client: Doctor | Pharmacy) => {
    setClientToEdit(client);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (client: Doctor | Pharmacy) => {
    setClientToDelete(client);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      // Robust check: if property 'specialization' exists, treat as doctor. 
      // Or rely on activeTab if the modal is strictly tied to the current view (which it is for delete logic).
      if (activeTab === 'doctors') {
        await api.deleteDoctor(clientToDelete.id);
      } else {
        await api.deletePharmacy(clientToDelete.id);
      }
      onDataChange();
      setClientToDelete(null);
    } catch (error) {
      console.error("Failed to delete client", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    onDataChange();
  };

  return (
    <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
           <button 
             onClick={onBack} 
             className="p-2 bg-white/50 hover:bg-white rounded-full transition-colors text-slate-600"
             title={t('back')}
           >
             <ArrowRightIcon className="w-5 h-5 rtl:rotate-180" />
           </button>
           <div>
             <h3 className="text-2xl font-bold text-blue-800">{t('clients_for_rep', rep.name)}</h3>
             <p className="text-sm text-slate-600">{rep.username}</p>
           </div>
        </div>
        
        <div className="flex gap-2">
           <button 
             onClick={handleAddClick}
             className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
           >
             <PlusIcon className="w-5 h-5" />
             {t('add_client')}
           </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 bg-slate-50/50 p-2 rounded-xl border border-slate-200">
         <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('doctors')}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'doctors' 
                  ? 'bg-blue-100 text-blue-700 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <DoctorIcon className="w-4 h-4" />
              {t('doctors')} ({repDoctors.length})
            </button>
            <button
              onClick={() => setActiveTab('pharmacies')}
              className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'pharmacies' 
                  ? 'bg-orange-100 text-orange-700 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <PharmacyIcon className="w-4 h-4" />
              {t('pharmacies')} ({repPharmacies.length})
            </button>
         </div>

         <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder={t('search_by_name')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <SearchIcon className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
         </div>
      </div>

      {/* List Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm text-start">
          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-xs">
            <tr>
              <th className="px-6 py-3">{t('name')}</th>
              <th className="px-6 py-3">{t('region')}</th>
              {activeTab === 'doctors' && <th className="px-6 py-3">{t('specialization')}</th>}
              <th className="px-6 py-3 text-center">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredList.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{client.name}</td>
                <td className="px-6 py-4 text-slate-600">{regionMap.get(client.regionId) || t('unknown')}</td>
                {activeTab === 'doctors' && (
                  <td className="px-6 py-4 text-slate-600">
                    {t((client as Doctor).specialization)}
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => handleEditClick(client)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title={t('edit')}
                    >
                      <EditIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(client)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredList.length === 0 && (
              <tr>
                <td colSpan={activeTab === 'doctors' ? 4 : 3} className="px-6 py-8 text-center text-slate-500">
                  {t('no_data')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isFormOpen && (
        <ClientFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleFormSuccess}
          repId={rep.id}
          regions={regions}
          clientToEdit={clientToEdit}
          initialType={activeTab === 'doctors' ? 'doctor' : 'pharmacy'} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <Modal isOpen={!!clientToDelete} onClose={() => setClientToDelete(null)} title={t('delete_client_confirm_title')}>
           <div className="space-y-4">
             <p className="text-slate-700">
               {t('delete_client_confirm_message', clientToDelete.name)}
             </p>
             <div className="flex justify-end gap-2 pt-2">
               <button 
                 onClick={() => setClientToDelete(null)}
                 className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
               >
                 {t('cancel')}
               </button>
               <button 
                 onClick={confirmDelete}
                 disabled={isDeleting}
                 className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
               >
                 {isDeleting ? t('deleting') : t('confirm')}
               </button>
             </div>
           </div>
        </Modal>
      )}
    </div>
  );
};

export default RepClientManager;
