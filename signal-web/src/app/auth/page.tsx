'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [firstName, setFirstName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        }
      } catch (err) {
        console.error('Error getting initial session:', err)
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Handle redirects in a separate useEffect
  useEffect(() => {
    if (shouldRedirect) {
      router.push('/')
    }
  }, [shouldRedirect, router])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      // If profile exists and has first_name, redirect to home
      if (data && data.first_name) {
        setShouldRedirect(true)
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err)
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Check your email for the magic link!')
      }
    } catch (err) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !firstName.trim()) return

    setProfileLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstName.trim() })
        .eq('id', user.id)

      if (error) {
        setMessage(`Error: ${error.message}`)
        return
      }

      // Profile updated successfully
      setShouldRedirect(true)
    } catch (err) {
      setMessage(`An error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setProfileLoading(false)
    }
  }

  // Don't render anything if we're about to redirect
  if (shouldRedirect) {
    return null
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4">
      <div className="container max-w-md">
        {!user ? (
          // Sign in card
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-6 text-center">
              Sign In
            </h1>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>
            {message && (
              <p className="mt-4 text-sm text-center text-neutral-600">
                {message}
              </p>
            )}
          </div>
        ) : (
          // Profile setup form
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-6 text-center">
              Complete Your Profile
            </h1>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700 mb-2">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your first name"
                />
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
            {message && (
              <p className="mt-4 text-sm text-center text-neutral-600">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
