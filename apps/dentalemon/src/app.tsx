import { RouterProvider } from '@tanstack/react-router'
import { ApiProvider } from '@monobase/sdk-ts/react/provider'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { createRouter } from './router'
import { initializeOneSignal } from '@/features/notifications/onesignal'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { getPersonOptions } from '@monobase/sdk-ts/generated/react-query'
import { SdkError } from '@monobase/sdk-ts/client'
import { useOneSignal } from '@/hooks/use-onesignal'
import { getRuntimeConfig } from '@/lib/config'
import { Loading } from '@monobase/ui'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { pinSession } from '@/lib/pin-session'
import { useState, useEffect, useCallback } from 'react'

const router = createRouter()

// Stable no-op used as onSessionExpired for E2E harness routes so that
// unmocked 401s don't trigger a hard redirect during Playwright tests.
// provider.tsx installs its interceptor once and closes over this reference,
// so module-level stability matters.
const noop = () => {}

function isHarnessRoute() {
  // E2E test-only harness routes: ceph-report print route + the two imaging
  // harness routes (/imaging-test, /imaging-comparison-test). These mock the API
  // via page.route(); a stray unmocked 401 must NOT bounce them to /auth/sign-in.
  return /^\/imaging-ceph-report|^\/imaging-test|^\/imaging-comparison-test/.test(
    window.location.pathname,
  )
}

/**
 * Inner app component that provides auth context to router
 * This must be inside QueryClientProvider and AuthQueryProvider to access auth hooks
 */
function InnerApp() {
  // sync OneSignal user ID with auth state
  useOneSignal()

  // Wait for session to load before rendering router
  // This ensures router guards have correct auth context from the start
  // Use isPending (not isLoading) to avoid blocking during retries/refetches
  const { data: session, isPending: sessionPending } = useSession()
  // 404 just means "no person profile yet" — surface it as null instead of
  // an error so guards can route to onboarding without thrashing.
  const personQuery = useQuery({
    ...getPersonOptions({ path: { person: 'me' } }),
    enabled: !!session?.user,
    retry: (failureCount, error) => {
      if (error instanceof SdkError && (error.status === 404 || error.status === 401)) return false
      return failureCount < 3
    },
  })
  const personPending = personQuery.isPending
  const person =
    personQuery.error instanceof SdkError && personQuery.error.status === 404
      ? null
      : personQuery.data ?? null

  // Show loading only while session is resolving, or while fetching person for a logged-in user
  if (sessionPending || (session?.user && personPending)) {
    return <Loading />
  }

  // Handle post-signup redirect
  // If user just signed up (has session but no person), redirect to onboarding
  if (session?.user && !person && window.location.pathname.includes('/auth/')) {
    window.location.href = '/onboarding'
    return <Loading />
  }

  // build context
  const context = {
    auth: {
      session: session?.session || null,
      user: session?.user || null,
      person: person || null,
    }
  }
  return <RouterProvider router={router} context={context} />
}

/**
 * Root app component with all providers
 * Fetches runtime config and initializes services before rendering
 */
function App() {
  const [config, setConfig] = useState<{ apiUrl: string; onesignalAppId: string } | null>(null)

  useEffect(() => {
    getRuntimeConfig().then(runtimeConfig => {
      setConfig(runtimeConfig)

      // Initialize OneSignal with runtime config (optional - only if app ID is set)
      if (runtimeConfig.onesignalAppId) {
        initializeOneSignal()
      }
    })
  }, [])

  const handleSessionExpired = useCallback(() => {
    pinSession.clearSession()
    window.location.assign('/auth/sign-in?session_expired=1')
  }, [])

  // UJ-ORG-003 / P2-17: HIPAA workstation auto-logoff.
  // Reset the PIN inactivity timer on any user activity, and ACTIVELY lock +
  // redirect the moment the timer fires (not lazily on the next navigation).
  // The PinSessionManager already locks the in-memory session when the timer
  // elapses; here we register the onExpire callback that drives the UI so an
  // unattended chairside workstation is locked even if the user never navigates.
  useEffect(() => {
    const handleActivity = () => pinSession.updateActivity()
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)

    // Active auto-logoff: when idle expiry fires, the session is already locked
    // by the manager. Bounce the user to PIN re-entry so the workstation can't
    // sit on an authenticated screen unattended. memberId is preserved so the
    // PIN screen knows who to re-prompt.
    pinSession.onExpire(() => {
      if (isHarnessRoute()) return
      const memberId = pinSession.getSession()?.memberId
      const target = memberId ? `/auth/pin-entry/${memberId}` : '/auth/pin-select'
      window.location.assign(target)
    })

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
    }
  }, [])

  // Show loading while fetching runtime config
  if (!config) {
    return <Loading />
  }

  return (
    <ApiProvider apiBaseUrl={config.apiUrl} notifier={toast} onSessionExpired={isHarnessRoute() ? noop : handleSessionExpired}>
      <InnerApp />
      {import.meta.env.DEV && (
        <TanStackDevtools
          // bottom-left: bottom-right collides with the workspace footer's
          // "Continue to Payment" CTA (billing-audit-2026-06-27 B1).
          config={{ position: 'bottom-left' }}
          plugins={[
            {
              name: 'TanStack Query',
              render: <ReactQueryDevtoolsPanel />
            },
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />
            }
          ]}
        />
      )}
    </ApiProvider>
  )
}

// Pure SPA mode with TanStack Router
createRoot(document.getElementById('root')!).render(<App />)
