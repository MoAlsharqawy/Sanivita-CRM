

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
            throw new Error("Invalid Supabase credentials in environment variables.");
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
            // This will force the app to show the connect screen on next load/reload.
            throw new Error("Invalid Supabase credentials in storage.");
        }
    }

    throw new Error("Supabase client not initialized. Set environment variables or use the connection screen.");
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