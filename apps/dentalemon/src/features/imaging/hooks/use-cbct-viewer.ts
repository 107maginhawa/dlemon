import { useMutation } from '@tanstack/react-query'
import { imagingMgmtGetCbctViewerLink } from '@monobase/sdk-ts/generated'
import type { DentalImagingModuleCbctViewerLinkResponse } from '@monobase/sdk-ts/generated'

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
      const { data } = await imagingMgmtGetCbctViewerLink({
        path: { studyId },
        throwOnError: true,
      })
      // data is DentalImagingModuleCbctViewerLinkResponse | ErrorResponse.
      // With throwOnError: true, ErrorResponse is thrown; but TypeScript still
      // sees the union. Narrow with the 'error' discriminant from ErrorResponse.
      if ('error' in data) throw new Error(String((data as { error: unknown }).error))
      const raw = data as DentalImagingModuleCbctViewerLinkResponse
      return {
        viewerKind: raw.viewerKind,
        downloadUrl: raw.downloadUrl,
        expiresAt: raw.expiresAt instanceof Date ? raw.expiresAt.toISOString() : String(raw.expiresAt),
        isVolume: raw.isVolume,
        frameCount: raw.frameCount,
      }
    },
  })
}
