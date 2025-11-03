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
  onSuccess: () => void;
  onCancel: () => void;
}

const VisitForm: React.FC<VisitFormProps> = ({ user, products, doctors, pharmacies, regions, initialRegionId, onSuccess, onCancel }) => {
  const { t } = useLanguage();
  const [visitTargetType, setVisitTargetType] = useState<'doctor' | 'pharmacy'>('doctor');
  const [regionId, setRegionId] = useState<string>(initialRegionId ? String(initialRegionId) : '');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [visitType, setVisitType] = useState<'Coaching' | 'Single' | null>(null);
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New states for autocomplete
  const [targetNameInput, setTargetNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredTargets = useMemo(() => {
    if (!regionId) return [];
    const numericRegionId = parseInt(regionId);
    if (visitTargetType === 'doctor') {
      return doctors.filter(d => d.regionId === numericRegionId);
    }
    if (visitTargetType === 'pharmacy') {
      return pharmacies.filter(p => p.regionId === numericRegionId);
    }
    return [];
  }, [regionId, visitTargetType, doctors, pharmacies]);
  
  const autocompleteSuggestions = useMemo(() => {
    if (!targetNameInput || !showSuggestions) return [];
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
    setVisitType(null);
  };


  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRegionId(e.target.value);
    setTargetId('');
    setTargetNameInput('');
  };

  const handleTargetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetNameInput(e.target.value);
    setTargetId(''); // Clear the actual ID when user is typing
    if (!showSuggestions) {
        setShowSuggestions(true);
    }
  };

  const handleSuggestionClick = (target: Doctor | Pharmacy) => {
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

    setSubmitting(true);
    setError('');

    try {
      if (visitTargetType === 'doctor' && visitType) { // visitType is now guaranteed to be non-null here
        await api.addDoctorVisit({
          doctorId: parseInt(targetId),
          repId: user.id,
          productIds: selectedProductIds,
          regionId: parseInt(regionId),
          visitType: visitType,
          doctorComment: notes
        });
      } else {
        await api.addPharmacyVisit({
          pharmacyId: parseInt(targetId),
          repId: user.id,
          regionId: parseInt(regionId),
          visitNotes: notes
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
      
      {/* Region Selector */}
      <div>
        <label htmlFor="region" className="block mb-2 text-sm font-medium text-slate-800">{t('region')}</label>
        <select id="region" value={regionId} onChange={handleRegionChange} required className="bg-white/50 border border-slate-300/50 text-slate-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5">
          <option value="" disabled>{t('choose_region')}</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      
      {/* Target (Doctor/Pharmacy) Autocomplete */}
      <div className="relative">
        <label htmlFor="target" className="block mb-2 text-sm font-medium text-slate-800">{t(visitTargetType === 'doctor' ? 'doctor' : 'pharmacy')}</label>
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
          placeholder={t(visitTargetType === 'doctor' ? 'search_for_doctor' : 'search_for_pharmacy')}
          autoComplete="off"
        />
        {autocompleteSuggestions.length > 0 && (
          <ul className="absolute z-20 w-full bg-white border border-slate-300/50 rounded-b-lg -mt-1 max-h-48 overflow-y-auto shadow-lg">
            {autocompleteSuggestions.map(target => (
              <li
                key={target.id}
                className="p-2.5 text-sm text-slate-800 hover:bg-orange-100 cursor-pointer"
                onMouseDown={(e) => { // Use onMouseDown to prevent blur event from firing before click
                  e.preventDefault(); 
                  handleSuggestionClick(target);
                }}
              >
                {target.name}
              </li>
            ))}
          </ul>
        )}
      </div>


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
          disabled={submitting}
          className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 transition-colors"
        >
          {submitting ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
};

export default VisitForm;