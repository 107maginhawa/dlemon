/**
 * useCollections — AR aging query + batch-statement mutation (P2-14).
 *
 * `useArAging` loads the branch's accounts-receivable aging (current/30/60/90+
 * buckets per patient + summary). `useStatementBatch` triggers a batch
 * statement run and invalidates the aging cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArAgingOptions, getArAgingQueryKey } from '@monobase/sdk-ts/generated/react-query';
import {
  generateStatementBatch,
  type ArAgingResponse,
  type GenerateStatementBatchResponse,
} from '@monobase/sdk-ts/generated';

interface UseArAgingOptions {
  branchId?: string | null;
}

// Cause-fix (oli QA_ESCAPES §6): the generated SDK fully and accurately models
// both responses (live-confirmed against GET /dental/billing/collections/aging
// and the statement-batch run, 2026-06-04), so the previous local re-declarations
// + `as unknown as` casts were gratuitous type-blinding. Consume the SDK types
// directly. Re-exported under the historical names for existing imports.
// NOTE: `asOf` is a Date at runtime (the SDK date transformer converts it) — do
// not treat it as a string.
export type ArAgingData = ArAgingResponse;
export type StatementBatchResult = GenerateStatementBatchResponse;

export function useArAging({ branchId }: UseArAgingOptions) {
  const query = useQuery({
    ...getArAgingOptions({ query: { branchId: branchId ?? undefined } }),
    enabled: Boolean(branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    aging: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export function useStatementBatch({ branchId }: UseArAgingOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (opts?: { patientIds?: string[]; includeZeroBalance?: boolean }) => {
      const { data } = await generateStatementBatch({
        body: {
          branchId: branchId ?? undefined,
          patientIds: opts?.patientIds,
          includeZeroBalance: opts?.includeZeroBalance,
        },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getArAgingQueryKey({ query: { branchId: branchId ?? undefined } }) });
    },
  });

  return {
    generate: mutation.mutateAsync,
    isGenerating: mutation.isPending,
    result: mutation.data ?? null,
    error: mutation.error as Error | null,
  };
}
