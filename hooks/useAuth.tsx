

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { getSupabaseClient } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const supabase = getSupabaseClient();

    // onAuthStateChange fires immediately with the initial session or null.
    // This is the recommended way to handle session restoration.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        // If a session exists, fetch the user's profile.
        if (session?.user) {
          const profile = await api.getUserProfile(session.user.id);
          setUser(profile);
        } else {
          // If no session, ensure user is null.
          setUser(null);
        }
      } catch (e) {
        console.error("Error during onAuthStateChange handling:", e);
        // If fetching the profile fails, treat the user as logged out.
        setUser(null);
      } finally {
        // Once the initial session check is complete, loading is finished.
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  const login = async (username: string, password: string) => {
    // The onAuthStateChange listener will handle setting the user state upon successful login.
    return await api.login(username, password);
  };

  const logout = async () => {
    // Optimistically log out on the client for instant UI feedback.
    setUser(null);
    try {
      await api.logout();
    } catch (error) {
      console.error("Error signing out from server:", error);
      // Even if server fails, the client is logged out.
    }
  };


  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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