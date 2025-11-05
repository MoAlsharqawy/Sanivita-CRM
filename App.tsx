import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from './hooks/useAuth';
import Login from './components/Login';
import ManagerDashboard from './components/ManagerDashboard';
import RepDashboard from './components/RepDashboard';
import { UserRole } from './types';
import { Header } from './components/Header';
import { useLanguage } from './hooks/useLanguage';
import Spinner from './components/Spinner';
import SupabaseConnect from './components/SupabaseConnect';
import { hasSupabaseCredentials, getSupabaseClient } from './services/supabaseClient';
import ResetPassword from './components/ResetPassword';
import DbErrorScreen from './components/DbErrorScreen';

const AppContent: React.FC = () => {
  const { user, loading, authError } = useAuth();
  const { dir } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#3a3358] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (authError) {
      return <DbErrorScreen error={authError} />;
  }


  if (!user) {
    return (
      <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
        <Login />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-violet-100 to-amber-100 text-slate-800 animate-fade-in" dir={dir}>
      <Header />
      <main className="p-4 md:p-8">
        {user.role === UserRole.Manager || user.role === UserRole.Supervisor ? <ManagerDashboard /> : <RepDashboard />}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [isDbConnected, setIsDbConnected] = useState(hasSupabaseCredentials());
  const { dir } = useLanguage();
  const [authMode, setAuthMode] = useState<'default' | 'reset_password'>('default');

  useEffect(() => {
    // Only set up the listener if the database is already connected,
    // otherwise the Supabase client might not be initialized properly.
    if (isDbConnected) {
        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setAuthMode('reset_password');
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }
  }, [isDbConnected]);

  if (authMode === 'reset_password') {
      return (
          <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
              <ResetPassword onSuccess={() => {
                  window.location.hash = '';
                  // A full reload ensures all states are reset and the user is presented with the login screen.
                  window.location.reload(); 
              }} />
          </div>
      );
  }

  if (!isDbConnected) {
    return (
        <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
            <SupabaseConnect onSuccess={() => setIsDbConnected(true)} />
        </div>
    );
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};


export default App;