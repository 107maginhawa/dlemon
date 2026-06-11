/**
 * usePaymentReceipt — GET /dental/billing/invoices/{invoiceId}/payments/{paymentId}/receipt
 *
 * Returns the structured (contract-reconciled, nested) receipt for one payment,
 * including void info for the EC5 VOIDED-watermark reprint. FR4.6.
 */
import { useQuery } from '@tanstack/react-query';
import { getDentalPaymentReceiptOptions } from '@monobase/sdk-ts/generated/react-query';
import type { DentalPaymentReceiptResponse } from '@monobase/sdk-ts/generated';

export type PaymentReceipt = DentalPaymentReceiptResponse;

export function usePaymentReceipt(invoiceId: string, paymentId: string) {
  const query = useQuery({
    ...getDentalPaymentReceiptOptions({ path: { invoiceId, paymentId } }),
    enabled: !!invoiceId && !!paymentId,
    staleTime: 60_000,
  });

  return {
    receipt: (query.data ?? null) as PaymentReceipt | null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
