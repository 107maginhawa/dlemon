import { useState } from 'react'
import * as storageApi from '../../services/storage'

// ============================================================================
// Types
// ============================================================================

/**
 * Uploaded file result
 */
export interface UploadedFile {
  id: string
  downloadUrl: string
}

/**
 * Hook configuration options
 */
export interface UseFileUploadOptions {
  /**
   * Maximum file size in bytes (default: 50MB)
   */
  maxFileSize?: number
}

/**
 * Hook return value
 */
export interface UseFileUploadResult {
  upload: (file: File) => Promise<UploadedFile>
  isUploading: boolean
  progress: number
  error: string | null
  reset: () => void
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for uploading files to S3 via presigned URLs
 * Handles the full 4-step upload process:
 * 1. Request presigned URL from backend
 * 2. Upload file directly to S3
 * 3. Complete upload and get file metadata
 * 4. Get download URL for the uploaded file
 *
 * Storage API integration is handled internally - routes don't need to know about API details.
 *
 * @param options - Configuration options (maxFileSize)
 * @returns Upload functions and state
 *
 * @example
 * ```tsx
 * import { useFileUpload } from '@monobase/sdk/react/hooks/use-storage'
 *
 * function MyComponent() {
 *   const { upload, isUploading, progress } = useFileUpload()
 *
 *   const handleUpload = async (file: File) => {
 *     const result = await upload(file)
 *     console.log('File uploaded:', result.downloadUrl)
 *   }
 * }
 * ```
 */
export function useFileUpload(options?: UseFileUploadOptions): UseFileUploadResult {
  const {
    maxFileSize = 50 * 1024 * 1024, // 50MB default
  } = options || {}

  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<UploadedFile> => {
    try {
      setIsUploading(true)
      setProgress(0)
      setError(null)

      // Validate file size
      if (file.size > maxFileSize) {
        const sizeMB = Math.round(maxFileSize / (1024 * 1024))
        throw new Error(`File size exceeds ${sizeMB}MB limit`)
      }

      // Step 1: Request presigned URL
      setProgress(10)
      const uploadResponse = await storageApi.requestFileUpload({
        filename: file.name,
        size: file.size,
        mimeType: file.type,
      })

      // Step 2: Upload to S3
      setProgress(30)
      await storageApi.uploadToPresignedUrl(uploadResponse.uploadUrl, file)
      setProgress(60)

      // Step 3: Complete upload
      await storageApi.completeFileUpload(uploadResponse.file)
      setProgress(80)

      // Step 4: Get download URL
      const downloadResponse = await storageApi.getFileDownload(uploadResponse.file)
      setProgress(100)

      return {
        id: downloadResponse.file.id,
        downloadUrl: downloadResponse.downloadUrl
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  const reset = () => {
    setIsUploading(false)
    setProgress(0)
    setError(null)
  }

  return {
    upload,
    isUploading,
    progress,
    error,
    reset,
  }
}
