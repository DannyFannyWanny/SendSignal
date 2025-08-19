'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface Profile {
  first_name: string | null
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setLoading(false)
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single()
    
    setProfile(data)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <header className="bg-white border-b border-neutral-200 px-4 py-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-primary-600">
            Signal
          </Link>
          <div className="w-20 h-6 bg-neutral-200 rounded animate-pulse"></div>
        </div>
      </header>
    )
  }

  return (
    <header className="bg-white border-b border-neutral-200 px-4 py-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-primary-600">
          Signal
        </Link>
        
        <div className="flex items-center gap-4">
          {user && profile?.first_name ? (
            <>
              <span className="text-neutral-700 font-medium">
                {profile.first_name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-neutral-600 hover:text-neutral-800 text-sm font-medium transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
