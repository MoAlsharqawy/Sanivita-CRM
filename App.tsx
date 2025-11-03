import React from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import ManagerDashboard from './components/ManagerDashboard';
import RepDashboard from './components/RepDashboard';
import { UserRole } from './types';
import { Header } from './components/Header';
import { useLanguage } from './hooks/useLanguage';
import Spinner from './components/Spinner';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const { dir } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#3a3358] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }


  if (!user) {
    // Apply a dark background for the login page
    return (
      <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
        <Login />
      </div>
    );
  }

  // Original background for the authenticated app
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-violet-100 to-amber-100 text-slate-800 animate-fade-in" dir={dir}>
      <Header />
      <main className="p-4 md:p-8">
        {user.role === UserRole.Manager || user.role === UserRole.Supervisor ? <ManagerDashboard /> : <RepDashboard />}
      </main>
    </div>
  );
};

export default App;