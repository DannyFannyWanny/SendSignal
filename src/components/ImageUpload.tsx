// Image Upload component for profile pictures

import { useState, useRef } from 'react'
import { validateImageFile, processProfileImage } from '@/lib/imageUtils'

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  currentImageUrl?: string | null
  className?: string
}

export default function ImageUpload({
  onImageSelect,
  currentImageUrl,
  className = ''
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0])
    }
  }
  
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0])
    }
  }
  
  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    
    try {
      // Validate file
      const validation = await validateImageFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        setUploading(false)
        return
      }
      
      // Create preview
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      
      // Process and send to parent
      onImageSelect(file)
      setUploading(false)
    } catch (err) {
      setError('Failed to process image')
      setUploading(false)
    }
  }
  
  const handleClick = () => {
    fileInputRef.current?.click()
  }
  
  const removeImage = () => {
    setPreviewUrl(null)
    setError(null)
    // Create a dummy file to signal removal
    const dummyFile = new File([''], 'remove', { type: 'image/jpeg' })
    onImageSelect(dummyFile)
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        {!previewUrl ? (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG up to 5MB • Will be resized to 400x400px
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Choose Image
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-20 h-20">
              <img
                src={previewUrl}
                alt="Profile preview"
                className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Profile picture selected
              </p>
              <div className="flex space-x-2 justify-center">
                <button
                  type="button"
                  onClick={handleClick}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {error}
        </div>
      )}
      
      {/* Upload Status */}
      {uploading && (
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-3">
          Processing image...
        </div>
      )}
    </div>
  )
}
