/**
 * useVisits — TanStack Query hook for patient visits
 *
 * Replaces the broken use-visit.ts (which always returned null).
 * Returns the full visit list plus a convenience activeVisit derived value.
 *
 * API: GET /dental/visits?patientId=
 */
import { useQuery } from '@tanstack/react-query';
import { listDentalVisitsOptions } from '@monobase/sdk-ts/generated/react-query';

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
    ...listDentalVisitsOptions({
      query: {
        patientId: patientId as string,
        ...(branchId ? { branchId: branchId as string } : {}),
      },
    }),
    enabled: !!patientId,
    select: (data) => {
      const raw = data as unknown as { data?: Visit[] } | Visit[];
      const items: Visit[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      return items;
    },
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
