// Profile Picture component with fallback avatars

import { useState } from 'react'
import Image from 'next/image'
import { formatAge } from '@/lib/utils'

interface ProfilePictureProps {
  userId: string
  firstName: string | null
  dateOfBirth: string | null
  profilePictureUrl: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showAge?: boolean
  className?: string
}

// Color palette for fallback avatars
const avatarColors = [
  'bg-blue-500',
  'bg-green-500', 
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-teal-500'
]

export default function ProfilePicture({
  userId,
  firstName,
  dateOfBirth,
  profilePictureUrl,
  size = 'md',
  showAge = false,
  className = ''
}: ProfilePictureProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  
  // Generate consistent color based on user ID
  const colorIndex = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length
  const avatarColor = avatarColors[colorIndex]
  
  // Get initials from first name
  const initials = firstName ? firstName.charAt(0).toUpperCase() : '?'
  
  // Explicit pixel sizes to avoid Tailwind pruning/dynamic class issues
  const sizePxMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
    xs: 32,   // 2rem
    sm: 40,   // 2.5rem
    md: 56,   // 3.5rem
    lg: 72,   // 4.5rem
    xl: 96,   // 6rem
  }
  const dimension = sizePxMap[size]
  
  // Show profile picture if available and no error
  if (profilePictureUrl && !imageError) {
    return (
      <div
        className={`relative overflow-hidden rounded-full ${className}`}
        style={{ width: dimension, height: dimension, flex: 'none' }}
      >
        <Image
          src={profilePictureUrl}
          alt={`${firstName || 'User'}'s profile picture`}
          width={dimension}
          height={dimension}
          className={`w-full h-full rounded-full object-cover border-2 border-white shadow-sm ${
            imageLoading ? 'animate-pulse bg-gray-200' : ''
          }`}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageError(true)
            setImageLoading(false)
          }}
        />
        
        {showAge && dateOfBirth && (
          <div className="absolute -bottom-2 -right-2 bg-white rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 shadow-md border border-gray-200">
            {formatAge(dateOfBirth)}
          </div>
        )}
      </div>
    )
  }
  
  // Fallback avatar with initials
  return (
    <div
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{ width: dimension, height: dimension, flex: 'none' }}
    >
      <div className={`w-full h-full rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold shadow-sm`}>
        {initials}
      </div>
      
      {showAge && dateOfBirth && (
        <div className="absolute -bottom-2 -right-2 bg-white rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 shadow-md border border-gray-200">
          {formatAge(dateOfBirth)}
        </div>
      )}
    </div>
  )
}
