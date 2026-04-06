import { apiGet, apiPost, ApiError, type PaginatedResponse } from '../api'
import { sanitizeObject } from '../utils/api'
import type { components } from '@monobase/api-spec/types'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiMerchantAccount = components["schemas"]["MerchantAccount"]
type ApiInvoice = components["schemas"]["Invoice"]
type ApiPaymentResponse = components["schemas"]["PaymentResponse"]
type ApiCreateMerchantAccountRequest = components["schemas"]["CreateMerchantAccountRequest"]

// ============================================================================
// Frontend Types
// ============================================================================

/**
 * Frontend representation of MerchantAccount with Date objects
 */
export interface MerchantAccount {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  person: string
  active: boolean
  metadata: {
    stripeAccountId?: string
    onboardingComplete?: boolean
    dashboardAccessEnabled?: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    country?: string
    currency?: string
    onboardingStartedAt?: Date
    onboardingCompletedAt?: Date
    lastDashboardAccessAt?: Date
  }
}

/**
 * Frontend representation of Invoice with Date objects
 */
export interface Invoice {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  invoiceNumber: string
  customer: string
  merchant: string
  merchantAccount?: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  subtotal: number
  tax?: number
  total: number
  currency: string
  paymentStatus?: string
  paymentDueAt?: Date
  paidAt?: Date
  paidBy?: string
}

export interface OnboardingResponse {
  onboardingUrl: string
  metadata?: Record<string, any>
}

export interface DashboardLinkResponse {
  dashboardUrl: string
  expiresAt: Date
}

export interface PaymentResponse {
  checkoutUrl: string
  metadata?: Record<string, any>
}

export interface InvoiceListParams {
  customer?: string
  merchant?: string
  status?: string
  paymentStatus?: string
  limit?: number
  offset?: number
}

// ============================================================================
// Mapper Functions
// ============================================================================

function mapApiMerchantAccountToFrontend(api: ApiMerchantAccount): MerchantAccount {
  // API metadata is a JSONB field, so we need to type it
  const metadata = (api.metadata || {}) as {
    stripeAccountId?: string
    onboardingComplete?: boolean
    dashboardAccessEnabled?: boolean
    chargesEnabled?: boolean
    payoutsEnabled?: boolean
    country?: string
    currency?: string
    onboardingStartedAt?: string
    onboardingCompletedAt?: string
    lastDashboardAccessAt?: string
  }

  return {
    id: api.id,
    version: api.version,
    createdAt: new Date(api.createdAt),
    createdBy: api.createdBy || '',
    updatedAt: new Date(api.updatedAt),
    updatedBy: api.updatedBy || '',
    person: typeof api.person === 'string' ? api.person : api.person.id,
    active: api.active,
    metadata: {
      stripeAccountId: metadata.stripeAccountId,
      onboardingComplete: metadata.onboardingComplete,
      dashboardAccessEnabled: metadata.dashboardAccessEnabled,
      chargesEnabled: metadata.chargesEnabled,
      payoutsEnabled: metadata.payoutsEnabled,
      country: metadata.country,
      currency: metadata.currency,
      onboardingStartedAt: metadata.onboardingStartedAt
        ? new Date(metadata.onboardingStartedAt)
        : undefined,
      onboardingCompletedAt: metadata.onboardingCompletedAt
        ? new Date(metadata.onboardingCompletedAt)
        : undefined,
      lastDashboardAccessAt: metadata.lastDashboardAccessAt
        ? new Date(metadata.lastDashboardAccessAt)
        : undefined,
    }
  }
}

function mapApiInvoiceToFrontend(api: ApiInvoice): Invoice {
  return {
    id: api.id,
    version: api.version,
    createdAt: new Date(api.createdAt),
    createdBy: api.createdBy || '',
    updatedAt: new Date(api.updatedAt),
    updatedBy: api.updatedBy || '',
    invoiceNumber: api.invoiceNumber,
    customer: typeof api.customer === 'string' ? api.customer : api.customer.id,
    merchant: typeof api.merchant === 'string' ? api.merchant : api.merchant.id,
    merchantAccount: api.merchantAccount
      ? (typeof api.merchantAccount === 'string' ? api.merchantAccount : api.merchantAccount.id)
      : undefined,
    status: api.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
    subtotal: api.subtotal,
    tax: api.tax,
    total: api.total,
    currency: api.currency,
    paymentStatus: api.paymentStatus,
    paymentDueAt: api.paymentDueAt ? new Date(api.paymentDueAt) : undefined,
    paidAt: api.paidAt ? new Date(api.paidAt) : undefined,
    paidBy: api.paidBy,
  }
}

// ============================================================================
// Merchant Account API Functions
// ============================================================================

