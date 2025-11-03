import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import Modal from './Modal';
import { useLanguage } from '../hooks/useLanguage';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit: User | null;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, onSuccess, userToEdit }) => {
  const { t } = useLanguage();
  const isEditMode = !!userToEdit;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (userToEdit) {
          setName(userToEdit.name);
          setUsername(userToEdit.username);
        } else {
          setName('');
          setUsername('');
        }
        setPassword('');
        setConfirmPassword('');
        setError('');
    }
  }, [userToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validations
    if (!name.trim() || !username.trim()) {
        setError(t('error_all_fields_required'));
        return;
    }
    if (!isEditMode && !password) { // Password required for new user
        setError(t('error_password_required'));
        return;
    }
    if (password && password.length < 6) {
        setError(t('error_password_too_short'));
        return;
    }
    if (password !== confirmPassword) {
      setError(t('error_passwords_no_match'));
      return;
    }

    setSubmitting(true);
    try {
        if (isEditMode && userToEdit) {
            const updates: Partial<Pick<User, 'name' | 'username'>> = {
                name,
                username: userToEdit.username, // Username is not editable, so we pass the original
            };
            await api.updateUser(userToEdit.id, updates);
        } else {
            await api.addUser({ name, username, password });
        }
        onSuccess();
    } catch (err) {
      setError(t('error_unexpected'));
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={isEditMode ? t('edit_rep_info') : t('add_new_rep')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-800">{t('full_name')}</label>
          <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" />
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-slate-800">{t('username')}</label>
          <input 
            type="text" 
            id="username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
            disabled={isEditMode}
            className="mt-1 block w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-200/50 disabled:text-slate-500" 
          />
           {isEditMode && <p className="text-xs text-slate-500 mt-1">{t('username_cannot_be_changed')}</p>}
        </div>

        {!isEditMode && (
          <>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-800">{t('new_password')}</label>
              <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-800">{t('confirm_password')}</label>
              <input type="password" id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 block w-full p-2 border border-slate-300/50 bg-white/50 rounded-md focus:ring-orange-500 focus:border-orange-500" />
            </div>
          </>
        )}
        
        {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded-lg">{error}</p>}
        
        <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-300/50">
          <button type="button" onClick={onClose} className="text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 transition-colors">{t('cancel')}</button>
          <button type="submit" disabled={submitting} className="text-white bg-blue-600 hover:bg-orange-500 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 transition-colors flex justify-center items-center min-w-[100px]">
            {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : t('save_changes')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
export default UserEditModal;