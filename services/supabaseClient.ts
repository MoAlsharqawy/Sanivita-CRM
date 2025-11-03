import { createClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// !! IMPORTANT !!
// PLEASE REPLACE THESE VALUES WITH YOUR OWN SUPABASE PROJECT URL AND ANON KEY
// You can find them in your Supabase project settings under "API"
// -----------------------------------------------------------------------------
const supabaseUrl = 'https://vuqwvrgnkwhayrzxznpx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1cXd2cmdua3doYXlyenh6bnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMzE4MzQsImV4cCI6MjA3NzcwNzgzNH0.hIm_JCy0_LXDTpnIfzy1kIFnLgguGoyVEWm75trTuWo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
