/**
 * usePMD — TanStack Query hook for fetching the PMD document for a visit
 *
 * API: GET /dental/visits/:visitId/pmd
 * Returns the PMDDocument for the given visitId, or null if not found.
 */
import { useQuery } from '@tanstack/react-query';
import { getPmdForVisitOptions } from '@monobase/sdk-ts/generated/react-query';
import type { PMDDocument } from '@/features/pmd/types';

export function usePMD(visitId: string | null) {
  return useQuery({
    ...getPmdForVisitOptions({
      path: { visitId: visitId as string },
    }),
    enabled: !!visitId,
    retry: false,
    select: (data) => data as unknown as PMDDocument,
  });
}
