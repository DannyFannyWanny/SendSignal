import { supabase } from './supabase'

/**
 * Get current coordinates using browser geolocation
 * @returns Promise<{lat: number, lng: number} | null>
 */
export async function getCoords(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported')
    return null
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null)
    }, 10000) // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId)
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        clearTimeout(timeoutId)
        console.warn('Geolocation error:', error.message)
        resolve(null)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000 // 30 seconds cache
      }
    )
  })
}

/**
 * Update user presence in Supabase
 * @param isOpen - Whether the user is open to receiving signals
 * @param coords - Optional coordinates, will be fetched if not provided and isOpen is true
 */
export async function updatePresence(isOpen: boolean, coords?: { lat: number; lng: number } | null): Promise<void> {
  try {
    console.log('updatePresence called with:', { isOpen, coords })
    
    let finalCoords = coords

    // If opening and no coords provided, try to get them
    if (isOpen && !finalCoords) {
      console.log('Getting coordinates...')
      finalCoords = await getCoords()
      console.log('Coordinates received:', finalCoords)
    }

    console.log('About to call Supabase RPC with:', {
      _is_open: isOpen,
      _lat: finalCoords?.lat || null,
      _lng: finalCoords?.lng || null
    })

    // Call the Supabase RPC function
    const { data, error } = await supabase.rpc('upsert_presence', {
      _is_open: isOpen,
      _lat: finalCoords?.lat || null,
      _lng: finalCoords?.lng || null
    })

    console.log('Supabase RPC response:', { data, error })

    if (error) {
      console.error('Failed to update presence:', error)
      throw error
    }

    console.log('Presence updated successfully:', { isOpen, lat: finalCoords?.lat, lng: finalCoords?.lng })
  } catch (error) {
    console.error('Error updating presence:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    throw error
  }
}

/**
 * Start a heartbeat to periodically update presence
 * @param isOpen - Whether the user is open to receiving signals
 * @returns Object with stop() function to stop the heartbeat
 */
export function startHeartbeat(isOpen: boolean): { stop: () => void } {
  let intervalId: NodeJS.Timeout | null = null

  const update = () => {
    updatePresence(isOpen).catch(console.error)
  }

  // Initial update
  update()

  // Set up interval (45 seconds)
  intervalId = setInterval(update, 45000)

  return {
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
  }
}
