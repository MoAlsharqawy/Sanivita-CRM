import React, { useState } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';
import { EyeIcon, EyeOffIcon } from './icons';
import { Logo } from './Logo';

interface ResetPasswordProps {
    onSuccess: () => void;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onSuccess }) => {
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password.length < 6) {
            setError(t('error_password_too_short'));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('error_passwords_no_match'));
            return;
        }

        setLoading(true);
        try {
            const result = await api.updateUserPassword(password);
            if (result) {
                setSuccess(t('password_reset_success'));
                setTimeout(onSuccess, 2500); // Wait before redirecting
            } else {
                setError(t('error_password_update_failed'));
            }
        } catch (err: any) {
            setError(t(err.message || 'error_unexpected'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
                <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-white">{t('reset_password_title')}</h1>
                    <p className="text-white/70">{t('reset_password_subtitle')}</p>
                </div>

                {error && <p className="text-red-400 bg-red-900/50 text-sm text-center p-3 rounded-lg">{error}</p>}
                {success && <p className="text-green-400 bg-green-900/50 text-sm text-center p-3 rounded-lg">{success}</p>}

                {!success && (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {/* New Password Input */}
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition ps-10"
                                placeholder={t('new_password')}
                                required
                            />
                             <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 start-0 px-3 flex items-center text-slate-400 hover:text-white"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                            </button>
                        </div>

                        {/* Confirm Password Input */}
                        <div className="relative">
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                                placeholder={t('confirm_new_password')}
                                required
                            />
                        </div>

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
                            >
                                {loading ? t('saving') : t('save_changes')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
