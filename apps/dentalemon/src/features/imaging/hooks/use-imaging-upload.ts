import { useState, useRef } from 'react'
import { apiBaseUrl } from '@/utils/config'

export interface UploadOptions {
  patientId: string
  branchId: string
  visitId?: string
  modality?: string
  toothNumbers?: number[]
}

export function useImagingUpload() {
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const upload = async (file: File, options: UploadOptions): Promise<{ studyId: string }> => {
    setIsUploading(true)
    setProgress(0)
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    let fileId: string | undefined

    try {
      // 1. Initiate imaging study + get presigned upload URL
      const initRes = await fetch(`${apiBaseUrl}/dental/imaging/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: options.patientId,
          branchId: options.branchId,
          visitId: options.visitId,
          modality: options.modality ?? 'other',
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          toothNumbers: options.toothNumbers ?? [],
        }),
        signal,
      })
      if (!initRes.ok) throw new Error(await initRes.text())
      const {
        study,
        uploadUrl,
        uploadMethod,
        fileId: respFileId,
      } = (await initRes.json()) as {
        study: { id: string }
        uploadUrl: string
        uploadMethod: string
        fileId: string
      }
      fileId = respFileId

      // 2. Upload file to presigned URL (single PUT for Phase 2;
      //    chunked multipart handled by storage layer from Phase 1.5)
      setProgress(10)
      const uploadRes = await fetch(uploadUrl, {
        method: uploadMethod,
        body: file,
        signal,
      })
      if (!uploadRes.ok) throw new Error('Storage upload failed')
      setProgress(100)

      return { studyId: study.id }
    } catch (err) {
      // On error: abort any partial multipart at storage layer (DELETE /storage/multipart/{fileId}/abort)
      if (fileId) {
        fetch(`${apiBaseUrl}/storage/multipart/${fileId}/abort`, { method: 'DELETE' }).catch(() => {
          // best-effort cleanup
        })
      }
      throw err
    } finally {
      setIsUploading(false)
      abortRef.current = null
    }
  }

  const abort = () => {
    abortRef.current?.abort()
    setIsUploading(false)
    setProgress(0)
  }

  return { progress, upload, isUploading, abort }
}
