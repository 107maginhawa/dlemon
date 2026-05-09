/**
 * usePMD — TanStack Query hook for fetching the PMD document for a visit
 *
 * API: GET /dental/visits/:visitId/pmd
 * Returns the PMDDocument for the given visitId, or null if not found.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
import type { PMDDocument } from '@/features/pmd/types';

async function fetchPMD(visitId: string): Promise<PMDDocument | null> {
  const res = await fetch(`${apiBaseUrl}/dental/visits/${visitId}/pmd`, {
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch PMD: ${res.status}`);
  return res.json();
}

export function usePMD(visitId: string | null) {
  return useQuery({
    queryKey: ['pmd', visitId],
    queryFn: () => fetchPMD(visitId!),
    enabled: !!visitId,
    retry: false,
  });
}
