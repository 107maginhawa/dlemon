import { Button } from '@monobase/ui'
import { useCbctViewerLink } from '@/features/imaging/hooks/use-cbct-viewer'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'

interface CbctStudyCardProps {
  item: PatientImageItem
}

/**
 * P2-7 CBCT volume affordance (Phase 1 / A1).
 *
 * Renders a CBCT / 3-D volume as a volume-aware card with metadata + an
 * "Open in viewer" handoff (presigned DICOM download), NEVER a flat <img>.
 *
 * Clinical-safety (plan §2/§8): a CBCT must never be presented as a flat 2-D
 * image. We surface the frame count truthfully ("128 slices") and label the
 * card as a 3-D volume so a clinician is never misled that a single slice is
 * "the CBCT".
 */
export function CbctStudyCard({ item }: CbctStudyCardProps) {
  const viewerLink = useCbctViewerLink()

  const frameCount = item.frameCount ?? null
  const studyId = item.studyId

  async function openInViewer() {
    if (!studyId) return
    const link = await viewerLink.mutateAsync(studyId)
    // A1 handoff: open the presigned DICOM download in a new tab so the clinician's
    // OS / DICOM viewer takes over. No in-app 3-D rendering.
    window.open(link.downloadUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      data-testid="cbct-study-card"
      className="rounded-lg border border-zinc-200 bg-white p-3"
    >
      <div className="flex items-center gap-2">
        <span
          data-testid="cbct-volume-badge"
          className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
        >
          3D Volume
        </span>
        <span className="text-sm font-medium text-zinc-900 truncate">{item.fileName}</span>
      </div>

      <p className="mt-1 text-xs text-zinc-500">
        CBCT cone-beam volume
        {frameCount != null ? (
          <>
            {' · '}
            <span data-testid="cbct-frame-count">{frameCount} slices</span>
          </>
        ) : null}
      </p>

      {/* Truthful-labeling requirement: this is a 3-D dataset, not a flat radiograph.
          The full volume must be opened in a DICOM viewer. */}
      <p className="mt-1 text-[11px] leading-snug text-zinc-400">
        3-D dataset — open the full volume in a DICOM viewer. Not shown as a flat image.
      </p>

      <Button
        type="button"
        variant="lemon"
        size="sm"
        className="mt-2 w-full"
        data-testid="cbct-open-viewer"
        disabled={!studyId || viewerLink.isPending}
        onClick={openInViewer}
      >
        {viewerLink.isPending ? 'Preparing…' : 'Open in viewer'}
      </Button>

      {viewerLink.isError ? (
        <p className="mt-1 text-[11px] text-red-500" data-testid="cbct-viewer-error">
          Could not prepare the viewer link. Try again.
        </p>
      ) : null}
    </div>
  )
}
