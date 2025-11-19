import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
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

// A wrapper for routes that require authentication
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading, authError } = useAuth();
  const location = useLocation();
  const { dir } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#3a3358] flex items-center justify-center" dir={dir}>
        <Spinner />
      </div>
    );
  }

  if (authError) {
    return <DbErrorScreen error={authError} />;
  }

  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
};

// A wrapper for the login page to handle redirection if a user is already logged in
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
   const { user, loading } = useAuth();
   if (loading) {
       return (
          <div className="min-h-screen bg-[#3a3358] flex items-center justify-center">
            <Spinner />
          </div>
       );
   }
   return user ? <Navigate to="/" replace /> : children;
}

// The main dashboard content, shown when a user is authenticated
const Dashboard: React.FC = () => {
  const { user } = useAuth(); // We know user is not null here due to ProtectedRoute
  const { dir } = useLanguage();
  
  if (!user) return null; // Should not happen, but for type safety

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-violet-100 to-amber-100 text-slate-800 animate-fade-in" dir={dir}>
      <Header />
      <main className="p-4 md:p-8">
        {user.role === UserRole.Manager || user.role === UserRole.Supervisor ? <ManagerDashboard /> : <RepDashboard />}
      </main>
    </div>
  );
};

// Component to manage routing logic and side-effects
const AppRoutes: React.FC = () => {
    const { dir } = useLanguage();
    const navigate = useNavigate();

    useEffect(() => {
        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                // This event fires when the user clicks the password reset link.
                // We navigate them to the dedicated page to set a new password.
                navigate('/reset-password');
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [navigate]);

    return (
        <Routes>
            <Route 
                path="/login" 
                element={
                    <PublicRoute>
                        <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
                            <Login />
                        </div>
                    </PublicRoute>
                } 
            />
            <Route 
                path="/reset-password" 
                element={
                    <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
                        <ResetPassword onSuccess={() => navigate('/login', { replace: true })} />
                    </div>
                } 
            />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            {/* Any other unknown path will redirect to the main page */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

// The main App component, now simplified to handle DB connection and provide auth context
const App: React.FC = () => {
  const [isDbConnected, setIsDbConnected] = useState(hasSupabaseCredentials());
  const { dir } = useLanguage();

  if (!isDbConnected) {
    return (
        <div className="min-h-screen bg-[#3a3358] text-slate-100" dir={dir}>
            <SupabaseConnect onSuccess={() => setIsDbConnected(true)} />
        </div>
    );
  }

  return (
    <AuthProvider>
        <AppRoutes />
    </AuthProvider>
  );
};

export default App;