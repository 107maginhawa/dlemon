import { useMutation } from '@tanstack/react-query'
import { apiBaseUrl } from '@/lib/config'

/**
 * P2-7 CBCT viewer handoff (Phase 1 / A1).
 *
 * Fetches a presigned GET download URL for the CBCT DICOM volume so the clinician
 * opens it in their own DICOM viewer. v1 is a download handoff — NO in-app 3-D
 * rendering. Exposed as a mutation because it has the side-effect of minting a
 * short-lived presigned URL (not a cacheable read).
 */

export interface CbctViewerLink {
  viewerKind: 'download'
  downloadUrl: string
  expiresAt: string
  isVolume: boolean
  frameCount: number | null
}

export function useCbctViewerLink() {
  return useMutation({
    mutationFn: async (studyId: string): Promise<CbctViewerLink> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/imaging/studies/${studyId}/cbct/viewer-link`,
        { credentials: 'include' },
      )
      if (!res.ok) throw new Error(await res.text())
      return (await res.json()) as CbctViewerLink
    },
  })
}
