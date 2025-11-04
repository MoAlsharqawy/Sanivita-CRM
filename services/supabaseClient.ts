

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export const initializeSupabase = (url: string, key: string): SupabaseClient => {
    try {
        // Clear any previous instance before creating a new one
        supabaseInstance = null;
        const client = createClient(url, key);
        supabaseInstance = client;
        localStorage.setItem('supabaseUrl', url);
        localStorage.setItem('supabaseAnonKey', key);
        return client;
    } catch (e) {
        console.error("Error initializing Supabase", e);
        clearSupabaseCredentials();
        throw e;
    }
};

export const getSupabaseClient = (): SupabaseClient => {
    if (supabaseInstance) {
        return supabaseInstance;
    }

    // Prioritize environment variables for deployment (e.g., on Vercel)
    const envUrl = process.env.SUPABASE_URL;
    const envKey = process.env.SUPABASE_ANON_KEY;

    if (envUrl && envKey) {
        try {
            const client = createClient(envUrl, envKey);
            supabaseInstance = client;
            return supabaseInstance;
        } catch (e) {
            console.error("Error creating Supabase client from environment variables", e);
            // Don't throw, fall through to try localStorage
        }
    }

    // Fallback to localStorage for local development
    const url = localStorage.getItem('supabaseUrl');
    const key = localStorage.getItem('supabaseAnonKey');

    if (url && key) {
        try {
            supabaseInstance = createClient(url, key);
            return supabaseInstance;
        } catch(e) {
            console.error("Error creating Supabase client from localStorage", e);
            clearSupabaseCredentials();
            // Don't throw, as it crashes the app. Fall through to create a dummy client.
        }
    }

    // If we're here, no valid credentials were found or they were malformed.
    // The original code threw an error, crashing the app.
    // Instead, we will create and return a temporary dummy client.
    // Any API call using this client will fail. This failure is caught by the
    // logic in useAuth.tsx, which clears credentials and reloads, forcing
    // the user to the connection screen. This prevents the app from crashing.
    console.warn("No valid Supabase credentials found. Creating a temporary dummy client.");
    return createClient('http://127.0.0.1:54321', 'dummy-anon-key');
};

export const hasSupabaseCredentials = (): boolean => {
    // Check for environment variables first
    return (!!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY) ||
           // Then check localStorage
           (!!localStorage.getItem('supabaseUrl') && !!localStorage.getItem('supabaseAnonKey'));
};

export const clearSupabaseCredentials = () => {
    localStorage.removeItem('supabaseUrl');
    localStorage.removeItem('supabaseAnonKey');
    supabaseInstance = null;
};