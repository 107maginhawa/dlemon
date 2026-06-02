/**
 * useCollections — AR aging query + batch-statement mutation (P2-14).
 *
 * `useArAging` loads the branch's accounts-receivable aging (current/30/60/90+
 * buckets per patient + summary). `useStatementBatch` triggers a batch
 * statement run and invalidates the aging cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArAgingOptions, getArAgingQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { generateStatementBatch } from '@monobase/sdk-ts/generated';
import type { AgingRow, AgingSummary, StatementRow } from '../components/collections-view.helpers';

interface UseArAgingOptions {
  branchId?: string | null;
}

export interface ArAgingData {
  asOf: string;
  summary: AgingSummary;
  patients: AgingRow[];
}

export function useArAging({ branchId }: UseArAgingOptions) {
  const query = useQuery({
    ...getArAgingOptions({ query: { branchId: branchId ?? undefined } }),
    enabled: Boolean(branchId),
    select: (data) => data as unknown as ArAgingData,
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

export interface StatementBatchResult {
  batchId: string;
  asOf: string;
  statementCount: number;
  totalBalanceCents: number;
  statements: StatementRow[];
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
      return data as unknown as StatementBatchResult;
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
