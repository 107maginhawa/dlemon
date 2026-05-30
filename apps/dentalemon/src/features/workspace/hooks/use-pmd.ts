/**
 * usePMD — TanStack Query hook for fetching the PMD document for a visit
 *
 * API: GET /dental/visits/:visitId/pmd
 * Returns the PMDDocument for the given visitId, or null if not found.
 */
import { useQuery } from '@tanstack/react-query';
import { getPmdForVisitOptions } from '@monobase/sdk-ts/generated/react-query';
import { SdkError } from '@monobase/sdk-ts/client';
import type { PmdDocument } from '@monobase/sdk-ts/generated';
import type { PMDDocument } from '@/features/pmd/types';

export function usePMD(visitId: string | null) {
  const options = getPmdForVisitOptions({ path: { visitId: visitId as string } });
  // Pin the generics: queryFn yields the generated `PmdDocument | null` (the
  // 404→null contract widens the union), `select` maps that to the app-facing
  // `PMDDocument | null`. Without explicit generics the null widening defeats
  // the useQuery overload and `data` silently falls back to `PmdDocument`.
  return useQuery<PmdDocument | null, Error, PMDDocument | null, typeof options.queryKey>({
    queryKey: options.queryKey,
    // A visit with no PMD yet returns 404 — that's "none", not an error. Honor
    // the documented "null if not found" contract (matches app.tsx person-404).
    queryFn: async (ctx) => {
      try {
        return await options.queryFn!(ctx);
      } catch (error) {
        if (error instanceof SdkError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: !!visitId,
    retry: false,
    select: (data) => (data ? (data as unknown as PMDDocument) : null),
  });
}
