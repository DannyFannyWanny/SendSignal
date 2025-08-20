'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ProfileFormProps {
  userId: string
  onComplete: () => void
}

export default function ProfileForm({ userId, onComplete }: ProfileFormProps) {
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) return

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstName.trim() })
        .eq('id', userId)

      if (error) {
        setMessage(`Error: ${error.message}`)
        return
      }

      // Profile updated successfully
      onComplete()
    } catch (error) {
      setMessage(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-neutral-200/50" style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      borderRadius: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      padding: '2rem',
      border: '1px solid rgba(229, 229, 229, 0.5)',
      maxWidth: '28rem',
      width: '100%'
    }}>
      <h2 className="text-2xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent mb-6 text-center" style={{
        background: 'linear-gradient(to right, #171717, #525252)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
        Complete Your Profile
      </h2>
      <p className="text-neutral-600 text-center mb-6">
        Please provide your first name to continue
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-transparent transition-all duration-200"
            placeholder="Enter your first name"
            disabled={loading}
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #d4d4d4',
              transition: 'all 0.2s'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !firstName.trim()}
          className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          style={{
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
          }}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {message && (
        <p className="mt-4 text-sm text-center text-neutral-600">
          {message}
        </p>
      )}
    </div>
  )
}
