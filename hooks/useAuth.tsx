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
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
          if (!session?.user) {
              // No user, resolve with null to stop the chain.
              return Promise.resolve(null);
          }
          // User exists, continue the chain by fetching profile.
          return api.getUserProfile(session.user.id);
      })
      .then(profile => {
          // `profile` is either the user profile object or null.
          setUser(profile);
      })
      .catch(error => {
          console.error("Error during session check/profile fetch:", error);
          const errorMessage = error.message;
          // Only block the app with DbErrorScreen if it's explicitly an RLS or configuration error.
          // For other errors (e.g. network, missing profile row), we treat it as 'not logged in'
          // so the user is redirected to the login page to try again.
          if (errorMessage === 'rls_error') {
            setAuthError('rls_error');
          } else {
            setAuthError(null);
          }
          setUser(null);
      })
      .finally(() => {
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
          // Apply same logic: only set authError for critical RLS/DB config issues
          if (e.message === 'rls_error') {
            setAuthError('rls_error');
          } else {
            setAuthError(null);
          }
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