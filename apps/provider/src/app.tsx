import { RouterProvider } from '@tanstack/react-router'
import { ApiProvider } from '@monobase/sdk/react/provider'
import { createRoot } from 'react-dom/client'
import { createRouter } from './router'
import { initializeOneSignal } from '@/services/onesignal'
import { useSession } from '@monobase/sdk/react/hooks/use-auth'
import { useMyPerson } from '@monobase/sdk/react/hooks/use-person'
import { useMyProvider } from '@monobase/sdk/react/hooks/use-provider'
import { useOneSignal } from '@/hooks/use-onesignal'
import { apiBaseUrl } from '@/utils/config'
import { Loading } from '@/components/loading'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

const router = createRouter()

// Initialize OneSignal push notifications (optional - only if VITE_ONESIGNAL_APP_ID is set)
initializeOneSignal()

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
  const { data: person, isPending: personPending } = useMyPerson()
  const { data: provider, isPending: providerPending } = useMyProvider()

  // Show loading only on very first fetch before any data/error is received
  if (sessionPending || personPending || providerPending) {
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
      provider: provider || null,
    }
  }
  return <RouterProvider router={router} context={context} />
}

/**
 * Root app component with all providers
 */
function App() {
  return (
    <ApiProvider apiBaseUrl={apiBaseUrl}>
      <InnerApp />
      <TanStackDevtools
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
    </ApiProvider>
  )
}

// Pure SPA mode with TanStack Router
createRoot(document.getElementById('root')!).render(<App />)
