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
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await checkProfile(session.user.id)
      }
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          await checkProfile(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setShowProfileForm(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const checkProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single()

    if (!profile) {
      // Create profile if missing
      await supabase
        .from('profiles')
        .insert({ id: userId })
    } else if (!profile.first_name) {
      // Show profile form if first_name is null
      setShowProfileForm(true)
    } else {
      // Profile complete, redirect to home
      router.push('/')
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
    } catch (error) {
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
        setMessage(error.message)
      } else {
        setShowProfileForm(false)
        router.push('/')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setProfileLoading(false)
    }
  }

  if (user && !showProfileForm) {
    // User is authenticated and profile is complete, redirect
    router.push('/')
    return null
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="container max-w-md">
        {!user ? (
          // Sign in card
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-6 text-center">
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
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
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
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h1 className="text-3xl font-bold text-neutral-900 mb-6 text-center">
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
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter your first name"
                />
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
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
