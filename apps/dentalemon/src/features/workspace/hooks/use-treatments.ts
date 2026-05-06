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
import type { ToothSurface } from '@/features/workspace/components/five-surface-selector.helpers';
import { apiBaseUrl } from '@/utils/config';

export interface Treatment {
  id: string;
  visitId: string;
  toothNumber: number;
  surfaces?: ToothSurface[];
  procedureCode: string;
  procedureName: string;
  cdtCode?: string;
  description?: string;
  status: 'diagnosed' | 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priceAmount: number;
  currency: string;
  conditionCode?: string | null;
  note?: string;
  createdAt: string;
}

interface UseTreatmentsOptions {
  visitId: string | null;
}

export function useTreatments({ visitId }: UseTreatmentsOptions) {
  const query = useQuery({
    queryKey: ['dental-treatments', visitId],
    queryFn: async (): Promise<Treatment[]> => {
      const res = await fetch(
        `${apiBaseUrl}/dental/visits/${visitId}/treatments`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch treatments (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : (data.items ?? data.data ?? []);
    },
    enabled: !!visitId,
  });

  return {
    treatments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
