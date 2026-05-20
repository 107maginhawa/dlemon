/**
 * useToothHistory — fetches per-tooth history across all completed/locked visits
 *
 * Thin wrapper around the generated SDK getToothHistoryOptions.
 * GET /dental/visits/history/{patientId}/teeth/{toothNumber}
 *
 * Note: The generated SDK type has query?: never so branchId/limit/offset cannot
 * be forwarded via the SDK. The backend handler uses defaults (limit=20, offset=0).
 */
import { useQuery } from '@tanstack/react-query';
import { getToothHistoryOptions } from '@monobase/sdk-ts/generated/react-query';

interface UseToothHistoryOptions {
  patientId: string | null;
  toothNumber: number | null;
}

export function useToothHistory({ patientId, toothNumber }: UseToothHistoryOptions) {
  const query = useQuery({
    ...getToothHistoryOptions({
      path: { patientId: patientId!, toothNumber: toothNumber! },
    }),
    enabled: !!patientId && !!toothNumber,
  });

  return {
    history: query.data?.data ?? [],
    total: query.data?.pagination.totalCount ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}
