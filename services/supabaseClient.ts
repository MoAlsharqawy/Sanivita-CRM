import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to safely access environment variables and avoid TypeScript errors with import.meta
const getEnv = (key: string) => {
  // @ts-ignore
  return import.meta.env?.[key] || '';
};

const STORAGE_KEY_URL = 'sanivita-crm-supabase-url';
const STORAGE_KEY_KEY = 'sanivita-crm-supabase-key';

// Clean up legacy local storage keys that might cause conflicts
if (typeof window !== 'undefined') {
  const APP_PREFIX = 'sanivita-crm-';
  try {
    localStorage.removeItem(`${APP_PREFIX}supabaseUrl`);
    localStorage.removeItem(`${APP_PREFIX}supabaseAnonKey`);
  } catch (e) {
    console.error('Error clearing legacy credentials', e);
  }
}

const getStored = (key: string) => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
    }
    return null;
}

// Determine initial credentials: LocalStorage -> Env Vars -> Empty
const storedUrl = getStored(STORAGE_KEY_URL);
const storedKey = getStored(STORAGE_KEY_KEY);
const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

const targetUrl = storedUrl || envUrl || '';
const targetKey = storedKey || envKey || '';

// Internal function to create the actual client instance
const createClientInstance = (url: string, key: string) => {
    // Basic validation to prevent crashing on invalid URLs
    const isValidUrl = (s: string) => {
        try { return !!new URL(s); } catch { return false; }
    };

    if (!url || !key || !isValidUrl(url)) {
        // Return a safe dummy client that won't crash the app immediately,
        // but will fail gracefully on requests (handled by DbErrorScreen)
        return createClient('https://placeholder.supabase.co', 'placeholder', {
            auth: { 
                persistSession: false, 
                autoRefreshToken: false, 
                detectSessionInUrl: false 
            }
        });
    }

    return createClient(url, key, {
        auth: {
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    });
};

// Singleton reference to the current underlying client
let currentClient = createClientInstance(targetUrl, targetKey);

/**
 * Updates the Supabase client with new credentials and persists them.
 * Used by the connection screen.
 */
export const initializeSupabase = (url: string, key: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_URL, url);
        localStorage.setItem(STORAGE_KEY_KEY, key);
    }
    currentClient = createClientInstance(url, key);
};

/**
 * Clears persisted credentials and reverts to environment variables or dummy client.
 */
export const clearSupabaseCredentials = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_URL);
        localStorage.removeItem(STORAGE_KEY_KEY);
    }
    const fallbackUrl = getEnv('VITE_SUPABASE_URL');
    const fallbackKey = getEnv('VITE_SUPABASE_ANON_KEY');
    currentClient = createClientInstance(fallbackUrl, fallbackKey);
};

// Export a Proxy that delegates to the currentClient.
// This allows the app to import 'supabase' as a constant while we swap the instance internally.
export const supabase = new Proxy({} as SupabaseClient, {
    get: (_target, prop: string | symbol) => {
        // @ts-ignore
        const val = currentClient[prop];
        if (typeof val === 'function') {
            return val.bind(currentClient);
        }
        return val;
    }
});