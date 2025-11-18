
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { EyeIcon, EyeOffIcon, LanguageIcon } from './icons';
import { Logo } from './Logo';
import { api } from '../services/api';


const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, toggleLang, lang } = useLanguage();

  const [authView, setAuthView] = useState<'login' | 'reset'>('login');
  const [resetMessage, setResetMessage] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // login now throws on any error, so we don't need to check the return value.
      // The onAuthStateChange listener handles success.
      await login(username, password);
    } catch (err: any) {
      // The error message from api.ts is our translation key
      setError(t(err.message || 'login_error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    if (!username.trim()) {
      setError(t('error_enter_email')); // Updated error message
      return;
    }
    setLoading(true);
    try {
      await api.sendPasswordResetEmail(username);
      setResetMessage(t('reset_link_sent'));
    } catch (err) {
      // In reset password, we intentionally do not expose specific errors for security (e.g., email not found)
      setResetMessage(t('reset_link_sent')); // Always show success message for security reasons
    } finally {
      setLoading(false);
    }
  };

  const switchToReset = () => {
      setError('');
      setResetMessage('');
      setPassword('');
      setAuthView('reset');
  };

  const switchToLogin = () => {
      setError('');
      setResetMessage('');
      setAuthView('login');
  };
  
  if (authView === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
         {/* Language Switcher */}
        <div className="absolute top-4 end-4">
            <button
              onClick={toggleLang}
              className="flex items-center text-white/80 hover:text-white focus:outline-none transition-colors font-medium text-sm"
              aria-label="Change Language"
            >
              <LanguageIcon className="h-5 w-5 me-1" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
        </div>

        <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
          <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">{t('reset_password_request_title')}</h1>
            <p className="text-white/70">{t('reset_password_request_subtitle')}</p>
          </div>
          
          {error && <p className="text-red-400 bg-red-900/50 text-sm text-center p-3 rounded-lg">{error}</p>}
          {resetMessage && <p className="text-green-400 bg-green-900/50 text-sm text-center p-3 rounded-lg">{resetMessage}</p>}
          
          {!resetMessage && (
            <form className="space-y-6" onSubmit={handlePasswordReset}>
              <div>
                <input
                  type="email" // Changed to email type
                  id="username-reset"
                  name="username-reset"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                  placeholder={t('email_address')} // Updated placeholder
                  autoComplete="email" // Updated autocomplete
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {loading ? t('loading') : t('send_reset_link')}
                </button>
              </div>
            </form>
          )}

          <div className="text-center">
             <button 
                type="button" 
                onClick={switchToLogin} 
                className="font-medium text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {t('back_to_login')}
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Language Switcher */}
      <div className="absolute top-4 end-4">
          <button
            onClick={toggleLang}
            className="flex items-center text-white/80 hover:text-white focus:outline-none transition-colors font-medium text-sm"
            aria-label="Change Language"
          >
            <LanguageIcon className="h-5 w-5 me-1" />
            <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
      </div>

      <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
        <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">{t('welcome_back')}</h1>
          <p className="text-white/70">{t('signin_to_account')}</p>
        </div>

        {error && (
          <p className="text-red-400 bg-red-900/50 text-sm text-center p-3 rounded-lg">
            {error}
          </p>
        )}

        {/* Form */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="relative">
            <input
              type="email" // Changed to email type
              id="username"
              name="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
              placeholder={t('email_address')} // Updated placeholder
              autoComplete="email" // Updated autocomplete
              required
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition ps-10"
              placeholder={t('password')}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 start-0 px-3 flex items-center text-slate-400 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOffIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="w-4 h-4 rounded bg-slate-700/50 border-slate-500/50 text-cyan-500 focus:ring-cyan-500"
              />
              {t('remember_me')}
            </label>
            <button 
              type="button" 
              onClick={switchToReset}
              className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {t('forgot_password')}
            </button>
          </div>

          {/* Sign In Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? t('signing_in') : t('sign_in')}
            </button>
          </div>
        </form>

        {/* Copyright Notice */}
        <div className="text-center text-xs text-white/50 pt-4 border-t border-white/25 mt-6">
          <p>Copyright © 2025 Mizan for SaniVita</p>
        </div>
      </div>
    </div>
  );
};

export default Login;