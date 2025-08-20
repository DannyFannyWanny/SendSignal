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
          updated_at
        `)
        .eq('is_open', true)
        .gte('updated_at', twoMinutesAgo)
        .not('user_id', 'eq', user.id)

      console.log('📊 Raw Supabase response:', { data: presenceData, error })

      if (error) {
        console.error('❌ Error fetching nearby users:', error)
        return
      }

      console.log('👥 Found presence records:', presenceData?.length || 0)

      // Filter out records with null coordinates in JavaScript
      const validPresenceData = presenceData?.filter(presence => 
        presence.lat !== null && presence.lng !== null
      ) || []

      console.log('📍 Valid presence records (with coordinates):', validPresenceData.length)

      // Fetch profiles for all users in one query
      const userIds = validPresenceData.map(p => p.user_id)
      let profilesData: { id: string; first_name: string | null }[] = []
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', userIds)
        
        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError)
        } else {
          profilesData = profiles || []
          console.log('👤 Fetched profiles:', profilesData.length)
        }
      }

      // Create a map for quick profile lookup
      const profilesMap = new Map(profilesData.map(p => [p.id, p]))

      // Calculate distances and format data
      const nearby = validPresenceData
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
          const profileData = profilesMap.get(presence.user_id)
          
          return {
            id: presence.user_id,
            first_name: profileData?.first_name || 'Someone',
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

  // No session - show CTA
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4 sm:p-6" style={{
        background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <div className="w-full max-w-sm mx-auto flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-5 border border-neutral-200/50" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '1rem',
            border: '1px solid rgba(229, 229, 229, 0.5)',
            width: '100%'
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
              Welcome to Signal
            </h1>
            
            <p className="text-neutral-600 text-center mb-5 sm:mb-6 text-sm">
              Instantly meet new people nearby.
            </p>
            
            <div className="text-center">
              <button
                onClick={() => router.push('/auth')}
                className="inline-block bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-base"
                style={{
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Session exists but no profile - show profile form
  if (!hasProfile) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 flex items-center justify-center p-4" style={{
        background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <ProfileForm 
          userId={user!.id} 
          onComplete={handleProfileComplete}
        />
      </main>
    )
  }

  // Session exists with profile - show presence UI
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 p-4" style={{
      background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="container max-w-4xl mx-auto pt-6 space-y-4">
        {/* Welcome Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-3" style={{
            background: 'linear-gradient(to right, #171717, #525252)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '0.75rem'
          }}>
            Welcome back, {profile!.first_name}! 👋
          </h1>
          <p className="text-neutral-600 text-sm">
            You&apos;re now signed in and ready to connect with people nearby.
          </p>
        </div>

        {/* Nearby Users Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Nearby Now</h2>
          
          {nearbyUsers.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-neutral-500 text-sm">No nearby users found</p>
              <p className="text-xs text-neutral-400 mt-1">
                Make sure you&apos;re open to receiving signals and have location enabled
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {nearbyUsers.map((nearbyUser) => (
                <div key={nearbyUser.id} className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30 hover:bg-white/80 transition-all duration-200" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(229, 229, 229, 0.3)',
                  padding: '0.75rem',
                  transition: 'all 0.2s'
                }}>
                  <div className="flex items-center space-x-3">
                    {/* Activity indicator dot */}
                    <div className={`w-2 h-2 rounded-full ${nearbyUser.isActive ? 'bg-green-500' : 'bg-neutral-400'}`} style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      backgroundColor: nearbyUser.isActive ? '#10b981' : '#9ca3af'
                    }}></div>
                    
                    <div>
                      <p className="font-medium text-neutral-900 text-sm">
                        {nearbyUser.first_name || 'Someone'}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDistance(nearbyUser.distance)} away • {nearbyUser.freshness}
                      </p>
                    </div>
                  </div>
                  
                  <button className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md" style={{
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s'
                  }}>
                    Send Signal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Presence Control Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Go visible</h2>
          <p className="text-neutral-600 mb-6 text-sm">
            Flip it on when you&apos;re open to meet. Flip it off when you&apos;re done.
          </p>
          
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-neutral-700 mb-1 font-medium text-sm">Status</p>
              <p className="text-xs text-neutral-500">
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
                relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg
                ${isOpen 
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 shadow-neutral-200'
                }
                ${presenceLoading ? 'opacity-50 cursor-not-allowed' : ''}
                ${isOpen ? 'scale-105' : 'scale-100'}
              `}
              style={{
                borderRadius: '0.75rem',
                transition: 'all 0.3s'
              }}
            >
              {presenceLoading ? 'Updating...' : (isOpen ? 'Go Inactive' : 'Go Active')}
              
              {/* Pulsating dot when open */}
              {isOpen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse motion-reduce:animate-none"></span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-700 mb-1 font-medium text-sm">Location</p>
              <p className="text-xs text-neutral-500">
                {myCoords 
                  ? `Lat: ${myCoords.lat.toFixed(4)}, Lng: ${myCoords.lng.toFixed(4)}`
                  : 'Location not available'
                }
              </p>
            </div>
            
            <button
              onClick={handleRefreshLocation}
              disabled={locationLoading}
              className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              style={{
                borderRadius: '0.5rem',
                transition: 'all 0.2s'
              }}
            >
              {locationLoading ? 'Refreshing...' : 'Refresh Location'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
