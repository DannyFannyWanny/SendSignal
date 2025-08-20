'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [firstName, setFirstName] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
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
      } catch {
        console.error('Error getting initial session')
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
  }, []) // fetchProfile is stable, no need to add to deps

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
        if (error.code === 'PGRST116') { // No rows returned
          // Profile doesn't exist, create one
          await createProfileIfNotExists(userId)
          return
        }
        console.error('Error fetching profile:', error)
        return
      }

      // If profile exists and has first_name, redirect to home
      if (data && data.first_name) {
        setShouldRedirect(true)
      }
    } catch {
      console.error('Error in fetchProfile')
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      let result
      
      if (isSignUp) {
        // Sign up
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        })
      } else {
        // Sign in
        result = await supabase.auth.signInWithPassword({
          email,
          password
        })
      }

      if (result.error) {
        setMessage(result.error.message)
      } else if (isSignUp && result.data.user && !result.data.session) {
        // Email confirmation required for sign up
        setMessage('Please check your email to confirm your account, then sign in.')
        setIsSignUp(false)
      } else if (result.data.session) {
        // Successfully signed in - create profile if it doesn't exist
        if (isSignUp && result.data.user) {
          await createProfileIfNotExists(result.data.user.id)
        }
        setMessage('Successfully signed in!')
      }
    } catch (err) {
      setMessage('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const createProfileIfNotExists = async (userId: string) => {
    try {
      // Try to insert a new profile, ignore if it already exists
      const { error } = await supabase
        .from('profiles')
        .insert({ 
          id: userId, 
          first_name: null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error && error.code !== '23505') { // 23505 is unique constraint violation
        console.error('Error creating profile:', error)
      }
    } catch (err) {
      console.error('Error in createProfileIfNotExists:', err)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !firstName.trim()) return

    setProfileLoading(true)
    try {
      // Use upsert to create or update the profile
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          first_name: firstName.trim(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })

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
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4 sm:p-6" style={{
      background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="w-full max-w-xs flex flex-col items-center justify-center">
        {!user ? (
          <>
            {/* Sign in/up card */}
            <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-5 border border-neutral-200/50" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '1rem',
              border: '1px solid rgba(229, 229, 229, 0.5)'
            }}>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-3 sm:mb-4 text-center" style={{
                background: 'linear-gradient(to right, #171717, #525252)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '1.125rem',
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                textAlign: 'center'
              }}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </h1>
              
              <form onSubmit={handleAuth} className="space-y-6 sm:space-y-7">
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
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200 text-base"
                    placeholder="Enter your email"
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #d4d4d4',
                      transition: 'all 0.2s'
                    }}
                  />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200 text-base"
                    placeholder="Enter your password"
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #d4d4d4',
                      transition: 'all 0.2s'
                    }}
                  />
                </div>
                
                <div className="text-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-block bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-base"
                    style={{
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                  </button>
                </div>
              </form>
              
              {message && (
                <p className="mt-3 text-sm text-center text-neutral-600">
                  {message}
                </p>
              )}
            </div>
            
            {/* Create Account Card - Only show on sign-in screen */}
            {!isSignUp && (
              <div className="w-full mt-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-neutral-200/30" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(8px)',
                borderRadius: '1rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                padding: '1rem',
                border: '1px solid rgba(229, 229, 229, 0.3)',
                marginTop: '1.5rem'
              }}>
                <div className="text-center">
                  <p className="text-sm text-neutral-600 mb-3">
                    Don't have an account?
                  </p>
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="inline-block bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium py-2 px-4 rounded-lg transition-all duration-200 border border-neutral-300 hover:border-neutral-400"
                    style={{
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Create Account
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // Profile setup form
          <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-5 border border-neutral-200/50" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '1rem',
            border: '1px solid rgba(229, 229, 229, 0.5)'
          }}>
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-3 sm:mb-4 text-center" style={{
              background: 'linear-gradient(to right, #171717, #525252)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              marginBottom: '0.75rem',
              textAlign: 'center'
            }}>
              Complete Your Profile
            </h1>
            <form onSubmit={handleProfileSubmit} className="space-y-6 sm:space-y-7">
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
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200 text-base"
                  placeholder="Enter your first name"
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d4d4d4',
                    transition: 'all 0.2s'
                  }}
                />
              </div>
              <div className="text-center">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="inline-block bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-base"
                  style={{
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {profileLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
            {message && (
              <p className="mt-3 text-sm text-center text-neutral-600">
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
