import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { getSupabaseClient } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setAuthError(null);
    const supabase = getSupabaseClient();

    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            throw sessionError;
        }

        if (!session?.user) {
          if (mounted) setUser(null);
          return;
        }

        // User exists, fetch profile
        const profile = await api.getUserProfile(session.user.id);
        if (mounted) {
            setUser(profile);
        }
      } catch (error: any) {
        console.error("Error during session check/profile fetch:", error);
        const errorMessage = error?.message || String(error);
        
        if (mounted) {
            if (errorMessage === 'rls_error') {
                setAuthError('rls_error');
            } else {
                // For other errors (network, etc), we clear auth error to avoid stuck error screens,
                // but user will be null (logged out state effectively)
                setAuthError(null);
            }
            setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      if (session?.user) {
        try {
          // We re-fetch profile on auth change to ensure we have fresh role data
          // or to handle sign-in after initial load
          const profile = await api.getUserProfile(session.user.id);
          if (mounted) {
            setUser(profile);
            setAuthError(null);
          }
        } catch (e: any) {
          console.error("Error on auth state change:", e);
          const errorMessage = e?.message || String(e);
          if (mounted) {
            if (errorMessage === 'rls_error') {
                setAuthError('rls_error');
            } else {
                setAuthError(null);
            }
            setUser(null);
          }
        }
      } else {
        if (mounted) {
            setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);


  const login = async (username: string, password: string) => {
    setAuthError(null);
    return await api.login(username, password);
  };

  const logout = async () => {
    setUser(null);
    setAuthError(null);
    try {
      await api.logout();
    } catch (error) {
      console.error("Error signing out from server:", error);
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};