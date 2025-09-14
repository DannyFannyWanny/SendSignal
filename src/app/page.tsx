'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { updatePresence, startHeartbeat, getCoords } from '@/lib/presence'
import { sendSignal } from '@/lib/signals'
import { useSession } from '@/hooks/useSession'
import ProfileForm from '@/components/ProfileForm'
import SignalNotifications from '@/components/SignalNotifications'
import SentSignals from '@/components/SentSignals'
import NearbyUsersSkeleton from '@/components/NearbyUsersSkeleton'
import SignalsSkeleton from '@/components/SignalsSkeleton'
import { getDistance } from 'geolib'
import { formatDistanceToNow } from 'date-fns'
import { formatAge, calculateAge } from '@/lib/utils'
import ProfilePicture from '@/components/ProfilePicture'

// Constants
const NEARBY_RADIUS_METERS = 45.72 // 150 feet in meters
const NEARBY_RADIUS_FEET = 150 // 150 feet for display

interface NearbyUser {
  id: string
  first_name: string | null
  dateOfBirth: string | null
  profilePictureUrl: string | null
  distance: number
  freshness: string
  coords: { lat: number; lng: number }
  isActive: boolean
}

export default function Home() {
  const { user, profile, loading, profileLoading, isAuthenticated, hasProfile } = useSession()
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
      // Also expire old signals when user loads the page
      expireOldSignals()
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
      let profilesData: { id: string; first_name: string | null; date_of_birth: string | null; profile_picture_url: string | null }[] = []
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, date_of_birth, profile_picture_url')
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
            dateOfBirth: profileData?.date_of_birth || null,
            profilePictureUrl: profileData?.profile_picture_url || null,
            distance: dist,
            freshness: formatDistanceToNow(updatedAt, { addSuffix: true }),
            coords,
            isActive
          }
        })
        .filter(user => user.distance <= NEARBY_RADIUS_METERS) // Filter users within 150 feet
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

  const handleSendSignal = async (recipientId: string) => {
    console.log('🎯 Send Signal clicked for user:', recipientId)
    
    try {
      const result = await sendSignal(recipientId)
      
      if (result.success) {
        console.log('✅ Signal sent successfully!')
        // TODO: Show success message to user
        alert('Signal sent! Waiting for response...')
      } else {
        console.error('❌ Failed to send signal:', result.error)
        alert(`Failed to send signal: ${result.error}`)
      }
    } catch (error) {
      console.error('💥 Error in handleSendSignal:', error)
      alert('An error occurred while sending the signal')
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

  // Function to expire old signals
  const expireOldSignals = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase.rpc('expire_old_signals')
      if (error) {
        console.error('Error expiring old signals:', error)
      } else if (data && data > 0) {
        console.log(`✅ Expired ${data} old signals`)
      }
    } catch (error) {
      console.error('Error in expireOldSignals:', error)
    }
  }



  // Loading state - show skeleton UI immediately, don't wait for profile
  if (loading && !user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 p-4" style={{
        background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
        minHeight: '100vh',
        padding: '1rem'
      }}>
        <div className="container max-w-4xl mx-auto pt-6 space-y-6">
          {/* Welcome Header Skeleton */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '1.5rem',
            border: '1px solid rgba(229, 229, 229, 0.5)'
          }}>
            <div className="w-48 h-8 bg-neutral-200 rounded animate-pulse mb-3"></div>
            <div className="w-64 h-4 bg-neutral-100 rounded animate-pulse"></div>
          </div>

          {/* Signals Skeleton */}
          <SignalsSkeleton />

          {/* Nearby Users Skeleton */}
          <NearbyUsersSkeleton />

          {/* Presence Control Skeleton */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '1.5rem',
            border: '1px solid rgba(229, 229, 229, 0.5)'
          }}>
            <div className="w-32 h-6 bg-neutral-200 rounded animate-pulse mb-2"></div>
            <div className="w-64 h-4 bg-neutral-100 rounded animate-pulse mb-6"></div>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse mb-1"></div>
                <div className="w-40 h-3 bg-neutral-100 rounded animate-pulse mb-1"></div>
                <div className="w-36 h-3 bg-neutral-100 rounded animate-pulse"></div>
              </div>
              <div className="w-32 h-12 bg-neutral-200 rounded-xl animate-pulse"></div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse mb-1"></div>
                <div className="w-48 h-3 bg-neutral-100 rounded animate-pulse"></div>
              </div>
              <div className="w-32 h-10 bg-neutral-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
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
            
            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={() => router.push('/auth')}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-base"
                style={{
                  borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
              >
                Sign In
              </button>
              
              <div className="text-center">
                <p className="text-sm text-neutral-500 mb-3">
                  Don&apos;t have an account?
                </p>
                <button
                  onClick={() => router.push('/auth?mode=signup')}
                  className="w-full bg-white hover:bg-neutral-50 text-neutral-800 font-medium py-3 px-6 rounded-lg transition-all duration-200 border border-neutral-300 hover:border-neutral-400 shadow-sm hover:shadow-md"
                  style={{
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Session exists but no profile - show profile form or skeleton while loading
  if (!hasProfile) {
    // If we're still loading profile, show skeleton UI instead of blocking
    if (profileLoading) {
      return (
        <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 p-4" style={{
          background: 'linear-gradient(to bottom right, #fafafa, #ffffff, #f5f5f5)',
          minHeight: '100vh',
          padding: '1rem'
        }}>
          <div className="container max-w-4xl mx-auto pt-6 space-y-6">
            {/* Welcome Header Skeleton */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '1.5rem',
              border: '1px solid rgba(229, 229, 229, 0.5)'
            }}>
              <div className="w-48 h-8 bg-neutral-200 rounded animate-pulse mb-3"></div>
              <div className="w-64 h-4 bg-neutral-100 rounded animate-pulse"></div>
            </div>

            {/* Signals Skeleton */}
            <SignalsSkeleton />

            {/* Nearby Users Skeleton */}
            <NearbyUsersSkeleton />

            {/* Presence Control Skeleton */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(8px)',
              borderRadius: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '1.5rem',
              border: '1px solid rgba(229, 229, 229, 0.5)'
            }}>
              <div className="w-32 h-6 bg-neutral-200 rounded animate-pulse mb-2"></div>
              <div className="w-64 h-4 bg-neutral-100 rounded animate-pulse mb-6"></div>
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse mb-1"></div>
                  <div className="w-40 h-3 bg-neutral-100 rounded animate-pulse mb-1"></div>
                  <div className="w-36 h-3 bg-neutral-100 rounded animate-pulse"></div>
                </div>
                <div className="w-32 h-12 bg-neutral-200 rounded-xl animate-pulse"></div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-20 h-4 bg-neutral-200 rounded animate-pulse mb-1"></div>
                  <div className="w-48 h-3 bg-neutral-100 rounded animate-pulse"></div>
                </div>
                <div className="w-32 h-10 bg-neutral-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
          </div>
        </main>
      )
    }
    
    // Profile form for users without profiles
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
      <div className="container max-w-4xl mx-auto pt-8 space-y-16">
        {/* Welcome Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '1.5rem',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <ProfilePicture
                userId={profile!.id}
                firstName={profile!.first_name}
                dateOfBirth={profile!.date_of_birth}
                profilePictureUrl={profile!.profile_picture_url}
                size="lg"
                className="mx-auto"
              />
            </div>
            
            <h1 className="text-2xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-4" style={{
              background: 'linear-gradient(to right, #171717, #525252)',
              backgroundClip: 'text',
              fontSize: '1.75rem',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              Welcome back, {profile!.first_name}
            </h1>
            <p className="text-neutral-600 text-base mb-2">
              Ensure your status is visible and refresh location to send and receive signals.
            </p>
          </div>
        </div>

        {/* Nearby Users Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl px-6 pt-6 pb-4 border border-neutral-200/50 mb-16" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">Nearby Now</h2>
          
          {nearbyUsers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-base mb-2">No nearby users found</p>
              <p className="text-sm text-neutral-400">
                Only users within {NEARBY_RADIUS_FEET} feet will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {nearbyUsers.map((nearbyUser) => (
                <div key={nearbyUser.id} className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30 hover:bg-white/80 transition-all duration-200" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '0.75rem',
                  border: '1px solid rgba(229, 229, 229, 0.3)',
                  padding: '0.75rem',
                  transition: 'all 0.2s'
                }}>
                  <div className="flex items-center space-x-4">
                    
                    <ProfilePicture
                      userId={nearbyUser.id}
                      firstName={nearbyUser.first_name}
                      dateOfBirth={nearbyUser.dateOfBirth}
                      profilePictureUrl={nearbyUser.profilePictureUrl}
                      size="md"
                      className="flex-shrink-0"
                    />
                    
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-neutral-900 text-sm">
                        {nearbyUser.first_name || 'Someone'}, {calculateAge(nearbyUser.dateOfBirth) ?? ''}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleSendSignal(nearbyUser.id)}
                    className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                    style={{
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s',
                      minHeight: '40px'
                    }}
                  >
                    Send Signal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signal Notifications */}
        <SignalNotifications userId={user!.id} />

        {/* Sent Signals */}
        <SentSignals userId={user!.id} />

        {/* Presence Control Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-4 pt-4 pb-4 border border-neutral-200/50" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(229, 229, 229, 0.5)'
        }}>
          <h2 className="text-xl font-bold text-neutral-900 mb-5">Visibility</h2>
          <p className="text-neutral-600 mb-5 text-base">
            Control who can see you and send signals.
          </p>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-neutral-900 mb-2 font-bold text-base">Status</p>
              <p className="text-sm text-neutral-500 mb-1">
                {isOpen ? 'Visible to nearby users' : 'Hidden from nearby users'}
              </p>
              
            </div>
            
            <button
              onClick={() => handleToggleOpen(!isOpen)}
              disabled={presenceLoading}
              className={`
                relative px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg
                ${isOpen 
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-800 shadow-neutral-200'
                }
                ${presenceLoading ? 'opacity-50 cursor-not-allowed' : ''}
                ${isOpen ? 'scale-105' : 'scale-100'}
              `}
              style={{
                borderRadius: '0.75rem',
                transition: 'all 0.3s',
                minHeight: '56px',
                fontSize: '1rem'
              }}
            >
              {presenceLoading ? 'Updating...' : (isOpen ? 'Go Inactive' : 'Go Active')}
              
              {/* Pulsating dot when open */}
              {isOpen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse motion-reduce:animate-none"></span>
              )}
            </button>
          </div>

          <div className="border-t border-neutral-200 my-4"></div>

          <div className="flex items-center justify-between mt-1">
            <div>
              <p className="text-neutral-900 mb-2 font-bold text-base">Location</p>
              <p className="text-sm text-neutral-500">
                {myCoords 
                  ? 'GPS active'
                  : 'Location not available'
                }
              </p>
            </div>
            
            <button
              onClick={handleRefreshLocation}
              disabled={locationLoading}
              className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              style={{
                borderRadius: '0.5rem',
                transition: 'all 0.2s',
                minHeight: '44px'
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
