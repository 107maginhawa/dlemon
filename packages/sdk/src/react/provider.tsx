import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthQueryProvider } from '@daveyplate/better-auth-tanstack'
import { setApiBaseUrl, ApiError } from '../api'
import { initAuthClient, AuthClientContext } from './auth'
import type { ReactNode } from 'react'
import { useEffect, useRef, useMemo } from 'react'

export interface ApiProviderProps {
  queryClient?: QueryClient  // Optional - creates default if not provided
  apiBaseUrl: string
  children: ReactNode
}

/**
 * Smart retry function that only retries appropriate errors
 * - Never retries 4xx client errors (validation, auth, not found)
 * - Retries 5xx server errors and network errors
 */
const shouldRetryError = (failureCount: number, error: unknown): boolean => {
  // Max retry attempts
  if (failureCount >= 3) return false
  
  // ApiError with status code
  if (error instanceof ApiError) {
    // 4xx = client errors (validation, auth, not found) - NEVER retry
    if (error.status >= 400 && error.status < 500) {
      return false
    }
    
    // 5xx = server errors - retry with backoff
    if (error.status >= 500) {
      return true
    }
    
    // 408 = timeout - retry
    if (error.status === 408) {
      return true
    }
  }
  
  // Network errors (fetch failures, timeouts) - retry
  return true
}

// Default QueryClient configuration
const createDefaultQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: shouldRetryError,  // Smart retry: only 5xx and network errors
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: shouldRetryError,  // Smart retry: only 5xx and network errors
      gcTime: 1000 * 5,
    },
  },
})

export function ApiProvider({
  queryClient: providedQueryClient,
  apiBaseUrl,
  children
}: ApiProviderProps) {
  // Use provided queryClient or create a default one
  const queryClient = useMemo(
    () => providedQueryClient || createDefaultQueryClient(),
    [providedQueryClient]
  )

  // Initialize auth client and API base URL only once
  const authClient = useMemo(() => {
    setApiBaseUrl(apiBaseUrl)
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