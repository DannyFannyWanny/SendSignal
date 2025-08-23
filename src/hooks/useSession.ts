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
        console.log('🔐 Getting initial session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('📱 Initial session result:', { hasSession: !!session, userId: session?.user?.id })
        
        setSession(session)
        setUser(session?.user || null)
        
        if (session?.user) {
          console.log('👤 Fetching profile for user:', session.user.id)
          await fetchProfile(session.user.id)
        }
      } catch (error) {
        console.error('❌ Error getting initial session:', error)
      } finally {
        console.log('✅ Setting loading to false')
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', { event, hasSession: !!session, userId: session?.user?.id })
        
        setSession(session)
        setUser(session?.user || null)
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🔐 User signed in, fetching profile...')
          await fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out, clearing profile')
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      console.log('📋 Fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Error fetching profile:', error)
        return
      }

      console.log('✅ Profile fetched successfully:', { firstName: data?.first_name, id: data?.id })
      setProfile(data)
    } catch (error) {
      console.error('💥 Error in fetchProfile:', error)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const returnValue = {
    session,
    user,
    profile,
    loading,
    signOut,
    isAuthenticated: !!session,
    hasProfile: !!profile?.first_name
  }
  
  console.log('🔄 useSession return value:', returnValue)
  
  return returnValue
}
