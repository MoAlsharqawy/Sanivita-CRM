import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import Modal from './Modal';
import { LockIcon } from './icons';
import { useLanguage } from '../hooks/useLanguage';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError(t('error_fill_both_fields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('error_passwords_no_match'));
      return;
    }
    if (newPassword.length < 6) {
        setError(t('error_password_too_short'));
        return;
    }

    setError('');
    setSubmitting(true);
    try {
      const success = await api.updateUserPassword(newPassword);
      if (success) {
        onSuccess();
      } else {
        setError(t('error_password_update_failed'));
      }
    } catch (err) {
      setError(t('error_unexpected'));
    } finally {
      setSubmitting(false);
    }
  };

  // Use a separate handler for the modal's onClose to reset state
  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('change_password_for', user.name)}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-800 mb-1">
            {t('new_password')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-3 border border-slate-300/50 bg-white/50 placeholder-slate-500 text-slate-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm ps-10"
              placeholder={t('enter_new_password')}
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-800 mb-1">
            {t('confirm_new_password')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-3 border border-slate-300/50 bg-white/50 placeholder-slate-500 text-slate-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm ps-10"
              placeholder={t('reenter_password')}
              required
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded-lg">{error}</p>}

        <div className="flex items-center justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-300/50">
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-700 bg-transparent hover:bg-slate-200/50 focus:ring-4 focus:outline-none focus:ring-slate-300 rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 hover:text-slate-900 focus:z-10 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 transition-colors"
          >
            {submitting ? t('saving') : t('save_changes')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;