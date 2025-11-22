
import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Ref to track initialization status to prevent double-execution in React Strict Mode
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    let mounted = true;
    setLoading(true);

    const initAuth = async () => {
      if (!isSupabaseConfigured) {
          if (mounted) setLoading(false);
          return;
      }

      // Timeout promise to reject if Supabase hangs (e.g., stale local storage token)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('auth_timeout')), 7000)
      );

      // Validating session
      const sessionPromise = supabase.auth.getSession();

      try {
        const result = await Promise.race([
            sessionPromise,
            timeoutPromise
        ]) as { data: { session: any }, error: any };

        if (result.error) throw result.error;

        const session = result.data.session;

        if (session?.user) {
          const profile = await api.getUserProfile(session.user.id);
          if (mounted) setUser(profile);
        }
      } catch (error: any) {
        console.error("Auth Initialization Error:", error);
        
        if (mounted) {
             if (error.message === 'auth_timeout' || error === 'auth_timeout') {
                 console.warn("Auth timeout detected. Clearing session.");
                 setAuthError('auth_timeout_error');
                 // Force sign out to clear the stuck session from local storage
                 await supabase.auth.signOut();
                 setUser(null);
             } else if (error.message === 'rls_error') {
                 setAuthError('rls_error');
                 setUser(null);
             } else {
                 // Generic error, assume logged out
                 setUser(null);
             }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // Only react to explicit sign-in/sign-out events to avoid conflict with initAuth
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          try {
            // Ensure we have the latest profile data
            const profile = await api.getUserProfile(session.user.id);
            if (mounted) {
                setUser(profile);
                setAuthError(null);
            }
          } catch (e) {
            console.error("Error fetching profile on auth change:", e);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
            setUser(null);
            setAuthError(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
