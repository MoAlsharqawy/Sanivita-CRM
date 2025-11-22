
import { createClient } from '@supabase/supabase-js';

// CLEANUP: Remove legacy keys to prevent conflicts with the new static client
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

// Safely access environment variables
const getEnv = () => {
    try {
        return (import.meta as any).env || {};
    } catch {
        return {};
    }
}

const env = getEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables. Using placeholder values to prevent crash.');
}

// Create a single static client instance
// Fallback to placeholder values prevents "supabaseUrl is required" error when env vars are missing
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
