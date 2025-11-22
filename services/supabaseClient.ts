
import { createClient } from '@supabase/supabase-js';

// CLEANUP: Remove legacy keys to prevent conflicts with the new static client
try {
  if (typeof window !== 'undefined') {
    const keysToRemove = [
      'sanivita-crm-supabase-url',
      'sanivita-crm-supabase-key',
      'sanivita-crm-supabaseUrl',
      'sanivita-crm-supabaseAnonKey',
      'supabase.auth.token'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
} catch (e) {
  // Ignore errors during cleanup
}

// Safely access environment variables from various sources (Vite or Process)
const getEnvVar = (key: string): string | undefined => {
    let value: string | undefined;

    // 1. Try import.meta.env (Vite standard)
    try {
        // @ts-ignore
        if (import.meta && import.meta.env) {
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

    return value;
}

// Retrieve keys
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Log warning for debugging if keys are missing
if (!isSupabaseConfigured) {
  console.warn('Supabase URL or Anon Key is missing from environment variables. The app will run in placeholder mode and API calls will fail.');
}

// Create a single static client instance
// Use fallbacks to ensure createClient never throws "supabaseUrl is required" crash
// This prevents the "White Screen of Death" on startup
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
