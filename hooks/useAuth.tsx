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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const profile = await api.getUserProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (e: any) {
        console.error("Error during onAuthStateChange handling:", e);
        if (e.message === 'rls_error') {
            // This specific error means the database is misconfigured.
            // We set an error state for the UI to handle, instead of just logging out.
            setAuthError(e.message);
        }
        setUser(null);
      } finally {
        setLoading(false);
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