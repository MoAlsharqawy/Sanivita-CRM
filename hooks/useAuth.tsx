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
    setLoading(true);
    setAuthError(null);
    const supabase = getSupabaseClient();

    // Check for an active session on initial component load.
    // This is faster than waiting for onAuthStateChange to fire.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const profile = await api.getUserProfile(session.user.id);
          setUser(profile);
        } catch (e: any) {
          console.error("Error fetching initial user profile:", e);
          setAuthError(e.message === 'rls_error' ? e.message : 'login_error');
          setUser(null);
        }
      }
      setLoading(false);
    });

    // Listen for any subsequent changes in auth state (e.g., login, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const profile = await api.getUserProfile(session.user.id);
          setUser(profile);
          setAuthError(null);
        } catch (e: any) {
          console.error("Error on auth state change:", e);
          setAuthError(e.message === 'rls_error' ? e.message : 'login_error');
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
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
