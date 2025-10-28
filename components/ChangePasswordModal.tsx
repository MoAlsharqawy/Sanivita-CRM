import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/mockData';
import Modal from './Modal';
import { LockIcon } from './icons';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, user, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('يرجى ملء كلا الحقلين.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    if (newPassword.length < 6) {
        setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
        return;
    }

    setError('');
    setSubmitting(true);
    try {
      const success = await api.changeUserPassword(user.id, newPassword);
      if (success) {
        onSuccess();
      } else {
        setError('فشل تحديث كلمة المرور. المستخدم غير موجود.');
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع.');
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
    <Modal isOpen={isOpen} onClose={handleClose} title={`تغيير كلمة مرور ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-800 mb-1">
            كلمة المرور الجديدة
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 ps-3 flex items-center pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-3 border border-slate-300/50 bg-white/50 placeholder-slate-500 text-slate-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm ps-10"
              placeholder="أدخل كلمة المرور الجديدة"
              required
            />
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-800 mb-1">
            تأكيد كلمة المرور الجديدة
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 ps-3 flex items-center pointer-events-none">
              <LockIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-3 border border-slate-300/50 bg-white/50 placeholder-slate-500 text-slate-900 rounded-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm ps-10"
              placeholder="أعد إدخال كلمة المرور"
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
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="text-white bg-blue-600 hover:bg-orange-500 focus:ring-4 focus:outline-none focus:ring-orange-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300 transition-colors"
          >
            {submitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;