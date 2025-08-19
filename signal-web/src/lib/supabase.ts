import { createClient } from '@supabase/supabase-js'

// Helper to check if we're in the browser
export const isBrowser = typeof window !== 'undefined'

// Environment variables with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pqplojyejchgxhwidzro.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcGxvanllamNoZ3hod2lkenJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjQ1MjgsImV4cCI6MjA3MTIwMDUyOH0.AFe0ATIG3IetkXgouNTMwElDT6C9FTjKsrdyxR0bymg'

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