/**
 * Get current user's merchant account
 */
export async function getMyMerchantAccount(): Promise<MerchantAccount | null> {
  try {
    const apiAccount = await apiGet<ApiMerchantAccount>('/billing/merchant-accounts/me')
    return mapApiMerchantAccountToFrontend(apiAccount)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create new merchant account for current user
 */
export async function createMyMerchantAccount(data: {
  refreshUrl: string
  returnUrl: string
}): Promise<MerchantAccount> {
  const sanitized = sanitizeObject({
    refreshUrl: data.refreshUrl,
    returnUrl: data.returnUrl,
  }, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const apiAccount = await apiPost<ApiMerchantAccount>('/billing/merchant-accounts', sanitized)
  return mapApiMerchantAccountToFrontend(apiAccount)
}

/**
 * Get Stripe Connect onboarding URL for current user's merchant account
 */
export async function getMyOnboardingUrl(
  merchantAccountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<OnboardingResponse> {
  return apiPost<OnboardingResponse>(
    `/billing/merchant-accounts/${merchantAccountId}/onboard`,
    { refreshUrl, returnUrl }
  )
}

/**
 * Get Stripe Express dashboard login link
 */
export async function getMyDashboardLink(merchantAccountId: string): Promise<DashboardLinkResponse> {
  const response = await apiPost<{ dashboardUrl: string; expiresAt: string }>(
    `/billing/merchant-accounts/${merchantAccountId}/dashboard`,
    {}
  )
  return {
    dashboardUrl: response.dashboardUrl,
    expiresAt: new Date(response.expiresAt),
  }
}

// ============================================================================
// Invoice API Functions
// ============================================================================

/**
 * List invoices for current user
 */
export async function listMyInvoices(params?: InvoiceListParams): Promise<PaginatedResponse<Invoice>> {
  const queryParams = sanitizeObject(params || {}, { nullable: [] })
  const response = await apiGet<PaginatedResponse<ApiInvoice>>(
    '/billing/invoices',
    queryParams
  )
  
  return {
    data: response.data.map(mapApiInvoiceToFrontend),
    pagination: response.pagination,
  }
}

/**
 * Get a specific invoice
 */
export async function getInvoice(id: string): Promise<Invoice> {
  const apiInvoice = await apiGet<ApiInvoice>(`/billing/invoices/${id}`)
  return mapApiInvoiceToFrontend(apiInvoice)
}

/**
 * Initiate payment for an invoice
 * Returns checkout URL for redirecting to payment page
 */
export async function initiateInvoicePayment(
  invoiceId: string,
  options: {
    paymentMethod?: string
    successUrl?: string
    cancelUrl?: string
    metadata?: Record<string, any>
  }
): Promise<PaymentResponse> {
  const sanitized = sanitizeObject({
    paymentMethod: options.paymentMethod,
    metadata: {
      ...options.metadata,
      ...(options.successUrl && { successUrl: options.successUrl }),
      ...(options.cancelUrl && { cancelUrl: options.cancelUrl }),
    }
  }, {
    nullable: []  // POST operation: empty fields omitted, not sent as null
  })
  return apiPost<PaymentResponse>(`/billing/invoices/${invoiceId}/pay`, sanitized)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if merchant account has completed Stripe onboarding
 */
export function isOnboardingComplete(account: MerchantAccount | null): boolean {
  return account?.metadata?.onboardingComplete === true
}

/**
 * Check if merchant account can access Stripe dashboard
 */
export function canAccessDashboard(account: MerchantAccount | null): boolean {
  return account?.metadata?.dashboardAccessEnabled === true
}

/**
 * Get account setup status for display
 */
export function getAccountSetupStatus(
  account: MerchantAccount | null
): 'none' | 'incomplete' | 'complete' {
  if (!account) return 'none'
  if (!isOnboardingComplete(account)) return 'incomplete'
  return 'complete'
}

// ============================================================================
// Earnings Helper Functions
// ============================================================================

/**
 * Calculate total earnings from paid invoices
 */
export function calculateTotalEarnings(invoices: Invoice[]): number {
  return invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0) / 100
}

/**
 * Calculate earnings for a specific time period
 */
export function calculatePeriodEarnings(
  invoices: Invoice[],
  startDate: Date,
  endDate: Date
): number {
  return invoices
    .filter((inv) => {
      if (inv.status !== 'paid' || !inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= startDate && paidDate <= endDate
    })
    .reduce((sum, inv) => sum + inv.total, 0) / 100
}

/**
 * Count invoices by status
 */
export function countInvoicesByStatus(invoices: Invoice[], status: Invoice['status']): number {
  return invoices.filter((inv) => inv.status === status).length
}
