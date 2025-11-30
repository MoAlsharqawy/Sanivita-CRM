
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
  
  // Use a ref to track initialization status to prevent double execution in Strict Mode
  const initRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const profile = await api.getUserProfile(userId);
      setUser(profile);
      setAuthError(null);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      if (error.message === 'rls_error') {
        setAuthError('rls_error');
      } else if (error.message === 'profile_not_found') {
        // Valid auth session but no profile data -> Force local logout
        setUser(null);
        // Do not await this, just fire and forget to avoid blocking UI
        supabase.auth.signOut().catch(() => {});
      } else {
        setAuthError('db_error_title');
      }
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const initAuth = async () => {
      // Prevent double invocation
      if (initRef.current) return;
      initRef.current = true;

      try {
        // 1. Get initial session with a timeout
        // We use a timeout to prevent the app from hanging indefinitely if Supabase is unreachable
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('auth_timeout')), 7000)
        );

        const sessionPromise = supabase.auth.getSession();

        const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any }, error: any };
        
        if (result.error) throw result.error;

        const session = result.data.session;

        if (session?.user) {
          if (mounted) await fetchProfile(session.user.id);
        } else {
          if (mounted) {
            setUser(null);
          }
        }

      } catch (error: any) {
        console.error("Auth Initialization Error:", error);
        if (mounted) {
          if (error.message === 'auth_timeout' || error === 'auth_timeout') {
            setAuthError('auth_timeout_error');
            // CRITICAL FIX: Do NOT await signOut here. If the network is down (causing timeout),
            // signOut will also hang/timeout, preventing the finally block from executing.
            supabase.auth.signOut().catch(() => {});
          } else {
             // For generic errors, just ensure user is null so app can load public route
             setUser(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
           // Optimistic check to avoid refetching if we already have the correct user loaded
           setUser(prev => {
             if (prev && prev.id === session.user.id) return prev;
             // If different user or no user, fetch profile
             fetchProfile(session.user.id);
             return prev;
           });
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
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
    const user = await api.login(username, password);
    // login api returns the user profile directly, update state immediately
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setUser(null);
      setAuthError(null);
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
