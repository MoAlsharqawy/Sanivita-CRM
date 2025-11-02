import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { LogoutIcon, EditIcon, LanguageIcon } from './icons';
import ChangePasswordModal from './ChangePasswordModal';
import { Logo } from './Logo';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <>
      <header className="bg-white/30 backdrop-blur-lg shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right Side (User Info) */}
            <div className="flex-1 flex justify-start items-center">
              <span className="text-slate-700 font-medium ms-2">
                {t('hello', user?.name || '')}
              </span>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="p-2 text-slate-600 hover:text-orange-600 focus:outline-none transition-colors rounded-full hover:bg-slate-200/50"
                aria-label={t('change_password')}
              >
                <EditIcon className="h-5 w-5" />
              </button>
              <button
                onClick={logout}
                className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors ms-2"
                aria-label={t('logout')}
              >
                <LogoutIcon className="h-6 w-6" />
                <span className="ms-1 hidden md:block">{t('logout')}</span>
              </button>
            </div>

            {/* Center (Logo) */}
            <div className="flex-1 flex justify-center">
              <Logo className="h-12" />
            </div>

            {/* Left Side (App Name & Lang) */}
            <div className="flex-1 flex justify-end items-center">
              <button
                onClick={toggleLang}
                className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors me-4 font-semibold"
                aria-label="Change Language"
              >
                <LanguageIcon className="h-6 w-6" />
                <span className="mx-1">{lang === 'ar' ? 'English' : 'العربية'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      {isPasswordModalOpen && user && (
        <ChangePasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          user={user}
          onSuccess={() => setIsPasswordModalOpen(false)}
        />
      )}
    </>
  );
};