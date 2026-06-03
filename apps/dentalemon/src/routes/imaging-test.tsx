/**
 * E2E TEST-ONLY HARNESS ROUTE — /imaging-test
 *
 * Excluded from the production bundle via `routeFileIgnorePattern` in
 * vite.config.ts (`imaging(-comparison)?-test.tsx?`), so this never ships and is
 * NOT auto-discovered into routeTree.gen.ts. It is registered manually as a
 * code-based child of the root route in src/router.tsx (see `harnessRoutes`).
 *
 * Mounts the REAL imaging components (PatientImageList + ImagingWorkspace)
 * against a self-seeded TanStack Query cache (harness-fixtures.ts) so the
 * imaging E2E specs run with NO live API / DB / org. All backend traffic is
 * mocked by the specs via page.route(); a null Better-Auth session still
 * renders the workspace (the root route does not gate on session).
 *
 * Query params:
 *   ?modality=cephalometric → ImagingWorkspace with the ceph workspace reachable
 *                             ("Toggle ceph panel" button visible)
 *   ?modality=panoramic     → ImagingWorkspace in panoramic mode (no ceph button,
 *                             BR-024 distortion warning)
 *   (bare)                  → PatientImageList (cbct-study-card, select-image-*
 *                             checkboxes, Compare flow) + a default ImagingWorkspace
 *                             so canvas / measurement + annotation toolbars are present.
 */
import { useEffect, useState } from 'react'
import { createRoute, type AnyRoute, useSearch } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PatientImageList } from '@/features/imaging/components/patient-image-list'
import { ImagingWorkspace } from '@/features/imaging/components/imaging-workspace'
import { ComparisonView } from '@/features/imaging/components/comparison-view'
import type { PatientImageItem } from '@/features/imaging/hooks/use-imaging-studies'
import {
  TEST_IDS,
  studiesFixture,
  comparisonFixtures,
} from '@/features/imaging/test-support/harness-fixtures'

// A 1×1 transparent PNG as a data: URI. Lets ImagingWorkspace's <img> load
// (firing onload → canvas render) with no network — the specs never mock the
// image-download endpoint for the bare/ceph/measurement flows.
const PLACEHOLDER_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// Seed the workspace as calibrated so the mm-dependent measurement tools
// (Distance, Area) are enabled — the measurement/annotation specs exercise the
// Distance tool directly. Real-world calibration is per-image; the harness just
// provides a non-null mm-per-px so the tools aren't gated behind a calibrate step.
const HARNESS_PIXEL_SPACING_MM = 0.1

interface HarnessSearch {
  modality?: string
}

// Wipe the imaging IndexedDB blob cache so each harness mount starts from the
// mocked-network state. Without this, a blob cached by an earlier spec in the
// same Playwright worker (setCachedBlob / seedOfflineBlobs) bleeds across specs
// and makes the ceph/workspace flows non-deterministic. The comparison harness
// intentionally seeds blobs itself, so this clear lives only in the workspace
// route. Best-effort: swallow errors (private mode / absent DB).
function clearImagingBlobCache(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase('dentalemon-imaging')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

// One QueryClient per mount; seeded so PatientImageList renders with no network.
// The query key MUST mirror use-imaging-studies.ts: ['imaging','patient',id,branchId].
function makeSeededClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  })
  qc.setQueryData(
    ['imaging', 'patient', TEST_IDS.patientId, TEST_IDS.branchId],
    studiesFixture(),
  )
  // Expose the QueryClient so the E2E harness can read the live ceph-landmarks
  // fetchStatus and wait for it to be quiescent before driving Auto-detect (see
  // waitLandmarksSettled in imaging-harness.ts). This is the single source of
  // truth for "no landmarks fetch in flight" across the workspace + panel
  // observers, eliminating the React Query dedup clobber race. Harness-route
  // only — this file is excluded from the production bundle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__cephQueryClient = qc
  return qc
}

function ImagingTestHarness() {
  const { modality } = useSearch({ strict: false }) as HarnessSearch
  const [queryClient] = useState(makeSeededClient)
  const { imageA } = comparisonFixtures()
  const [cacheCleared, setCacheCleared] = useState(false)

  // Clear the imaging IDB blob cache once before mounting any workspace, so
  // stale blobs from earlier specs can't bleed into this navigation.
  useEffect(() => {
    let cancelled = false
    void clearImagingBlobCache().then(() => {
      if (!cancelled) setCacheCleared(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Selection state mirrors WorkspaceImagingOverlay so the Compare ▶ handoff works.
  const [selectedImageItem, setSelectedImageItem] = useState<PatientImageItem | null>(null)
  const [comparisonItems, setComparisonItems] =
    useState<[PatientImageItem, PatientImageItem] | null>(null)

  if (!cacheCleared) {
    return <div className="h-screen w-screen bg-black" data-testid="harness-clearing-cache" />
  }

  // Modality-specific single-workspace views (ceph / panoramic specs).
  if (modality === 'cephalometric' || modality === 'panoramic') {
    return (
      <QueryClientProvider client={queryClient}>
        <div className="h-screen w-screen bg-black">
          <ImagingWorkspace
            imageId={imageA.id}
            imageUrl={PLACEHOLDER_IMG}
            className="h-full w-full"
            modality={modality}
            visitId={TEST_IDS.visitId}
            patientId={TEST_IDS.patientId}
            branchId={TEST_IDS.branchId}
            pixelSpacingMm={HARNESS_PIXEL_SPACING_MM}
          />
        </div>
      </QueryClientProvider>
    )
  }

  // Bare view: list + workspace, mirroring WorkspaceImagingOverlay composition.
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen w-screen bg-background">
        <PatientImageList
          patientId={TEST_IDS.patientId}
          branchId={TEST_IDS.branchId}
          onSelectImage={(item) => {
            setComparisonItems(null)
            setSelectedImageItem(item)
          }}
          onCompare={(items) => {
            setSelectedImageItem(null)
            setComparisonItems(items)
          }}
        />
        <div className="flex-1 min-w-0">
          {comparisonItems ? (
            <ComparisonView
              imageA={comparisonItems[0]}
              imageB={comparisonItems[1]}
              onClose={() => setComparisonItems(null)}
            />
          ) : (
            <ImagingWorkspace
              imageId={(selectedImageItem ?? imageA).id}
              imageUrl={selectedImageItem?.downloadUrl ?? PLACEHOLDER_IMG}
              className="h-full w-full"
              modality={(selectedImageItem ?? imageA).modality}
              visitId={TEST_IDS.visitId}
              patientId={TEST_IDS.patientId}
              branchId={TEST_IDS.branchId}
              pixelSpacingMm={HARNESS_PIXEL_SPACING_MM}
            />
          )}
        </div>
      </div>
    </QueryClientProvider>
  )
}

export function createImagingTestRoute(rootRoute: AnyRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/imaging-test',
    validateSearch: (search: Record<string, unknown>): HarnessSearch => ({
      modality: typeof search.modality === 'string' ? search.modality : undefined,
    }),
    component: ImagingTestHarness,
  })
}
