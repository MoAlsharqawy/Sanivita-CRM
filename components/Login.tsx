import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { EyeIcon, EyeOffIcon } from './icons';
import { Logo } from './Logo';


const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      if (!user) {
        setError(t('incorrect_credentials'));
      }
    } catch (err) {
      setError(t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
        <Logo className="h-20 mx-auto text-cyan-400"/>

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
          {/* Email Input */}
          <div className="relative">
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
              placeholder={t('email_address')}
              autoComplete="username"
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

          {/* Remember Me */}
          <div className="flex items-center text-sm">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="w-4 h-4 rounded bg-slate-700/50 border-slate-500/50 text-cyan-500 focus:ring-cyan-500"
              />
              {t('remember_me')}
            </label>
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
      </div>
    </div>
  );
};

export default Login;