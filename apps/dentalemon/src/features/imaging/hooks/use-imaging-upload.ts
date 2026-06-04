import { useState, useRef } from 'react'
import { apiBaseUrl } from '@/lib/config'
import { DICOM_MIME_TYPE, isDicomMimeType, parseDicomPixelSpacing } from '@/features/imaging/lib/dicom'

export interface UploadOptions {
  patientId: string
  branchId: string
  visitId?: string
  modality?: string
  toothNumbers?: number[]
}

interface InitResponse {
  study: { id: string }
  uploadUrl: string
  uploadMethod: string
  fileId: string
  uploadId?: string
  partSize?: number
  partCount?: number
  partUrls?: string[]
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
      // P1-9: DICOM files often arrive with an empty browser MIME type; normalise to
      // application/dicom by extension so the server allowlist + multipart path apply.
      const isDicom = isDicomMimeType(file.type) || /\.dcm$/i.test(file.name)
      const mimeType = isDicom ? DICOM_MIME_TYPE : file.type

      // P1-9: parse the DICOM PixelSpacing tag client-side so mm measurements work
      // without a manual ruler. Best-effort: unparseable files just skip calibration.
      let pixelSpacingMm: number | undefined
      if (isDicom) {
        try {
          const spacing = parseDicomPixelSpacing(await file.arrayBuffer())
          if (spacing) pixelSpacingMm = spacing.pixelSpacingMm
        } catch {
          // ignore — fall back to manual calibration
        }
      }

      // 1. Initiate imaging study + get the upload envelope (single PUT or multipart)
      // QA-006: auth-gated API POST — must send the session cookie or it 401s.
      const initRes = await fetch(`${apiBaseUrl}/dental/imaging/studies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: options.patientId,
          branchId: options.branchId,
          visitId: options.visitId,
          modality: options.modality ?? 'other',
          filename: file.name,
          mimeType,
          size: file.size,
          toothNumbers: options.toothNumbers ?? [],
          ...(pixelSpacingMm != null ? { pixelSpacingMm } : {}),
        }),
        signal,
      })
      if (!initRes.ok) throw new Error(await initRes.text())
      const init = (await initRes.json()) as InitResponse
      const { study, uploadUrl, uploadMethod } = init
      fileId = init.fileId

      setProgress(10)

      if (uploadMethod === 'MULTIPART' && init.uploadId && init.partUrls?.length) {
        // 2a. Large DICOM/CBCT: upload each part to its presigned URL, collect ETags,
        //     then complete the multipart upload via the storage endpoint.
        const partSize = init.partSize ?? 5 * 1024 * 1024
        const parts: { partNumber: number; etag: string }[] = []
        for (let i = 0; i < init.partUrls.length; i++) {
          const start = i * partSize
          const chunk = file.slice(start, Math.min(start + partSize, file.size))
          const partRes = await fetch(init.partUrls[i]!, { method: 'PUT', body: chunk, signal })
          if (!partRes.ok) throw new Error('Storage multipart part upload failed')
          const etag = partRes.headers.get('ETag') ?? partRes.headers.get('etag') ?? ''
          parts.push({ partNumber: i + 1, etag })
          setProgress(10 + Math.round(((i + 1) / init.partUrls.length) * 85))
        }
        const completeRes = await fetch(`${apiBaseUrl}/storage/multipart/${fileId}/complete`, {
          method: 'POST',
          credentials: 'include', // QA-006: auth-gated API call
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: init.uploadId, parts }),
          signal,
        })
        if (!completeRes.ok) throw new Error('Storage multipart completion failed')
      } else {
        // 2b. Single PUT (unchanged for ordinary X-ray/photo uploads).
        const uploadRes = await fetch(uploadUrl, { method: uploadMethod, body: file, signal })
        if (!uploadRes.ok) throw new Error('Storage upload failed')
      }
      setProgress(100)

      return { studyId: study.id }
    } catch (err) {
      // On error: abort any partial multipart at storage layer (DELETE /storage/multipart/{fileId}/abort)
      if (fileId) {
        fetch(`${apiBaseUrl}/storage/multipart/${fileId}/abort`, {
          method: 'DELETE',
          credentials: 'include', // QA-006: auth-gated API call
        }).catch(() => {
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
