import { createClient } from '@supabase/supabase-js'

// Helper to check if we're in the browser
export const isBrowser = typeof window !== 'undefined'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: isBrowser,
    persistSession: isBrowser,
    detectSessionInUrl: isBrowser
  }
})

// Export singleton instance
export const supabase = supabaseClient
