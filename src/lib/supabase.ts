
import { createClient } from '@supabase/supabase-js';

// Access environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
// Validating keys to prevent runtime crashes if variables are missing
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'JARVIS_FILL_THIS' && supabaseAnonKey !== 'JARVIS_FILL_THIS';

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Helper to check if Supabase is ready to use.
 * Use this before making any calls to avoid errors.
 */
export const isSupabaseLive = () => {
    return !!supabase;
};
