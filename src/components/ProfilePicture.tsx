// Profile Picture component with fallback avatars

import { useState } from 'react'
import { formatAge } from '@/lib/utils'

interface ProfilePictureProps {
  userId: string
  firstName: string | null
  dateOfBirth: string | null
  profilePictureUrl: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
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
  
  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl'
  }
  
  // Show profile picture if available and no error
  if (profilePictureUrl && !imageError) {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <img
          src={profilePictureUrl}
          alt={`${firstName || 'User'}'s profile picture`}
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
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-2 py-1 text-xs font-medium text-gray-700 shadow-sm border border-gray-200">
            {formatAge(dateOfBirth)}
          </div>
        )}
      </div>
    )
  }
  
  // Fallback avatar with initials
  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      <div className={`w-full h-full rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold shadow-sm`}>
        {initials}
      </div>
      
      {showAge && dateOfBirth && (
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-2 py-1 text-xs font-medium text-gray-700 shadow-sm border border-gray-200">
          {formatAge(dateOfBirth)}
        </div>
      )}
    </div>
  )
}
