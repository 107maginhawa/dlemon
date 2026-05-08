import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AuthQueryProvider } from '@daveyplate/better-auth-tanstack'
import { setSdkBaseUrl, errorInterceptor, SdkError } from '../client'
import { client as generatedClient } from '../generated/client.gen'
import { initAuthClient, AuthClientContext } from './auth'
import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'

// Module-level dedup flag — prevents thundering herd (N concurrent 401s → N redirects)
let sessionExpiredHandling = false

/**
 * Optional notifier interface — the SDK no longer ships a hard dependency on
 * `sonner` (or any other toast library). The consuming app passes a notifier
 * (typically `sonner`'s `toast` namespace) and the SDK's `MutationCache`
 * handlers route mutation success/error toasts through it based on
 * `mutation.meta.toast`.
 */
export interface SdkNotifier {
  success: (message: string) => void
  error: (message: string) => void
}

/**
 * Convention for declaring toast UX on a mutation:
 *
 * ```ts
 * useMutation({
 *   ...createPersonMutation(),
 *   meta: { toast: { success: 'Profile created', error: 'Could not create profile' } },
 * })
 * ```
 *
 * Set a value to `false` to suppress that side; provide a function for the
 * error case to derive the message from the thrown error.
 */
export interface MutationToastMeta {
  success?: string | false
  error?: string | ((error: unknown) => string) | false
}

export interface ApiProviderProps {
  apiBaseUrl: string
  /** Optional pre-built QueryClient. One is created if you don't pass one. */
  queryClient?: QueryClient
  /** Optional notifier — without it, mutations meta.toast is silently ignored. */
  notifier?: SdkNotifier
  /**
   * Called when any API response returns 401 (session expired or revoked).
   * The callback should clear local auth state and redirect to sign-in.
   * Auth endpoints (/api/auth/*) are excluded — their 401s are expected.
   * If not provided, 401 responses are handled only by TanStack Query's error state.
   */
  onSessionExpired?: () => void
  children: ReactNode
}

/**
 * Centralized retry policy used by both queries and mutations. After the error
 * interceptor in `client.ts`, every non-2xx error is an `SdkError`, so the
 * status check is uniform — no need to maintain two retry helpers.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false
  if (error instanceof SdkError) {
    if (error.status >= 400 && error.status < 500 && error.status !== 408) return false
    return true
  }
  // TypeError, AbortError, network failures — retry by default.
  return true
}

function readToastMeta(meta: unknown): MutationToastMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  const toast = (meta as { toast?: unknown }).toast
  if (!toast || typeof toast !== 'object') return undefined
  return toast as MutationToastMeta
}

function createDefaultQueryClient(notifier?: SdkNotifier): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: shouldRetry,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: shouldRetry,
        gcTime: 1000 * 5,
      },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, _vars, _ctx, mutation) => {
        if (!notifier) return
        const meta = readToastMeta(mutation.meta)
        if (meta?.success) notifier.success(meta.success)
      },
      onError: (error, _vars, _ctx, mutation) => {
        if (!notifier) return
        const meta = readToastMeta(mutation.meta)
        const message =
          typeof meta?.error === 'function'
            ? meta.error(error)
            : meta?.error
        if (message) notifier.error(message)
      },
    }),
  })
}

export function ApiProvider({
  queryClient: providedQueryClient,
  apiBaseUrl,
  notifier,
  onSessionExpired,
  children,
}: ApiProviderProps) {
  const queryClient = useMemo(
    () => providedQueryClient ?? createDefaultQueryClient(notifier),
    [providedQueryClient, notifier],
  )

  // Install interceptors exactly once across the app's lifetime.
  // Hey-api's interceptor arrays are additive — re-running on every render would stack duplicates.
  const interceptorInstalledRef = useRef(false)
  if (!interceptorInstalledRef.current) {
    generatedClient.interceptors.error.use(errorInterceptor)

    // 401 response interceptor: detect expired/revoked cloud sessions.
    // Uses response interceptor (not error interceptor) so it runs before the error path,
    // allowing us to call onSessionExpired before the error propagates to queries.
    generatedClient.interceptors.response.use((response, request) => {
      if (response.status === 401 && onSessionExpired && !sessionExpiredHandling) {
        const url = new URL(request.url)
        // Skip auth endpoints — 401 is expected during login/signup flows
        if (!url.pathname.startsWith('/api/auth/')) {
          sessionExpiredHandling = true
          onSessionExpired()
        }
      }
      return response
    })

    interceptorInstalledRef.current = true
  }

  const authClient = useMemo(() => {
    setSdkBaseUrl(apiBaseUrl)
    generatedClient.setConfig({ baseUrl: apiBaseUrl })
    return initAuthClient(apiBaseUrl)
  }, [apiBaseUrl])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthQueryProvider>
        <AuthClientContext.Provider value={authClient}>
          {children}
        </AuthClientContext.Provider>
      </AuthQueryProvider>
    </QueryClientProvider>
  )
}
