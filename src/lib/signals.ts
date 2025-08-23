import { supabase } from './supabase'

export interface Signal {
  id: string
  sender_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'ignored' | 'expired'
  message?: string
  created_at: string
  updated_at: string
  expires_at: string
}

export async function sendSignal(recipientId: string, message?: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('📤 Sending signal to:', recipientId, 'with message:', message)
    
    const { data, error } = await supabase.rpc('create_signal', {
      p_recipient_id: recipientId,
      p_message: message || null
    })
    
    if (error) {
      console.error('❌ Error sending signal:', error)
      return { success: false, error: error.message }
    }
    
    console.log('✅ Signal sent successfully:', data)
    return { success: true }
  } catch (error) {
    console.error('💥 Unexpected error sending signal:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}
