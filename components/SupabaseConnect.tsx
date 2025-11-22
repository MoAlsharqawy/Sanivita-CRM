import React from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Logo } from './Logo';

// This component is now deprecated as we use static environment variables for connection.
// It is kept as a placeholder to prevent build errors if imported elsewhere, 
// but the logic for dynamic connection has been removed.

interface SupabaseConnectProps {
    onSuccess: () => void;
}

const SupabaseConnect: React.FC<SupabaseConnectProps> = () => {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6">
                <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">{t('db_error_title')}</h1>
                    <p className="text-white/70">
                        Dynamic connection is disabled. Please configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your environment variables.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SupabaseConnect;
