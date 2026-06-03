// src/router.tsx
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.ts'
import { Route as rootRoute } from './routes/__root'
import { createImagingTestRoute } from './routes/imaging-test'
import { createImagingComparisonTestRoute } from './routes/imaging-comparison-test'
import { NotFound } from '@monobase/ui'
import type { Person } from '@/lib/guards'
import type { User, Session } from 'better-auth'

// E2E test-only harness routes (/imaging-test, /imaging-comparison-test).
// These files are excluded from routeTree.gen.ts via vite's
// routeFileIgnorePattern, so they never ship to production and are registered
// here manually as code-based children of the root route. Merged into the
// generated tree so the imaging E2E specs can mount the real imaging components
// against fixture data. addChildren merges with the file-generated children.
const harnessRoutes = [
  createImagingTestRoute(rootRoute),
  createImagingComparisonTestRoute(rootRoute),
]
const routeTreeWithHarness = routeTree.addChildren([
  ...Object.values(routeTree.children ?? {}),
  ...harnessRoutes,
])

// ============================================================================
// Router Context Type
// ============================================================================

export interface RouterContext {
  auth: {
    user: User | null
    session: Session | null
    person: Person | null
  }
}

// ============================================================================
// Router Factory
// ============================================================================

export function createRouter() {
  const router = createTanStackRouter({
    routeTree: routeTreeWithHarness,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    notFoundMode: 'fuzzy',
    context: {
      auth: undefined!,  // Will be provided by RouterProvider
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
