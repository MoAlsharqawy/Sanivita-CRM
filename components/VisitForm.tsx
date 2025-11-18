import React, { useState, useMemo } from 'react';
import { Doctor, Pharmacy, User, Product, Region } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { useRepMutations } from '../hooks/useMutations';

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
  const { addDoctorVisit, addPharmacyVisit } = useRepMutations(user.id);
  
  const [visitTargetType, setVisitTargetType] = useState<'doctor' | 'pharmacy'>('doctor');
  const [regionId, setRegionId] = useState<string>(initialRegionId ? String(initialRegionId) : '');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [visitType, setVisitType] = useState<'Coaching' | 'Single' | null>('Single');
  const [notes, setNotes] = useState('');
  
  const [error, setError] = useState('');

  // States for pharmacy autocomplete
  const [targetNameInput, setTargetNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // New state for toggling between planned and all doctors
  const [doctorSelectionMode, setDoctorSelectionMode] = useState<'planned' | 'all'>('planned');

  const submitting = addDoctorVisit.isPending || addPharmacyVisit.isPending;

  const filteredTargets = useMemo(() => {
    if (visitTargetType !== 'pharmacy' || !regionId) return [];
    const numericRegionId = parseInt(regionId);
    return pharmacies.filter(p => p.regionId === numericRegionId);
  }, [regionId, visitTargetType, pharmacies]);

  const doctorsInSelectedRegion = useMemo(() => {
      if (!regionId) return [];
      return doctors.filter(d => d.regionId === parseInt(regionId));
  }, [regionId, doctors]);
  
  const autocompleteSuggestions = useMemo(() => {
    if (!showSuggestions) return [];
    if (!targetNameInput) return filteredTargets; // Show all if no input
    return filteredTargets.filter(t =>
      t.name.toLowerCase().includes(targetNameInput.toLowerCase())
    );
  }, [targetNameInput, filteredTargets, showSuggestions]);

  const handleTargetTypeSwitch = (type: 'doctor' | 'pharmacy') => {
    if (type === visitTargetType) return;

    setVisitTargetType(type);
    setRegionId('');
    setTargetId('');
    setTargetNameInput('');
    setSelectedProductIds([]);
    setNotes('');
    setVisitType(type === 'doctor' ? 'Single' : null);
    setDoctorSelectionMode('planned'); // Reset to planned view
  };
  
  const toggleDoctorSelectionMode = () => {
    setDoctorSelectionMode(prev => {
        const newMode = prev === 'planned' ? 'all' : 'planned';
        // Reset selections when toggling
        setTargetId('');
        setRegionId(initialRegionId && newMode === 'planned' ? String(initialRegionId) : '');
        return newMode;
    });
  };

  const handlePlannedDoctorSelect = (doctor: Doctor) => {
    setTargetId(String(doctor.id));
    // Automatically set region based on selected doctor
    setRegionId(String(doctor.regionId));
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRegionId(e.target.value);
    setTargetId('');
    setTargetNameInput('');
    setShowSuggestions(false); // Hide suggestions when region changes
  };

  const handleTargetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetNameInput(e.target.value);
    setTargetId(''); // Clear the actual ID when user is typing
    if (!showSuggestions) {
        setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (target: Pharmacy) => {
    setTargetId(String(target.id));
    setTargetNameInput(target.name);
    setShowSuggestions(false);
  };
  
  const handleProductChange = (productId: number) => {
    setSelectedProductIds(prev => {
        const isSelected = prev.includes(productId);
        if (isSelected) {
            return prev.filter(id => id !== productId);
        } else if (prev.length < 3) {
            return [...prev, productId];
        }
        return prev; // Do not add more than 3
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!targetId) {
        errors.push(t('error_select_client'));
    }
    if (!notes.trim()) {
        errors.push(t('error_add_notes'));
    }
    if (visitTargetType === 'doctor') {
        if(selectedProductIds.length === 0) {
            errors.push(t('error_select_product'));
        }
        if(!visitType) {
            errors.push(t('error_select_visit_type'));
        }
    }

    if (errors.length > 0) {
        setError(errors.join(' '));
        return;
    }

    setError('');

    try {
      if (visitTargetType === 'doctor' && visitType) { // visitType is now guaranteed to be non-null here
        await addDoctorVisit.mutateAsync({
          doctorId: parseInt(targetId),
          repId: user.id,
          productIds: selectedProductIds,
          regionId: parseInt(regionId),
          visitType: visitType,
          doctorComment: notes
        });
      } else {
        await addPharmacyVisit.mutateAsync({
          pharmacyId: parseInt(targetId),
          repId: user.id,
          regionId: parseInt(regionId),
          visitNotes: notes
        });
      }
      onSuccess();
    } catch (err) {
      setError(t('error_saving_visit'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      
      {/* Visit Type Tabs */}
      <div>
        <label className="block mb-2 text-sm font-medium text-slate-800">{t('visit_type')}</label>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg p-1 bg-slate-200/60">
          <button
            type="button"
            role="tab"
            aria-selected={visitTargetType === 'doctor'}
            onClick={() => handleTargetTypeSwitch('doctor')}
            className={`w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-200/60 ${
                visitTargetType === 'doctor'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-700 hover:bg-white/50 focus:ring-blue-500'
            }`}
          >
            {t('doctor_visit')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={visitTargetType === 'pharmacy'}
            onClick={() => handleTargetTypeSwitch('pharmacy')}
            className={`w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-200/60 ${
                visitTargetType === 'pharmacy'
                    ? 'bg-orange-500 text-white shadow'
                    : 'text-slate-700 hover:bg-white/50 focus:ring-orange-500'
            }`}
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
            <button
                type="button"
                onClick={toggleDoctorSelectionMode}
                className="text-sm font-semibold text-blue-600 hover:text-orange-600 transition-colors"
            >
                {doctorSelectionMode === 'planned' ? t('all_clients') : t('show_planned_visits')}
            </button>
          </div>

          {doctorSelectionMode === 'planned' ? (
            <>
              {pendingDoctorsForToday && pendingDoctorsForToday.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-100/50 rounded-lg">
                  {pendingDoctorsForToday.map((doctor) => (
                    <button
                      type="button"
                      key={doctor.id}
                      onClick={() => handlePlannedDoctorSelect(doctor)}
                      className={`w-full text-start p-3 rounded-lg border transition-all duration-200 ${
                        targetId === String(doctor.id)
                          ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                          : 'bg-white/50 border-slate-300/50 hover:bg-blue-100/50 hover:border-blue-300'
                      }`}
                    >
                      <p className="font-semibold">{doctor.name}</p>
                      <p className={`text-xs ${targetId === String(doctor.id) ? 'text-blue-100' : 'text-slate-600'}`}>
                        {t(doctor.specialization)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-4 bg-slate-100/50 rounded-lg text-slate-600">
                  <p>{t('all_planned_visits_completed')}</p>
                </div>
              )}
            </>
          ) : (
             <div className="space-y-4 p-2 bg-slate-100/50 rounded-lg">
                <div>
                    <label htmlFor="region" className="block mb-2 text-sm font-medium text-slate-800">{t('region')}</label>
                    <select id="region" value={regionId} onChange={handleRegionChange} required className="bg-white/50 border border-slate-300/50 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                    <option value="" disabled>{t('choose_region')}</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="doctor" className="block mb-2 text-sm font-medium text-slate-800">{t('doctor')}</label>
                    <select id="doctor" value={targetId} onChange={(e) => setTargetId(e.target.value)} required disabled={!regionId} className="bg-white/50 border border-slate-300/50 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:bg-slate-200/50">
                        <option value="" disabled>{t('choose_doctor')}</option>
                        {doctorsInSelectedRegion.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="region" className="block mb-2 text-sm font-medium text-slate-800">{t('region')}</label>
            <select id="region" value={regionId} onChange={handleRegionChange} required className="bg-white/50 border border-slate-300/50 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
              <option value="" disabled>{t('choose_region')}</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          
          <div className="relative">
            <label htmlFor="target" className="block mb-2 text-sm font-medium text-slate-800">{t('pharmacy')}</label>
            <input
              id="target"
              type="text"
              value={targetNameInput}
              onChange={handleTargetInputChange}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              required
              disabled={!regionId}
              className="bg-white/50 border border-slate-300/50 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 disabled:bg-slate-200/50"
              placeholder={t('search_for_pharmacy')}
              autoComplete="off"
            />
            {autocompleteSuggestions.length > 0 && (
              <ul className="absolute z-20 w-full bg-white border border-slate-300/50 rounded-b-lg -mt-1 max-h-48 overflow-y-auto shadow-lg">
                {autocompleteSuggestions.map(target => (
                  <li
                    key={target.id}
                    className="p-2.5 text-sm text-slate-800 hover:bg-orange-100 cursor-pointer"
                    onMouseDown={(e) => { 
                      e.preventDefault(); 
                      handleSuggestionClick(target as Pharmacy);
                    }}
                  >
                    {target.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {visitTargetType === 'doctor' && (
        <>
            {/* Products Selector */}
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-800">{t('products_select_limit')}</label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-white/30 rounded-lg">
                {products.map(p => (
                  <label key={p.id} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => handleProductChange(p.id)}
                      className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-slate-800">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Coaching/Single Selector */}
            <div>
                <label className="block mb-2 text-sm font-medium text-slate-800">{t('coaching_single_select')}</label>
                <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="flex items-center cursor-pointer">
                        <input type="radio" name="visitType" value="Single" checked={visitType === 'Single'} onChange={() => setVisitType('Single')} className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 focus:ring-orange-500"/>
                        <span className="ms-2 text-sm font-medium text-gray-900">{t('Single')}</span>
                    </label>
                     <label className="flex items-center cursor-pointer">
                        <input type="radio" name="visitType" value="Coaching" checked={visitType === 'Coaching'} onChange={() => setVisitType('Coaching')} className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 focus:ring-orange-500"/>
                        <span className="ms-2 text-sm font-medium text-gray-900">{t('Coaching')}</span>
                    </label>
                </div>
            </div>
        </>
      )}
      <div>
        <label htmlFor="notes" className="block mb-2 text-sm font-medium text-slate-800">
          {t(visitTargetType === 'doctor' ? 'doctor_comment' : 'visit_notes')}
        </label>
        <textarea
          id="notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="block p-2.5 w-full text-sm text-slate-900 bg-white/50 rounded-lg border border-slate-300/50 focus:ring-orange-500 focus:border-orange-500"
          placeholder={t('write_notes_here')}
          required
        ></textarea>
      </div>

      {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded-lg">{error}</p>}
      
      <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-300/50">
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-700 bg-transparent hover:bg-slate-200/50 focus:ring-4 focus:outline-none focus:ring-slate-300 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 hover:text-slate-900 focus:z-10 transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting || (visitTargetType === 'doctor' && !targetId)}
          className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 transition-colors"
        >
          {submitting ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
};

export default VisitForm;