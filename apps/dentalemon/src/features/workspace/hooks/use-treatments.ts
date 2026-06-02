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
      const raw = data as unknown as { data?: Treatment[] } | Treatment[];
      const items: Treatment[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return items;
    },
  });

  return {
    treatments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
