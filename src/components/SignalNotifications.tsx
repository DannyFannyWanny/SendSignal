'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Signal } from '@/lib/signals'

interface SignalNotificationsProps {
  userId: string
}

export default function SignalNotifications({ userId }: SignalNotificationsProps) {
  const [incomingSignals, setIncomingSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch incoming signals
  const fetchIncomingSignals = async () => {
    try {
      // First get the signals (exclude expired ones)
      const { data: signalsData, error: signalsError } = await supabase
        .from('signals')
        .select('*')
        .eq('recipient_id', userId)
        .eq('status', 'pending')
        .gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Only signals from last 5 minutes
        .order('created_at', { ascending: false })

      if (signalsError) {
        console.error('Error fetching signals:', signalsError)
        return
      }

      // Then get the sender profiles separately
      if (signalsData && signalsData.length > 0) {
        const senderIds = signalsData.map(signal => signal.sender_id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', senderIds)

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError)
          return
        }

        // Combine the data
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])
        const signalsWithProfiles = signalsData.map(signal => ({
          ...signal,
          sender: profilesMap.get(signal.sender_id)
        }))

        setIncomingSignals(signalsWithProfiles)
      } else {
        setIncomingSignals([])
      }
    } catch (error) {
      console.error('Error in fetchIncomingSignals:', error)
    }
  }

  // Handle signal response (accept/ignore)
  const handleSignalResponse = async (signalId: string, response: 'accepted' | 'ignored') => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('respond_to_signal', {
        p_signal_id: signalId,
        p_response: response
      })

      if (error) {
        console.error('Error responding to signal:', error)
        alert(`Failed to respond: ${error.message}`)
        return
      }

      if (data) {
        console.log(`✅ Signal ${response} successfully`)
        // Remove the signal from the list since it's no longer pending
        setIncomingSignals(prev => prev.filter(signal => signal.id !== signalId))
        
        // Show success message
        if (response === 'accepted') {
          alert('Signal accepted! You can now connect with this person.')
        } else {
          alert('Signal ignored.')
        }
      }
    } catch (error) {
      console.error('Error in handleSignalResponse:', error)
      alert('An error occurred while responding to the signal')
    } finally {
      setLoading(false)
    }
  }

  // Set up real-time subscription for new signals
  useEffect(() => {
    if (!userId) return

    // Fetch initial signals
    fetchIncomingSignals()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('incoming_signals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 New signal received:', payload.new)
          // Fetch updated signals list
          fetchIncomingSignals()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'signals',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Signal updated:', payload.new)
          // Fetch updated signals list
          fetchIncomingSignals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Always show the component for debugging
  // if (incomingSignals.length === 0) {
  //   return null // Don't show anything if no signals
  // }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50 mb-4" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '1.5rem',
      border: '1px solid rgba(229, 229, 229, 0.5)'
    }}>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">📨 Incoming Signals</h2>
      <p className="text-sm text-neutral-600 mb-3">Debug: {incomingSignals.length} signals, User ID: {userId}</p>
      
      <div className="space-y-3">
        {incomingSignals.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-neutral-500 text-sm">No incoming signals yet</p>
            <p className="text-xs text-neutral-400 mt-1">When someone sends you a signal, it will appear here</p>
          </div>
        ) : (
          incomingSignals.map((signal) => (
          <div key={signal.id} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(229, 229, 229, 0.3)',
            padding: '1rem'
          }}>
            <div className="flex-1">
              <p className="font-medium text-neutral-900 text-sm">
                Signal from <span className="font-semibold">{signal.sender?.first_name || 'Someone'}</span>
              </p>
              {signal.message && (
                <p className="text-xs text-neutral-600 mt-1">"{signal.message}"</p>
              )}
              <p className="text-xs text-neutral-500 mt-1">
                Sent {new Date(signal.created_at).toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex space-x-2 ml-4">
              <button
                onClick={() => handleSignalResponse(signal.id, 'accepted')}
                disabled={loading}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                style={{
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                Accept
              </button>
              
              <button
                onClick={() => handleSignalResponse(signal.id, 'ignored')}
                disabled={loading}
                className="px-3 py-1.5 bg-neutral-500 hover:bg-neutral-600 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                style={{
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                Ignore
              </button>
            </div>
          </div>
        ))
        )}
      </div>
    </div>
  )
}
