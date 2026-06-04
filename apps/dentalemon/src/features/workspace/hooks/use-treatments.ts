/**
 * useTreatments — TanStack Query hook for visit treatments
 *
 * Fetches the treatment plan for a given visit.
 * Fixes the treatment status bug: backend now uses 'diagnosed' | 'planned'
 * (not the old 'proposed' status).
 *
 * API: GET /dental/visits/:visitId/treatments
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalTreatmentsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { ToothSurface } from '@/features/workspace/components/five-surface-selector.helpers';

export interface Treatment {
  id: string;
  visitId: string;
  toothNumber: number;
  surfaces?: ToothSurface[];
  procedureCode: string;
  procedureName: string;
  cdtCode?: string;
  description?: string;
  status: 'diagnosed' | 'planned' | 'performed' | 'verified' | 'dismissed' | 'declined';
  priceAmount: number;
  currency: string;
  conditionCode?: string | null;
  note?: string;
  clinicalNotes?: string | null;
  createdAt: string;
  /** P1-21: the scheduled appointment this planned item is booked into, if any. */
  appointmentId?: string | null;
}

interface UseTreatmentsOptions {
  visitId: string | null;
}

export function useTreatments({ visitId }: UseTreatmentsOptions) {
  const query = useQuery({
    ...listDentalTreatmentsOptions({
      path: { visitId: visitId as string },
    }),
    enabled: !!visitId,
    select: (data) => {
      // Contract drift fix (QA-002): the API returns `priceCents` (integer cents,
      // locked at recording time — see SDK DentalTreatment), but FE Treatment models
      // `priceAmount` in dollars. Nothing mapped it, so `priceAmount` was always
      // undefined → every breakdown price, visit subtotal/total, and payment-modal
      // line item rendered ₱0. Derive priceAmount from priceCents at this single
      // read boundary so all consumers get a real price.
      const raw = data as unknown as
        | { data?: Array<Treatment & { priceCents?: number }> }
        | Array<Treatment & { priceCents?: number }>;
      const rawItems = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return rawItems.map((it): Treatment => ({
        ...it,
        priceAmount:
          typeof it.priceAmount === 'number'
            ? it.priceAmount
            : (it.priceCents ?? 0) / 100,
      }));
    },
  });

  return {
    treatments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
