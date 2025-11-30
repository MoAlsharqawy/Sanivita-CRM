
import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, useCallback } from 'react';
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
  
  // Use a ref to track the current user ID processing to prevent race conditions
  // between getSession() and onAuthStateChange()
  const currentUserIdRef = useRef<string | null>(null);

  const fetchAndSetProfile = useCallback(async (userId: string) => {
    // If we are already displaying this user, skip fetching
    if (currentUserIdRef.current === userId && user) return;
    
    currentUserIdRef.current = userId;
    
    try {
      const profile = await api.getUserProfile(userId);
      setUser(profile);
      setAuthError(null);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      if (error.message === 'rls_error') {
        setAuthError('rls_error');
      } else if (error.message === 'profile_not_found') {
        // Valid auth session but no profile data -> Force logout
        await supabase.auth.signOut();
        setUser(null);
        currentUserIdRef.current = null;
      } else {
        // Generic error
        setAuthError('db_error_title');
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Get initial session
        // We use a timeout to prevent the app from hanging indefinitely if Supabase is unreachable
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('auth_timeout')), 7000)
        );

        const sessionPromise = supabase.auth.getSession();

        const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any }, error: any };
        
        if (result.error) throw result.error;

        const session = result.data.session;

        if (session?.user) {
          if (mounted) await fetchAndSetProfile(session.user.id);
        } else {
          if (mounted) {
            setUser(null);
            currentUserIdRef.current = null;
          }
        }

      } catch (error: any) {
        console.error("Auth Initialization Error:", error);
        if (mounted) {
          if (error.message === 'auth_timeout' || error === 'auth_timeout') {
            setAuthError('auth_timeout_error');
            await supabase.auth.signOut();
          } else {
             // Don't set global error for generic session missing, just logged out
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
           // This prevents double fetching if initAuth already handled it
           if (currentUserIdRef.current !== session.user.id) {
             await fetchAndSetProfile(session.user.id);
           }
           if (mounted) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          currentUserIdRef.current = null;
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAndSetProfile]);

  const login = async (username: string, password: string) => {
    setAuthError(null);
    const user = await api.login(username, password);
    // login api returns the user profile directly, update state immediately
    setUser(user);
    currentUserIdRef.current = user.id;
    return user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // Optimistic update
      setUser(null);
      setAuthError(null);
      currentUserIdRef.current = null;
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
