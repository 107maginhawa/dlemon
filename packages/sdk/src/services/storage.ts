import { apiPost, apiGet } from '../api'
import type { components } from '@monobase/api-spec/types'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiFileUploadRequest = components["schemas"]["FileUploadRequest"]
type ApiFileUploadResponse = components["schemas"]["FileUploadResponse"]
type ApiStoredFile = components["schemas"]["StoredFile"]
type ApiFileDownloadResponse = components["schemas"]["FileDownloadResponse"]

// ============================================================================
// Frontend Types
// ============================================================================

/**
 * Frontend representation of FileUploadRequest
 */
export interface FileUploadRequest {
  filename: string
  size: number
  mimeType: string
}

/**
 * File upload information with presigned URL
 */
export interface FileUpload {
  file: string // UUID
  uploadUrl: string // Presigned URL
  uploadMethod: 'PUT'
  expiresAt: Date
}

/**
 * Frontend representation of StoredFile with Date objects
 */
export interface StoredFile {
  id: string
  filename: string
  mimeType: string
  size: number
  status: 'pending' | 'uploaded' | 'failed' | 'uploading' | 'processing' | 'available'
  owner: string
  uploadedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * File download information with presigned URL
 */
export interface FileDownload {
  downloadUrl: string
  expiresAt: Date
  file: StoredFile
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API FileUploadResponse to Frontend FileUpload
 */
export function mapApiFileUploadResponseToFrontend(api: ApiFileUploadResponse): FileUpload {
  return {
    file: api.file,
    uploadUrl: api.uploadUrl,
    uploadMethod: api.uploadMethod,
    expiresAt: new Date(api.expiresAt),
  }
}

/**
 * Convert API StoredFile to Frontend StoredFile
 */
export function mapApiStoredFileToFrontend(api: ApiStoredFile): StoredFile {
  return {
    id: api.id,
    filename: api.filename,
    mimeType: api.mimeType,
    size: api.size,
    status: api.status,
    owner: api.owner,
    uploadedAt: api.uploadedAt ? new Date(api.uploadedAt) : undefined,
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}

/**
 * Convert API FileDownloadResponse to Frontend FileDownload
 */
export function mapApiFileDownloadResponseToFrontend(api: ApiFileDownloadResponse): FileDownload {
  return {
    downloadUrl: api.downloadUrl,
    expiresAt: new Date(api.expiresAt),
    file: mapApiStoredFileToFrontend(api.file),
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Request a presigned URL for file upload
 */
export async function requestFileUpload(request: FileUploadRequest): Promise<FileUpload> {
  const apiRequest: ApiFileUploadRequest = {
    filename: request.filename,
    size: request.size,
    mimeType: request.mimeType,
  }
  const apiResponse = await apiPost<ApiFileUploadResponse>('/storage/files/upload', apiRequest)
  return mapApiFileUploadResponseToFrontend(apiResponse)
}

/**
 * Upload file to presigned URL
 */
export async function uploadToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }
}

/**
 * Complete the file upload process
 */
export async function completeFileUpload(fileId: string): Promise<StoredFile> {
  const apiFile = await apiPost<ApiStoredFile>(`/storage/files/${fileId}/complete`, {})
  return mapApiStoredFileToFrontend(apiFile)
}

/**
 * Get file download URL
 */
export async function getFileDownload(fileId: string): Promise<FileDownload> {
  const apiResponse = await apiGet<ApiFileDownloadResponse>(`/storage/files/${fileId}/download`)
  return mapApiFileDownloadResponseToFrontend(apiResponse)
}