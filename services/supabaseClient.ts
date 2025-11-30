
import { createClient } from '@supabase/supabase-js';

// Safely access environment variables from various sources (Vite or Process)
const getEnvVar = (key: string): string | undefined => {
    let value: string | undefined;

    // 1. Try import.meta.env (Vite standard)
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            value = import.meta.env[key];
        }
    } catch (e) {}

    // 2. Try process.env (Node/System/Vercel fallback)
    if (!value) {
        try {
            if (typeof process !== 'undefined' && process.env) {
                value = process.env[key];
            }
        } catch (e) {}
    }

    // Treat empty strings or 'undefined' string as undefined
    if (!value || value === '' || value === 'undefined' || value === 'null') {
        return undefined;
    }

    return value;
}

// Retrieve keys
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Strict check to ensure we don't try to connect with invalid configs
export const isSupabaseConfigured = 
    !!supabaseUrl && 
    !!supabaseAnonKey && 
    supabaseUrl.startsWith('http');

// Log warning for debugging if keys are missing
if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing or invalid. The app will run in offline/demo mode where possible.');
}

// Create a single static client instance
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
