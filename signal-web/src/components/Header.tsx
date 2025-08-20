'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface Profile {
  first_name: string | null
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
    }

    checkSession()

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
    router.push('/auth')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200/50" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(229, 229, 229, 0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-white rounded-2xl shadow-sm" style={{
              width: '2rem',
              height: '2rem',
              borderRadius: '1rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}>
              <div className="w-4 h-1 bg-neutral-900 rounded-full" style={{
                width: '1rem',
                height: '0.25rem',
                borderRadius: '9999px',
                backgroundColor: '#171717'
              }}></div>
            </div>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent" style={{
              background: 'linear-gradient(to right, #171717, #525252)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '1.125rem',
              fontWeight: 'bold'
            }}>
              Signal
            </h1>
          </div>

          {/* Auth Status */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user ? (
              <button
                onClick={handleSignOut}
                className="px-2.5 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors duration-200"
                style={{
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s'
                }}
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={() => router.push('/auth')}
                className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors duration-200"
                style={{
                  borderRadius: '0.375rem',
                  transition: 'all 0.2s'
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
