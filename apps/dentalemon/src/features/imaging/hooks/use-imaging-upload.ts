/**
 * useImagingUpload — hook for uploading imaging files
 *
 * Split-case migration (mirrors use-attachments gold standard):
 *   MIGRATED to SDK: POST /dental/imaging/studies → imagingMgmtCreateImagingStudy
 *   KEPT RAW (binary upload flow):
 *     - presigned single PUT to uploadUrl (S3/MinIO, no auth cookie)
 *     - presigned multipart PUTs to partUrls[i] (S3/MinIO, no auth cookie)
 *     - POST /storage/multipart/{fileId}/complete (multipart completion)
 *     - DELETE /storage/multipart/{fileId}/abort (error cleanup)
 *
 * The storage endpoints ride a separate binary-upload flow and must stay as raw
 * fetch — they either go direct to S3/MinIO (no session) or carry a specific
 * Content-Type that the SDK JSON transport would corrupt.
 */
import { useState, useRef } from 'react'
import { apiBaseUrl } from '@/lib/config'
import { DICOM_MIME_TYPE, isDicomMimeType, parseDicomPixelSpacing } from '@/features/imaging/lib/dicom'
import {
  imagingMgmtCreateImagingStudy,
  type DentalImagingModuleModalityEnum,
} from '@monobase/sdk-ts/generated'

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

      // 1. Initiate imaging study + get the upload envelope (single PUT or multipart).
      //    MIGRATED: was raw fetch → now SDK call (handles auth cookie via ApiProvider).
      const { data: initData } = await imagingMgmtCreateImagingStudy({
        body: {
          patientId: options.patientId,
          branchId: options.branchId,
          ...(options.visitId ? { visitId: options.visitId } : {}),
          modality: (options.modality ?? 'other') as DentalImagingModuleModalityEnum,
          filename: file.name,
          mimeType,
          size: BigInt(file.size),
          toothNumbers: options.toothNumbers ?? [],
          ...(pixelSpacingMm != null ? { pixelSpacingMm } : {}),
        },
        throwOnError: true,
      })

      // Narrow union: DentalImagingModuleCreateImagingStudyResponse | ErrorResponse.
      // ErrorResponse is discriminated by a top-level `error` object.
      if (!initData || 'error' in initData) {
        throw new Error(initData?.error?.message ?? 'Failed to initiate imaging study')
      }

      const { study, uploadUrl, uploadMethod } = initData
      fileId = initData.fileId

      setProgress(10)

      if (uploadMethod === 'MULTIPART' && initData.uploadId && initData.partUrls?.length) {
        // 2a. Large DICOM/CBCT: upload each part to its presigned URL, collect ETags,
        //     then complete the multipart upload via the storage endpoint.
        //     KEPT RAW: presigned S3/MinIO PUTs carry no session cookie.
        const partSize = initData.partSize != null ? Number(initData.partSize) : 5 * 1024 * 1024
        const parts: { partNumber: number; etag: string }[] = []
        for (let i = 0; i < initData.partUrls.length; i++) {
          const start = i * partSize
          const chunk = file.slice(start, Math.min(start + partSize, file.size))
          // eslint-disable-next-line no-restricted-syntax -- presigned S3/MinIO multipart PUT, not an API endpoint
          const partRes = await fetch(initData.partUrls[i]!, { method: 'PUT', body: chunk, signal })
          if (!partRes.ok) throw new Error('Storage multipart part upload failed')
          const etag = partRes.headers.get('ETag') ?? partRes.headers.get('etag') ?? ''
          parts.push({ partNumber: i + 1, etag })
          setProgress(10 + Math.round(((i + 1) / initData.partUrls.length) * 85))
        }
        // KEPT RAW: /storage/multipart/complete is a storage-layer endpoint, not dental API.
        // eslint-disable-next-line no-restricted-syntax -- storage-layer multipart endpoint, no SDK op
        const completeRes = await fetch(`${apiBaseUrl}/storage/multipart/${fileId}/complete`, {
          method: 'POST',
          credentials: 'include', // QA-006: auth-gated API call
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId: initData.uploadId, parts }),
          signal,
        })
        if (!completeRes.ok) throw new Error('Storage multipart completion failed')
      } else {
        // 2b. Single PUT (unchanged for ordinary X-ray/photo uploads).
        //     KEPT RAW: presigned S3/MinIO PUT carries no session cookie.
        // eslint-disable-next-line no-restricted-syntax -- presigned S3/MinIO PUT, not an API endpoint
        const uploadRes = await fetch(uploadUrl, { method: uploadMethod, body: file, signal })
        if (!uploadRes.ok) throw new Error('Storage upload failed')
      }
      setProgress(100)

      return { studyId: study.id }
    } catch (err) {
      // On error: abort any partial multipart at storage layer (DELETE /storage/multipart/{fileId}/abort)
      // KEPT RAW: storage abort endpoint, not dental API.
      if (fileId) {
        // eslint-disable-next-line no-restricted-syntax -- storage-layer multipart abort endpoint, no SDK op
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
