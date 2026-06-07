/**
 * usePerioHistory — a patient's finalized perio charts for multi-exam comparison.
 *
 * GET /dental/perio-charts?patientId=  → { data: PerioChart[] } (newest first,
 * completed/locked only, each with readings). Read-only; cached by patient.
 */

import { useQuery } from '@tanstack/react-query';
import {
  listPerioChartsForPatient,
} from '@monobase/sdk-ts/generated';
import { listPerioChartsForPatientQueryKey } from '@monobase/sdk-ts/generated/react-query';
import type { PerioChart } from '@monobase/sdk-ts/generated';

interface UsePerioHistoryArgs {
  patientId: string;
  enabled?: boolean;
}

export function usePerioHistory({ patientId, enabled = true }: UsePerioHistoryArgs) {
  const query = useQuery({
    queryKey: listPerioChartsForPatientQueryKey({ query: { patientId } }),
    queryFn: async (): Promise<PerioChart[]> => {
      const result = await listPerioChartsForPatient({ query: { patientId } });
      const response = result.response;
      if (!response?.ok) {
        throw new Error(`Failed to load perio history (${response?.status ?? 0})`);
      }
      const data = result.data as { data?: PerioChart[] } | string | undefined;
      if (data && typeof data === 'object' && Array.isArray((data as { data?: PerioChart[] }).data)) {
        return (data as { data: PerioChart[] }).data;
      }
      // Test/dev fallback: SDK returned the raw JSON body as a string.
      if (typeof data === 'string' && data) {
        try {
          const parsed = JSON.parse(data) as { data?: PerioChart[] };
          if (Array.isArray(parsed.data)) return parsed.data;
        } catch {
          /* fall through */
        }
      }
      return [];
    },
    enabled: enabled && Boolean(patientId),
  });

  return {
    charts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
