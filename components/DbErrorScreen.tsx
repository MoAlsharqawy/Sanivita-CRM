import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Logo } from './Logo';
import { WarningIcon, CopyIcon } from './icons';

interface DbErrorScreenProps {
    error: string;
}

const DbErrorScreen: React.FC<DbErrorScreenProps> = ({ error }) => {
    const { t } = useLanguage();
    const [copyButtonText, setCopyButtonText] = useState(t('copy_sql'));

    const rlsPolicySQL = 
`-- Step 1: Enable Row Level Security on the profiles table (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any old, potentially conflicting SELECT policy.
-- The "IF EXISTS" part prevents an error if no policy is there.
DROP POLICY IF EXISTS "Allow individual users to read their own profile" ON public.profiles;

-- Step 3: Create the correct policy that allows authenticated users to read their own profile.
CREATE POLICY "Allow individual users to read their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);
`;

    const handleCopy = () => {
        navigator.clipboard.writeText(rlsPolicySQL).then(() => {
            setCopyButtonText(t('copied'));
            setTimeout(() => setCopyButtonText(t('copy_sql')), 2000);
        });
    };

    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-[#3a3358] text-slate-100 flex items-center justify-center p-4" dir={t('dir')}>
            <div className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-6 animate-fade-in-up">
                <Logo className="h-20 mx-auto text-cyan-400" showIcon={false}/>
                
                <div className="text-center space-y-2 flex flex-col items-center">
                    <WarningIcon className="h-16 w-16 text-yellow-400 mb-4" />
                    <h1 className="text-3xl font-bold text-white">{t('db_error_title')}</h1>
                </div>

                <div className="text-white/80 space-y-4 text-center">
                    <p>{t('db_error_rls_explanation_1')}</p>
                    <p>{t('db_error_rls_explanation_2')}</p>
                </div>

                <div className="space-y-3">
                    <p className="text-white/90 text-center font-semibold">{t('db_error_rls_solution')}</p>
                    <div className="relative bg-slate-900/70 rounded-lg p-4 border border-slate-600">
                        <pre className="text-slate-300 text-xs whitespace-pre-wrap overflow-x-auto no-scrollbar">
                            <code>
                                {rlsPolicySQL}
                            </code>
                        </pre>
                        <button 
                            onClick={handleCopy}
                            className="absolute top-2 end-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors"
                        >
                            <CopyIcon className="w-4 h-4" />
                            {copyButtonText}
                        </button>
                    </div>
                </div>

                <div>
                    <button
                        onClick={handleRetry}
                        className="w-full py-3 px-4 font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity"
                    >
                        {t('try_again')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DbErrorScreen;
