/**
 * useVisits — TanStack Query hook for patient visits
 *
 * Replaces the broken use-visit.ts (which always returned null).
 * Returns the full visit list plus a convenience activeVisit derived value.
 *
 * API: GET /dental/visits?patientId=
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

export interface Visit {
  id: string;
  patientId: string;
  status: 'draft' | 'active' | 'completed' | 'locked';
  chiefComplaint?: string;
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
  lockedAt?: string;
}

interface UseVisitsOptions {
  patientId: string;
  branchId?: string | null;
}

export function useVisits({ patientId, branchId }: UseVisitsOptions) {
  const query = useQuery({
    queryKey: ['dental-visits', patientId, branchId],
    queryFn: async (): Promise<Visit[]> => {
      const params = new URLSearchParams();
      params.set('patientId', patientId);
      if (branchId) params.set('branchId', branchId);
      const res = await fetch(
        `${apiBaseUrl}/dental/visits?${params.toString()}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to fetch visits (${res.status})`);
      const data = await res.json();
      const items: Visit[] = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
      return items;
    },
    enabled: !!patientId,
  });

  const visits = query.data ?? [];
  const activeVisit = visits.find((v) => v.status === 'active') ?? null;

  return {
    visits,
    activeVisit,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
