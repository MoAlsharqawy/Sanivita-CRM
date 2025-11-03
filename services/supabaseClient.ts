
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

    throw new Error("Supabase client not initialized. Call initializeSupabase or ensure credentials are in localStorage.");
};

export const hasSupabaseCredentials = (): boolean => {
    return !!localStorage.getItem('supabaseUrl') && !!localStorage.getItem('supabaseAnonKey');
};

export const clearSupabaseCredentials = () => {
    localStorage.removeItem('supabaseUrl');
    localStorage.removeItem('supabaseAnonKey');
    supabaseInstance = null;
};
