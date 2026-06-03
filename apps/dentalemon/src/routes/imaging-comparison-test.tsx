/**
 * E2E TEST-ONLY HARNESS ROUTE — /imaging-comparison-test
 *
 * Excluded from the production bundle via `routeFileIgnorePattern` in
 * vite.config.ts (`imaging(-comparison)?-test.tsx?`), so this never ships and is
 * NOT auto-discovered into routeTree.gen.ts. It is registered manually as a
 * code-based child of the root route in src/router.tsx (see `harnessRoutes`).
 *
 * Mounts the REAL ComparisonView against the two fixture images
 * (comparisonFixtures()). Image blobs are seeded into IndexedDB so panes render
 * the ImagingWorkspace canvas; the ?uncached query param degrades a pane to the
 * "Image not available offline" placeholder for the IMG-18 degraded-offline specs.
 *
 * Query params:
 *   (none)         → both panes cached (canvas)
 *   ?uncached=a    → pane A placeholder, pane B cached
 *   ?uncached=b    → pane A cached, pane B placeholder
 *   ?uncached=both → both panes placeholder (fully offline)
 */
import { useEffect, useState } from 'react'
import { createRoute, type AnyRoute, useSearch } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ComparisonView } from '@/features/imaging/components/comparison-view'
import {
  TEST_IDS,
  studiesFixture,
  comparisonFixtures,
  seedOfflineBlobs,
} from '@/features/imaging/test-support/harness-fixtures'

interface HarnessSearch {
  uncached?: 'a' | 'b' | 'both'
}

function makeSeededClient(): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  })
  qc.setQueryData(
    ['imaging', 'patient', TEST_IDS.patientId, TEST_IDS.branchId],
    studiesFixture(),
  )
  return qc
}

function ComparisonTestHarness() {
  const { uncached } = useSearch({ strict: false }) as HarnessSearch
  const [queryClient] = useState(makeSeededClient)
  const { imageA, imageB } = comparisonFixtures()
  const [closed, setClosed] = useState(false)
  const [ready, setReady] = useState(false)

  // Seed only the blobs that should be available offline, mirroring the
  // ?uncached param, BEFORE ComparisonView reads getCachedBlob() on mount.
  useEffect(() => {
    const idsToCache: string[] = []
    if (uncached !== 'a' && uncached !== 'both') idsToCache.push(imageA.id)
    if (uncached !== 'b' && uncached !== 'both') idsToCache.push(imageB.id)
    let cancelled = false
    void seedOfflineBlobs(idsToCache).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [uncached, imageA.id, imageB.id])

  if (!ready) {
    return <div className="h-screen w-screen bg-zinc-950" data-testid="comparison-seeding" />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen w-screen bg-zinc-950">
        {closed ? null : (
          <ComparisonView imageA={imageA} imageB={imageB} onClose={() => setClosed(true)} />
        )}
      </div>
    </QueryClientProvider>
  )
}

export function createImagingComparisonTestRoute(rootRoute: AnyRoute) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path: '/imaging-comparison-test',
    validateSearch: (search: Record<string, unknown>): HarnessSearch => ({
      uncached:
        search.uncached === 'a' || search.uncached === 'b' || search.uncached === 'both'
          ? search.uncached
          : undefined,
    }),
    component: ComparisonTestHarness,
  })
}
