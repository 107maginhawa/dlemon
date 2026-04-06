import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMyMerchantAccount,
  createMyMerchantAccount,
  getMyOnboardingUrl,
  getMyDashboardLink,
  listMyInvoices,
  getInvoice,
  initiateInvoicePayment,
  isOnboardingComplete,
  canAccessDashboard,
  getAccountSetupStatus,
  type MerchantAccount,
  type Invoice,
  type InvoiceListParams,
  type OnboardingResponse,
  type DashboardLinkResponse,
  type PaymentResponse,
} from '../../services/billing'
import { queryKeys } from '../query-keys'
import { ApiError } from '../../api'

// ============================================================================
// Merchant Account Query Hooks
// ============================================================================

/**
 * Get current user's merchant account
 */
export function useMyMerchantAccount() {
  return useQuery({
    queryKey: queryKeys.billingMerchantAccount(),
    queryFn: getMyMerchantAccount,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Max retries
      if (failureCount >= 3) return false
      
      // Never retry 4xx client errors (validation, auth, not found, etc.)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false
      }
      
      // Retry 5xx server errors and network errors
      return true
    },
  })
}

/**
 * Get merchant account setup status with helpers
 */
export function useMyMerchantAccountStatus() {
  const { data: account, isLoading, error } = useMyMerchantAccount()

  const status = getAccountSetupStatus(account ?? null)
  const canAccessDash = canAccessDashboard(account ?? null)
  const isComplete = isOnboardingComplete(account ?? null)

  return {
    account,
    status,
    canAccessDashboard: canAccessDash,
    isOnboardingComplete: isComplete,
    isLoading,
    error,
  }
}

// ============================================================================
// Merchant Account Mutation Hooks
// ============================================================================

/**
 * Create new merchant account and get onboarding URL
 */
export function useCreateMyMerchantAccount(options?: {
  toastSuccess?: boolean,
  onSuccess?: (account: MerchantAccount, onboardingUrl: string) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { refreshUrl: string; returnUrl: string }) => {
      // Create account
      const account = await createMyMerchantAccount(data)

      // Get onboarding URL immediately
      const onboarding = await getMyOnboardingUrl(account.id, data.refreshUrl, data.returnUrl)

      return { account, onboardingUrl: onboarding.onboardingUrl }
    },
    onSuccess: ({ account, onboardingUrl }) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.billing() })

      // Open Stripe onboarding in new tab
      window.open(onboardingUrl, '_blank', 'noopener,noreferrer')
      
      if (options?.toastSuccess !== false) {
        toast.success('Opening payment provider onboarding')
      }

      options?.onSuccess?.(account, onboardingUrl)
    },
    onError: (error) => {
      console.error('Failed to create merchant account:', error)

      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to create merchant account')
        } else {
          toast.error('Failed to create merchant account. Please try again.')
        }
      }

      options?.onError?.(error as Error)
    },
  })
}

/**
 * Get onboarding URL and open in new tab
 */
export function useGetMyOnboardingUrl(options?: {
  toastSuccess?: boolean,
  onSuccess?: (response: OnboardingResponse) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  return useMutation({
    mutationFn: (data: { merchantAccountId: string; refreshUrl: string; returnUrl: string }) =>
      getMyOnboardingUrl(data.merchantAccountId, data.refreshUrl, data.returnUrl),
    onSuccess: (response) => {
      // Open onboarding in new tab
      window.open(response.onboardingUrl, '_blank', 'noopener,noreferrer')
      
      if (options?.toastSuccess !== false) {
        toast.success('Opening payment provider onboarding')
      }
      
      options?.onSuccess?.(response)
    },
    onError: (error) => {
      console.error('Failed to get onboarding URL:', error)

      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to start onboarding')
        } else {
          toast.error('Failed to start onboarding. Please try again.')
        }
      }

      options?.onError?.(error as Error)
    },
  })
}

/**
 * Get dashboard link and open in new tab
 */
export function useGetMyDashboardLink(options?: {
  toastSuccess?: boolean,
  onSuccess?: (response: DashboardLinkResponse) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (merchantAccountId: string) => getMyDashboardLink(merchantAccountId),
    onSuccess: (response) => {
      // Update last dashboard access timestamp
      queryClient.invalidateQueries({ queryKey: queryKeys.billing() })

      // Open dashboard in new tab
      window.open(response.dashboardUrl, '_blank', 'noopener,noreferrer')
      
      if (options?.toastSuccess !== false) {
        toast.success('Dashboard opened in new tab')
      }

      options?.onSuccess?.(response)
    },
    onError: (error) => {
      console.error('Failed to get dashboard link:', error)

      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to access dashboard')
        } else {
          toast.error('Failed to access dashboard. Please try again.')
        }
      }

      options?.onError?.(error as Error)
    },
  })
}

// ============================================================================
// Invoice Query Hooks
// ============================================================================

/**
 * List invoices for current user
 */
export function useMyInvoices(params?: InvoiceListParams) {
  return useQuery({
    queryKey: queryKeys.billingInvoices(params as Record<string, unknown>),
    queryFn: () => listMyInvoices(params),
  })
}

/**
 * Get a specific invoice
 */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.billingInvoice(id),
    queryFn: () => getInvoice(id),
    enabled: !!id,
  })
}

// ============================================================================
// Invoice Mutation Hooks
// ============================================================================

/**
 * Initiate payment for an invoice
 * Redirects to checkout URL
 */
export function useInitiatePayment(options?: {
  toastSuccess?: boolean,
  onSuccess?: (response: PaymentResponse, variables: { invoiceId: string }) => void
  toastError?: boolean,
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      invoiceId: string
      paymentMethod?: string
      successUrl?: string
      cancelUrl?: string
      metadata?: Record<string, any>
    }) => initiateInvoicePayment(data.invoiceId, {
      paymentMethod: data.paymentMethod,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
      metadata: data.metadata,
    }),
    onSuccess: (response, variables) => {
      // Invalidate invoice queries
      queryClient.invalidateQueries({ queryKey: queryKeys.billingInvoices() })
      queryClient.invalidateQueries({ queryKey: queryKeys.billingInvoice(variables.invoiceId) })

      // Redirect to checkout
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl
      }
      
      options?.onSuccess?.(response, variables)
    },
    onError: (error) => {
      console.error('Failed to initiate payment:', error)

      if (options?.toastError !== false) {
        if (error instanceof ApiError) {
          toast.error(error.message || 'Failed to initiate payment')
        } else {
          toast.error('Failed to initiate payment. Please try again.')
        }
      }
      
      options?.onError?.(error as Error)
    },
  })
}
