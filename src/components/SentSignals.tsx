'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Signal } from '@/lib/signals'

// Extended interface for signals with profile data
interface SignalWithProfile extends Signal {
  recipient?: {
    id: string
    first_name: string | null
  }
}

interface SentSignalsProps {
  userId: string
}

export default function SentSignals({ userId }: SentSignalsProps) {
  const [sentSignals, setSentSignals] = useState<SignalWithProfile[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch sent signals
  const fetchSentSignals = useCallback(async () => {
    try {
      // Get all signals sent by this user (exclude expired ones from main view)
      const { data: signalsData, error: signalsError } = await supabase
        .from('signals')
        .select('*')
        .eq('sender_id', userId)
        .neq('status', 'expired') // Don't show expired signals in main view
        .order('created_at', { ascending: false })

      if (signalsError) {
        console.error('Error fetching sent signals:', signalsError)
        return
      }

      // Get recipient profiles separately
      if (signalsData && signalsData.length > 0) {
        const recipientIds = signalsData.map(signal => signal.recipient_id)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name')
          .in('id', recipientIds)

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError)
          return
        }

        // Combine the data
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || [])
        const signalsWithProfiles = signalsData.map(signal => ({
          ...signal,
          recipient: profilesMap.get(signal.recipient_id)
        }))

        setSentSignals(signalsWithProfiles)
      } else {
        setSentSignals([])
      }
    } catch (error) {
      console.error('Error in fetchSentSignals:', error)
    }
  }, [userId])

  // Cancel a pending signal
  const handleCancelSignal = async (signalId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('signals')
        .update({ status: 'ignored' })
        .eq('id', signalId)
        .eq('sender_id', userId)

      if (error) {
        console.error('Error canceling signal:', error)
        alert(`Failed to cancel signal: ${error.message}`)
        return
      }

      console.log('✅ Signal canceled successfully')
      // Refresh the signals list
      fetchSentSignals()
      alert('Signal canceled')
    } catch (error) {
      console.error('Error in handleCancelSignal:', error)
      alert('An error occurred while canceling the signal')
    } finally {
      setLoading(false)
    }
  }

  // Set up real-time subscription for sent signal updates
  useEffect(() => {
    if (!userId) return

    // Fetch initial signals
    fetchSentSignals()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('sent_signals')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'signals',
          filter: `sender_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Sent signal updated:', payload.new)
          // Fetch updated signals list
          fetchSentSignals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchSentSignals])

  // Don't show anything if no signals
  if (sentSignals.length === 0) {
    return null
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'accepted': return 'bg-green-500'
      case 'ignored': return 'bg-red-500'
      case 'expired': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'accepted': return 'Accepted'
      case 'ignored': return 'Ignored'
      case 'expired': return 'Expired'
      default: return status
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl px-6 pt-6 pb-4 border border-neutral-200/50 mb-16" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      border: '1px solid rgba(229, 229, 229, 0.5)'
    }}>
      <h2 className="text-xl font-bold text-neutral-900 mb-5">Sent Signals</h2>
      <div className="space-y-4">
        {sentSignals.map((signal) => (
          <div key={signal.id} className="flex items-center justify-between p-5 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(229, 229, 229, 0.3)',
            padding: '1.25rem'
          }}>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-1">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(signal.status)}`} style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  borderRadius: '50%'
                }}></span>
                <span className="text-base font-medium text-neutral-700">
                  To: <span className="font-semibold">{signal.recipient?.first_name || 'Someone'}</span>
                </span>
              </div>
              <p className="text-sm text-neutral-600">Status: <span className="font-medium">{getStatusText(signal.status)}</span></p>
            </div>
            <div className="flex space-x-2 ml-4">
              {signal.status === 'pending' && (
                <button
                  onClick={() => handleCancelSignal(signal.id)}
                  disabled={loading}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                  style={{
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s',
                    minHeight: '44px'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
