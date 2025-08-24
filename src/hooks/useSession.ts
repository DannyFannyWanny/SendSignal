'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'

interface Profile {
  id: string
  first_name: string | null
  created_at: string
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        setSession(session)
        setUser(session?.user || null)
        
        if (session?.user) {
          // Much more aggressive timeout - don't wait for profile
          setLoading(false) // Show UI immediately
          
          // Fetch profile in background (non-blocking)
          fetchProfile(session.user.id).catch(error => {
            console.error('Profile fetch failed:', error)
            setProfile(null)
          })
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user || null)
        
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      // Much more aggressive timeout - 3 seconds max
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout after 3 seconds')), 3000)
      })
      
      const fetchPromise = supabase
        .from('profiles')
        .select('id, first_name, created_at')
        .eq('id', userId)
        .single()
      
      const result = await Promise.race([fetchPromise, timeoutPromise])
      const { data, error } = result

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      // Set profile to null to prevent infinite loading
      setProfile(null)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return {
    session,
    user,
    profile,
    loading,
    signOut,
    isAuthenticated: !!session,
    hasProfile: !!profile?.first_name
  }
}
