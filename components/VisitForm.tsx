
import React, { useState, useMemo } from 'react';
import { Doctor, Pharmacy, User, Product, Region } from '../types';
import { api } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

interface VisitFormProps {
  user: User;
  products: Product[];
  doctors: Doctor[];
  pharmacies: Pharmacy[];
  regions: Region[];
  initialRegionId?: number | null;
  pendingDoctorsForToday?: Doctor[];
  onSuccess: () => void;
  onCancel: () => void;
}

const VisitForm: React.FC<VisitFormProps> = ({ user, products, doctors, pharmacies, regions, initialRegionId, pendingDoctorsForToday, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const [visitTargetType, setVisitTargetType] = useState<'doctor' | 'pharmacy'>('doctor');
  const [regionId, setRegionId] = useState<string>(initialRegionId ? String(initialRegionId) : '');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [visitType, setVisitType] = useState<'Coaching' | 'Single' | null>('Single');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // States for pharmacy autocomplete
  const [targetNameInput, setTargetNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [doctorSelectionMode, setDoctorSelectionMode] = useState<'planned' | 'all'>('planned');

  const filteredTargets = useMemo(() => {
    if (visitTargetType !== 'pharmacy' || !regionId) return [];
    return pharmacies.filter(p => p.regionId === parseInt(regionId));
  }, [regionId, visitTargetType, pharmacies]);

  const doctorsInSelectedRegion = useMemo(() => {
      if (!regionId) return [];
      return doctors.filter(d => d.regionId === parseInt(regionId));
  }, [regionId, doctors]);
  
  const autocompleteSuggestions = useMemo(() => {
    if (!showSuggestions) return [];
    if (!targetNameInput) return filteredTargets;
    return filteredTargets.filter(t => t.name.toLowerCase().includes(targetNameInput.toLowerCase()));
  }, [targetNameInput, filteredTargets, showSuggestions]);

  const handleTargetTypeSwitch = (type: 'doctor' | 'pharmacy') => {
    setVisitTargetType(type);
    setRegionId('');
    setTargetId('');
    setTargetNameInput('');
    setSelectedProductIds([]);
    setNotes('');
    setVisitType(type === 'doctor' ? 'Single' : null);
    setDoctorSelectionMode('planned');
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId || !notes.trim()) {
        setError(t('error_select_client'));
        return;
    }
    if (visitTargetType === 'doctor' && (selectedProductIds.length === 0 || !visitType)) {
        setError(t('error_select_product'));
        return;
    }

    setSubmitting(true);
    setError('');

    try {
      const location = await getCurrentLocation();
      
      if (visitTargetType === 'doctor' && visitType) {
        await api.addDoctorVisit({
          doctorId: parseInt(targetId),
          repId: user.id,
          productIds: selectedProductIds,
          regionId: parseInt(regionId),
          visitType: visitType,
          doctorComment: notes,
          latitude: location?.lat,
          longitude: location?.lng
        });
      } else {
        await api.addPharmacyVisit({
          pharmacyId: parseInt(targetId),
          repId: user.id,
          regionId: parseInt(regionId),
          visitNotes: notes,
          latitude: location?.lat,
          longitude: location?.lng
        });
      }
      onSuccess();
    } catch (err) {
      setError(t('error_saving_visit'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-800">{t('visit_type')}</label>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg p-1 bg-slate-200/60">
          <button
            type="button"
            onClick={() => handleTargetTypeSwitch('doctor')}
            className={`w-full p-2 rounded-md text-sm font-semibold transition-all ${visitTargetType === 'doctor' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
          >
            {t('doctor_visit')}
          </button>
          <button
            type="button"
            onClick={() => handleTargetTypeSwitch('pharmacy')}
            className={`w-full p-2 rounded-md text-sm font-semibold transition-all ${visitTargetType === 'pharmacy' ? 'bg-orange-500 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
          >
            {t('pharmacy_visit')}
          </button>
        </div>
      </div>
      
      {visitTargetType === 'doctor' ? (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-slate-800">
               {doctorSelectionMode === 'planned' ? t('planned_visits_for_today') : t('all_clients')}
            </label>
            <button type="button" onClick={() => setDoctorSelectionMode(prev => prev === 'planned' ? 'all' : 'planned')} className="text-sm font-semibold text-blue-600">
                {doctorSelectionMode === 'planned' ? t('all_clients') : t('show_planned_visits')}
            </button>
          </div>
          {doctorSelectionMode === 'planned' && pendingDoctorsForToday?.length ? (
            <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-100/50 rounded-lg">
              {pendingDoctorsForToday.map((d) => (
                <button type="button" key={d.id} onClick={() => { setTargetId(String(d.id)); setRegionId(String(d.regionId)); }} className={`w-full text-start p-3 rounded-lg border transition-all ${targetId === String(d.id) ? 'bg-blue-600 text-white' : 'bg-white/50 border-slate-300/50 hover:bg-blue-100/50'}`}>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs opacity-80">{t(d.specialization)}</p>
                </button>
              ))}
            </div>
          ) : (
             <div className="space-y-4 p-2 bg-slate-100/50 rounded-lg">
                <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setTargetId(''); }} className="bg-white/50 border border-slate-300/50 text-sm rounded-lg block w-full p-2.5">
                    <option value="" disabled>{t('choose_region')}</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={!regionId} className="bg-white/50 border border-slate-300/50 text-sm rounded-lg block w-full p-2.5">
                    <option value="" disabled>{t('choose_doctor')}</option>
                    {doctorsInSelectedRegion.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <select value={regionId} onChange={(e) => { setRegionId(e.target.value); setTargetId(''); }} className="bg-white/50 border border-slate-300/50 text-sm rounded-lg block w-full p-2.5">
            <option value="" disabled>{t('choose_region')}</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="relative">
            <input type="text" value={targetNameInput} onChange={(e) => { setTargetNameInput(e.target.value); setTargetId(''); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} disabled={!regionId} className="bg-white/50 border border-slate-300/50 text-sm rounded-lg block w-full p-2.5" placeholder={t('search_for_pharmacy')} />
            {showSuggestions && autocompleteSuggestions.length > 0 && (
              <ul className="absolute z-20 w-full bg-white border border-slate-300 rounded-b-lg -mt-1 max-h-48 overflow-y-auto shadow-lg">
                {autocompleteSuggestions.map(target => (
                  <li key={target.id} className="p-2.5 text-sm hover:bg-orange-100 cursor-pointer" onMouseDown={() => { setTargetId(String(target.id)); setTargetNameInput(target.name); setShowSuggestions(false); }}>{target.name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {visitTargetType === 'doctor' && (
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-800">{t('products_select_limit')}</label>
            <div className="grid grid-cols-2 gap-2 p-3 bg-white/30 rounded-lg">
              {products.map(p => (
                <label key={p.id} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                  <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => setSelectedProductIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : prev.length < 3 ? [...prev, p.id] : prev)} className="w-4 h-4 text-orange-600 rounded" />
                  <span className="text-sm font-medium text-slate-800">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
                <input type="radio" name="visitType" checked={visitType === 'Single'} onChange={() => setVisitType('Single')} className="w-4 h-4 text-orange-600" />
                <span className="ms-2 text-sm font-medium">{t('Single')}</span>
            </label>
            <label className="flex items-center cursor-pointer">
                <input type="radio" name="visitType" checked={visitType === 'Coaching'} onChange={() => setVisitType('Coaching')} className="w-4 h-4 text-orange-600" />
                <span className="ms-2 text-sm font-medium">{t('Coaching')}</span>
            </label>
          </div>
        </div>
      )}
      <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="block p-2.5 w-full text-sm bg-white/50 rounded-lg border border-slate-300" placeholder={t('write_notes_here')} required />
      {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded-lg">{error}</p>}
      <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-200">
        <button type="button" onClick={onCancel} className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5">{t('cancel')}</button>
        <button type="submit" disabled={submitting || !targetId} className="text-white bg-blue-600 hover:bg-orange-500 font-medium rounded-lg text-sm px-5 py-2.5 min-w-[100px] disabled:opacity-50">{submitting ? t('saving') : t('save')}</button>
      </div>
    </form>
  );
};

export default VisitForm;
