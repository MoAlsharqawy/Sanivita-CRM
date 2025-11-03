
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { getSupabaseClient, clearSupabaseCredentials } from '../services/supabaseClient';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error; // Throw to be caught by catch block

        if (session?.user) {
          const profile = await api.getUserProfile(session.user.id);
          setUser(profile);
        }
      } catch (e) {
        console.error("Error checking user session, likely invalid credentials.", e);
        clearSupabaseCredentials(); // Clear bad credentials
        window.location.reload(); // Reload to show connect screen
      } finally {
        setLoading(false);
      }
    };
    
    checkUser();

    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await api.getUserProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);


  const login = async (username: string, password: string) => {
    // The onAuthStateChange listener will handle setting the user state
    return await api.login(username, password);
  };

  const logout = async () => {
    await api.logout();
    setUser(null); // Clear user immediately for faster UI response
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
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