'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface Profile {
  first_name: string | null
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        // Redirect to auth if not authenticated
        router.push('/auth')
        return
      }
      setLoading(false)
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
          router.push('/auth')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single()
    
    setProfile(data)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </main>
    )
  }

  if (!user || !profile?.first_name) {
    return null // Will redirect to auth
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4">
      <div className="container max-w-4xl mx-auto pt-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-4">
            Welcome back, {profile.first_name}! 👋
          </h1>
          <p className="text-neutral-600 mb-8">
            You're now signed in and ready to connect with people nearby.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Your Profile
              </h3>
              <p className="text-neutral-600 text-sm">
                Manage your profile and preferences
              </p>
            </div>
            <div className="bg-neutral-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Nearby People
              </h3>
              <p className="text-neutral-600 text-sm">
                Discover and connect with people around you
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
