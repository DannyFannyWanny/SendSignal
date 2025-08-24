// Image processing utilities for profile pictures

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Compress and resize image to 400x400px JPG
 */
export async function processProfileImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Set canvas size to 400x400
      canvas.width = 400
      canvas.height = 400
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      // Calculate scaling to maintain aspect ratio
      const scale = Math.max(400 / img.width, 400 / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      
      // Center the image on canvas
      const x = (400 - scaledWidth) / 2
      const y = (400 - scaledHeight) / 2
      
      // Draw and compress image
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
      
      // Convert to JPG with 80% quality
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        0.8
      )
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select an image file' }
  }
  
  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be smaller than 5MB' }
  }
  
  // Check dimensions (minimum 100x100)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width < 100 || img.height < 100) {
        resolve({ valid: false, error: 'Image must be at least 100x100 pixels' })
      } else {
        resolve({ valid: true })
      }
    }
    img.onerror = () => resolve({ valid: false, error: 'Invalid image file' })
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadProfileImage(
  file: File, 
  userId: string, 
  supabase: SupabaseClient
): Promise<string> {
  try {
    // Process image to 400x400 JPG
    const processedBlob = await processProfileImage(file)
    
    // Generate filename
    const timestamp = Date.now()
    const filename = `${userId}_${timestamp}.jpg`
    
    console.log('Uploading image:', { filename, size: processedBlob.size, userId })
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('profile-pictures')
      .upload(filename, processedBlob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`Upload failed: ${error.message}`)
    }
    
    console.log('Upload successful')
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filename)
    
    console.log('Public URL:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error('Image upload error:', error)
    throw error
  }
}

/**
 * Delete profile image from storage
 */
export async function deleteProfileImage(
  imageUrl: string, 
  supabase: SupabaseClient
): Promise<void> {
  try {
    // Extract filename from URL
    const filename = imageUrl.split('/').pop()
    if (!filename) return
    
    // Delete from storage
    const { error } = await supabase.storage
      .from('profile-pictures')
      .remove([filename])
    
    if (error) {
      console.error('Delete error:', error)
    }
  } catch (error) {
    console.error('Delete profile image error:', error)
  }
}
