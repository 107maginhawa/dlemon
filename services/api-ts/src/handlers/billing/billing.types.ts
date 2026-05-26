/**
 * Typed metadata shapes for billing JSONB columns.
 * Used in invoice and merchant account schemas to replace `as any` casts.
 */

export interface InvoiceMetadata {
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeTransferId?: string;
  providerDecision?: 'capture' | 'void';
  providerDecisionAt?: string;
  refundAmount?: string;
  refundStatus?: 'full_refund' | 'partial_refund';
  refundReason?: string;
  refundedAt?: string;
  stripeRefundId?: string;
  [key: string]: unknown;
}

export interface MerchantMetadata {
  stripeAccountId?: string;
  stripeAccountStatus?: string;
  onboardingComplete?: boolean;
  lastWebhookUpdate?: string;
  accountChargesEnabled?: boolean;
  accountPayoutsEnabled?: boolean;
  requirementsCurrentlyDue?: string[];
  deauthorizedAt?: string;
  [key: string]: unknown;
}
