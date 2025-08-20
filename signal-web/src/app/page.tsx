'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePresence, startHeartbeat, getCoords } from '@/lib/presence'
import { useSession } from '@/hooks/useSession'
import ProfileForm from '@/components/ProfileForm'
import { getDistance } from 'geolib'
import { formatDistanceToNow } from 'date-fns'

interface NearbyUser {
  id: string
  first_name: string | null
  distance: number
  freshness: string
  coords: { lat: number; lng: number }
  isActive: boolean
}

export default function Home() {
  const { user, profile, loading, isAuthenticated, hasProfile } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([])
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [presenceLoading, setPresenceLoading] = useState(false)
  const [profileCompleted, setProfileCompleted] = useState(false)
  const router = useRouter()
  const heartbeatRef = useRef<{ stop: () => void } | null>(null)
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch initial presence when user and profile are available
  useEffect(() => {
    if (user && hasProfile && !profileCompleted) {
      fetchInitialPresence(user.id)
      setProfileCompleted(true)
    }
  }, [user, hasProfile, profileCompleted])

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clean up all refs when component unmounts
      if (heartbeatRef.current) {
        heartbeatRef.current.stop()
        heartbeatRef.current = null
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
    }
  }, [])

  const fetchNearbyUsers = useCallback(async () => {
    if (!user || !myCoords) return

    try {
      console.log('🔍 fetchNearbyUsers called with:', { userId: user.id, myCoords })
      
      // Get all open users within last 2 minutes
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      console.log('⏰ Looking for users active since:', twoMinutesAgo)
      
      const { data: presenceData, error } = await supabase
        .from('presence')
        .select(`
          user_id,
          is_open,
          lat,
          lng,
          updated_at,
          profiles!inner(first_name)
        `)
        .eq('is_open', true)
        .gte('updated_at', twoMinutesAgo)
        .not('user_id', 'eq', user.id)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      console.log('📊 Raw Supabase response:', { data: presenceData, error })

      if (error) {
        console.error('❌ Error fetching nearby users:', error)
        return
      }

      console.log('👥 Found presence records:', presenceData?.length || 0)

      // Calculate distances and format data
      const nearby = presenceData
        .map(presence => {
          const coords = { lat: presence.lat!, lng: presence.lng! }
          const dist = getDistance(myCoords, coords)
          const updatedAt = new Date(presence.updated_at)
          const isActive = Date.now() - updatedAt.getTime() < 2 * 60 * 1000 // Within 2 minutes
          
          console.log('📍 Processing user:', {
            userId: presence.user_id,
            coords,
            distance: dist,
            isActive,
            updatedAt: presence.updated_at
          })
          
          // Handle the profiles join data structure
          const profileData = Array.isArray(presence.profiles) ? presence.profiles[0] : presence.profiles
          
          return {
            id: presence.user_id,
            first_name: profileData?.first_name || null,
            distance: dist,
            freshness: formatDistanceToNow(updatedAt, { addSuffix: true }),
            coords,
            isActive
          }
        })
        .sort((a, b) => a.distance - b.distance)

      console.log('✅ Final nearby users list:', nearby)
      setNearbyUsers(nearby)
    } catch (error) {
      console.error('💥 Error processing nearby users:', error)
    }
  }, [user, myCoords])

  // Debounced function to prevent excessive API calls
  const debouncedFetchNearbyUsers = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchNearbyUsers()
    }, 1000) // Wait 1 second before fetching
  }, [fetchNearbyUsers])

  // Set up realtime subscription for presence changes
  useEffect(() => {
    if (!user || !hasProfile) return

    console.log('🔌 Setting up real-time subscription for user:', user.id)

    // Clean up any existing subscription
    if (subscriptionRef.current) {
      console.log('🧹 Cleaning up existing subscription')
      supabase.removeChannel(subscriptionRef.current)
    }

    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presence'
        },
        (payload) => {
          console.log('📡 Real-time presence change detected:', payload)
          // Use debounced function to prevent excessive calls
          debouncedFetchNearbyUsers()
        }
      )
      .subscribe()

    subscriptionRef.current = channel

    console.log('✅ Real-time subscription established')

    return () => {
      console.log('🔌 Cleaning up real-time subscription')
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
        fetchTimeoutRef.current = null
      }
    }
  }, [user, hasProfile, debouncedFetchNearbyUsers])

  const fetchInitialPresence = async (userId: string) => {
    const { data } = await supabase
      .from('presence')
      .select('is_open, lat, lng')
      .eq('user_id', userId)
      .single()
    
    if (data) {
      setIsOpen(data.is_open)
      if (data.lat && data.lng) {
        setMyCoords({ lat: data.lat, lng: data.lng })
      }
    }
  }

  const handleToggleOpen = async (newState: boolean) => {
    if (!user) return

    setPresenceLoading(true)
    
    // Add a safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      setPresenceLoading(false)
      console.error('Toggle operation timed out')
    }, 10000) // 10 second timeout

    try {
      await updatePresence(newState, myCoords)
      clearTimeout(safetyTimeout)
      setIsOpen(newState)

      if (newState) {
        // Start heartbeat
        if (heartbeatRef.current) {
          heartbeatRef.current.stop()
        }
        heartbeatRef.current = startHeartbeat(true)
      } else {
        // Stop heartbeat
        if (heartbeatRef.current) {
          heartbeatRef.current.stop()
          heartbeatRef.current = null
        }
      }
    } catch (error) {
      clearTimeout(safetyTimeout)
      console.error('Failed to update presence:', error)
      // Revert the toggle if it failed
      setIsOpen(!newState)
    } finally {
      setPresenceLoading(false)
    }
  }

  const handleRefreshLocation = async () => {
    setLocationLoading(true)
    try {
      const coords = await getCoords()
      if (coords) {
        setMyCoords(coords)
        if (isOpen) {
          await updatePresence(true, coords)
        }
      }
    } catch (error) {
      console.error('Failed to refresh location:', error)
    } finally {
      setLocationLoading(false)
    }
  }

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  const handleProfileComplete = () => {
    // This will trigger the useEffect to fetch presence and show the main UI
    setProfileCompleted(true)
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-neutral-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading...</p>
        </div>
      </main>
    )
  }

  // No session - show sign in CTA
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-neutral-200/50">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-6">
            Welcome to Signal
          </h1>
          <p className="text-neutral-600 mb-8">
            Sign in to go online and connect with people nearby
          </p>
          <button
            onClick={() => router.push('/auth')}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Sign In
          </button>
        </div>
      </main>
    )
  }

  // Session exists but no profile - show profile form
  if (!hasProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4">
        <ProfileForm 
          userId={user!.id} 
          onComplete={handleProfileComplete}
        />
      </main>
    )
  }

  // Session exists with profile - show presence UI
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 p-4">
      <div className="container max-w-4xl mx-auto pt-8 space-y-6">
        {/* Welcome Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-4">
            Welcome back, {profile!.first_name}! 👋
          </h1>
          <p className="text-neutral-600">
            You&apos;re now signed in and ready to connect with people nearby.
          </p>
        </div>

        {/* Presence Control Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Go visible</h2>
          <p className="text-neutral-600 mb-8">
            Flip it on when you&apos;re open to meet. Flip it off when you&apos;re done.
          </p>
          
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-neutral-700 mb-2 font-medium">Status</p>
              <p className="text-sm text-neutral-500">
                {isOpen ? 'You are currently visible to nearby users' : 'You are currently hidden from nearby users'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {isOpen ? 'Click "Go Inactive" to hide yourself' : 'Click "Go Active" to become visible'}
              </p>
            </div>
            
            <button
              onClick={() => handleToggleOpen(!isOpen)}
              disabled={presenceLoading}
              className={`
                relative px-8 py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl
                ${isOpen 
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200' 
                  : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 shadow-neutral-200'
                }
                ${presenceLoading ? 'opacity-50 cursor-not-allowed' : ''}
                ${isOpen ? 'scale-105' : 'scale-100'}
              `}
            >
              {presenceLoading ? 'Updating...' : (isOpen ? 'Go Inactive' : 'Go Active')}
              
              {/* Pulsating dot when open */}
              {isOpen && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse motion-reduce:animate-none"></span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-700 mb-2 font-medium">Location</p>
              <p className="text-sm text-neutral-500">
                {myCoords 
                  ? `Lat: ${myCoords.lat.toFixed(4)}, Lng: ${myCoords.lng.toFixed(4)}`
                  : 'Location not available'
                }
              </p>
            </div>
            
            <button
              onClick={handleRefreshLocation}
              disabled={locationLoading}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {locationLoading ? 'Refreshing...' : 'Refresh Location'}
            </button>
          </div>
        </div>

        {/* Nearby Users Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Nearby Now</h2>
          
          {nearbyUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500">No nearby users found</p>
              <p className="text-sm text-neutral-400 mt-2">
                Make sure you&apos;re open to receiving signals and have location enabled
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyUsers.map((nearbyUser) => (
                <div key={nearbyUser.id} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-neutral-200/30 hover:bg-white/80 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    {/* Activity indicator dot */}
                    <div className={`w-2.5 h-2.5 rounded-full ${nearbyUser.isActive ? 'bg-green-500' : 'bg-neutral-400'}`}></div>
                    
                    <div>
                      <p className="font-medium text-neutral-900">
                        {nearbyUser.first_name || 'Someone'}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {formatDistance(nearbyUser.distance)} away • {nearbyUser.freshness}
                      </p>
                    </div>
                  </div>
                  
                  <button className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg">
                    Send Signal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
