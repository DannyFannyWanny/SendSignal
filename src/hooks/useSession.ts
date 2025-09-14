'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Session, User } from '@supabase/supabase-js'

interface Profile {
  id: string
  first_name: string | null
  date_of_birth: string | null
  profile_picture_url: string | null
  created_at: string
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        setSession(session)
        setUser(session?.user || null)
        
        if (session?.user) {
          // Start profile fetch but don't wait for it
          setProfileLoading(true)
          fetchProfile(session.user.id).catch(error => {
            console.error('Profile fetch failed on initial load:', error)
            setProfile(null)
          }).finally(() => {
            setProfileLoading(false)
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
          // Start profile fetch but don't wait for it
          setProfileLoading(true)
          fetchProfile(session.user.id).catch(error => {
            console.error('Profile fetch failed on sign in:', error)
            setProfile(null)
          }).finally(() => {
            setProfileLoading(false)
          })
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
          setProfileLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 Fetching profile for user:', userId)
      
      // Longer timeout - 10 seconds max
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout after 10 seconds')), 10000)
      })
      
      const fetchPromise = supabase
        .from('profiles')
        .select('id, first_name, date_of_birth, profile_picture_url, created_at')
        .eq('id', userId)
        .single()
      
      const result = await Promise.race([fetchPromise, timeoutPromise])
      const { data, error } = result

      if (error) {
        console.error('❌ Error fetching profile:', error)
        console.error('❌ Error details:', { code: error.code, message: error.message, details: error.details })
        
        // If profile doesn't exist, create a basic one
        if (error.code === 'PGRST116') {
          console.log('📝 Profile not found, creating basic profile...')
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({ id: userId, first_name: null })
              .select('id, first_name, date_of_birth, profile_picture_url, created_at')
              .single()
            
            if (createError) {
              console.error('❌ Error creating profile:', createError)
              setProfile(null)
              return
            }
            
            console.log('✅ Basic profile created:', newProfile)
            setProfile(newProfile)
            return
          } catch (createError) {
            console.error('💥 Error creating profile:', createError)
            setProfile(null)
            return
          }
        }
        
        setProfile(null)
        return
      }

      console.log('✅ Profile fetched successfully:', data)
      setProfile(data)
    } catch (error) {
      console.error('💥 Error in fetchProfile:', error)
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
    profileLoading,
    signOut,
    isAuthenticated: !!session,
    hasProfile: !!profile?.first_name
  }
}
