import { createClient, SupabaseClient } from '@supabase/supabase-js';

const APP_PREFIX = 'sanivita-crm-';
const URL_KEY = `${APP_PREFIX}supabaseUrl`;
const ANON_KEY_KEY = `${APP_PREFIX}supabaseAnonKey`;

let supabaseInstance: SupabaseClient | null = null;

// Build auth options but guard access to `window` (avoid ReferenceError in non-browser)
const supabaseOptions = {
  auth: {
    // storage may be undefined on server / build time
    storage: (typeof window !== 'undefined' ? window.localStorage : undefined) as unknown as Storage | undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

export const initializeSupabase = (url: string, key: string): SupabaseClient => {
  try {
    supabaseInstance = null;
    const client = createClient(url, key, supabaseOptions);
    supabaseInstance = client;
    // only access localStorage if available
    if (typeof window !== 'undefined') {
      localStorage.setItem(URL_KEY, url);
      localStorage.setItem(ANON_KEY_KEY, key);
    }
    return client;
  } catch (e) {
    console.error('Error initializing Supabase', e);
    clearSupabaseCredentials();
    throw e;
  }
};

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  // Use Vite env (available at build/runtime in the browser)
  // Guard with typeof so TypeScript/SSR doesn't fail
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || null;
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || null;

  if (envUrl && envKey) {
    try {
      const client = createClient(String(envUrl), String(envKey), supabaseOptions);
      supabaseInstance = client;
      return supabaseInstance;
    } catch (e) {
      console.error('Error creating Supabase client from environment variables', e);
      // fall through to localStorage fallback
    }
  }

  // Fallback to localStorage (only in browser)
  if (typeof window !== 'undefined') {
    const url = localStorage.getItem(URL_KEY);
    const key = localStorage.getItem(ANON_KEY_KEY);

    if (url && key) {
      try {
        supabaseInstance = createClient(url, key, supabaseOptions);
        return supabaseInstance;
      } catch (e) {
        console.error('Error creating Supabase client from localStorage', e);
        clearSupabaseCredentials();
      }
    }
  }

  // Last resort: return a dummy client (won't work for requests) but prevents app from throwing
  console.warn('No valid Supabase credentials found. Creating a temporary dummy client.');
  return createClient('http://127.0.0.1:54321', 'dummy-anon-key');
};

export const hasSupabaseCredentials = (): boolean => {
  const envPresent = !!((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) &&
                       (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY));
  const localPresent = (typeof window !== 'undefined') &&
                       (!!localStorage.getItem(URL_KEY) && !!localStorage.getItem(ANON_KEY_KEY));
  return envPresent || localPresent;
};

export const clearSupabaseCredentials = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(URL_KEY);
    localStorage.removeItem(ANON_KEY_KEY);
  }
  supabaseInstance = null;
};
