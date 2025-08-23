'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Signal } from '@/lib/signals'

interface SentSignalsProps {
  userId: string
}

export default function SentSignals({ userId }: SentSignalsProps) {
  const [sentSignals, setSentSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch sent signals
  const fetchSentSignals = async () => {
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
  }

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
  }, [userId])

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
      case 'accepted': return 'Accepted! 🎉'
      case 'ignored': return 'Ignored'
      case 'expired': return 'Expired'
      default: return status
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50 mb-4" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '1.5rem',
      border: '1px solid rgba(229, 229, 229, 0.5)'
    }}>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">📤 Sent Signals</h2>
      
      <div className="space-y-3">
        {sentSignals.map((signal) => (
          <div key={signal.id} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(229, 229, 229, 0.3)',
            padding: '1rem'
          }}>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(signal.status)}`} style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%'
                }}></span>
                <span className="text-sm font-medium text-neutral-700">
                  To: <span className="font-semibold">{signal.recipient?.first_name || 'Someone'}</span>
                </span>
              </div>
              
                                   {signal.message && (
                       <p className="text-xs text-neutral-600 mb-1">&ldquo;{signal.message}&rdquo;</p>
                     )}
              
              <div className="flex items-center space-x-4 text-xs text-neutral-500">
                <span>Status: <span className="font-medium">{getStatusText(signal.status)}</span></span>
                <span>Sent: {new Date(signal.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
            
            <div className="flex space-x-2 ml-4">
              {signal.status === 'pending' && (
                <button
                  onClick={() => handleCancelSignal(signal.id)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                  style={{
                    borderRadius: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
              )}
              
              {signal.status === 'accepted' && (
                <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                  Connected! 🎉
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
