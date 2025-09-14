'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { getMinimumDateOfBirth } from '@/lib/utils'
import { uploadProfileImage } from '@/lib/imageUtils'
import ImageUpload from '@/components/ImageUpload'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [firstName, setFirstName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [profileStatus, setProfileStatus] = useState<'unknown' | 'needs_setup' | 'complete'>('unknown')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check URL parameters for signup mode
    const mode = searchParams.get('mode')
    if (mode === 'signup') {
      setIsSignUp(true)
    }

    // Check for existing session and profile on mount
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)
        if (currentUser) {
          await fetchProfile(currentUser.id)
        }
      } catch {
        console.error('Error getting initial session')
      }
    }

    getInitialSession()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authedUser = session?.user || null
        setUser(authedUser)
        if (authedUser) {
          await fetchProfile(authedUser.id)
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
        // PGRST116 means no profile row yet – that's OK, show profile form
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error)
        }
        setProfileStatus('needs_setup')
        return
      }

      // If profile exists and has first_name, redirect to home
      if (data && data.first_name) {
        setProfileStatus('complete')
        setShouldRedirect(true)
      } else {
        setProfileStatus('needs_setup')
      }
    } catch {
      console.error('Error in fetchProfile')
      // Fall back to safe default: require setup
      setProfileStatus('needs_setup')
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
        // Successfully signed in – check if profile is complete
        const uid = result.data.user?.id
        if (uid) {
          await fetchProfile(uid)
        }
        setMessage('Successfully signed in!')
      }
    } catch {
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
      let profilePictureUrl = null
      
      // Upload profile picture if selected
      if (selectedImage && selectedImage.size > 0) {
        try {
          profilePictureUrl = await uploadProfileImage(selectedImage, user.id, supabase)
        } catch (error) {
          console.error('Failed to upload profile picture:', error)
          // Continue without profile picture
        }
      }
      
      // Use upsert to create or update the profile
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id, 
          first_name: firstName.trim(),
          date_of_birth: dateOfBirth,
          profile_picture_url: profilePictureUrl,
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
            
          </>
        ) : profileStatus === 'needs_setup' ? (
          // Profile setup form (only for new users or incomplete profiles)
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
              
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-neutral-700 mb-2">
                  Date of Birth
                </label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                  max={getMinimumDateOfBirth()}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200 text-base"
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d4d4d4',
                    transition: 'all 0.2s'
                  }}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  You must be 18 or older to use this app
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Profile Picture
                </label>
                <ImageUpload
                  onImageSelect={setSelectedImage}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  Upload a clear photo of yourself (will be resized to 400x400px)
                </p>
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
        ) : null}
      </div>
    </main>
  )
}
