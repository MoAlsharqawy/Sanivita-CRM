import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Logo } from './Logo';
import { initializeSupabase, clearSupabaseCredentials } from '../services/supabaseClient';
import { api } from '../services/api';

interface SupabaseConnectProps {
    onSuccess: () => void;
}

const SupabaseConnect: React.FC<SupabaseConnectProps> = ({ onSuccess }) => {
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!url.trim() || !anonKey.trim()) {
            setError(t('connect_error_all_fields'));
            setLoading(false);
            return;
        }
        
        try {
            // Initialize first, this may throw if URL is malformed
            initializeSupabase(url, anonKey);
            
            // Then test connection with a lightweight query
            await api.testSupabaseConnection();

            onSuccess();

        } catch (err: any) {
            const message = err.message || t('connect_error_credentials');
            setError(message);
            clearSupabaseCredentials(); // Clear bad credentials if test fails
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
                <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>

                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-white">{t('connect_db_title')}</h1>
                    <p className="text-white/70">{t('connect_db_subtitle')}</p>
                </div>

                {error && (
                    <p className="text-red-400 bg-red-900/50 text-sm text-center p-3 rounded-lg">
                        {error}
                    </p>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <input
                            type="url"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                            placeholder={t('supabase_url')}
                            required
                        />
                    </div>

                    <div>
                        <input
                            type="text"
                            value={anonKey}
                            onChange={e => setAnonKey(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-700/50 rounded-lg border border-slate-500/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition"
                            placeholder={t('supabase_anon_key')}
                            required
                        />
                    </div>
                    
                    <div className="text-xs text-white/50 text-center">
                        {t('connect_db_instructions')}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 flex justify-center items-center"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white me-3"></div>
                                    {t('connecting')}
                                </>
                            ) : t('connect')}
                        </button>
                    </div>
                </form>

                <div className="text-center text-xs text-white/50 pt-4 border-t border-white/25 mt-6">
                    <p>هذا التطبيق مستضاف على:</p>
                    <a href="https://sanivita-crm.vercel.app" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                        sanivita-crm.vercel.app
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SupabaseConnect;
