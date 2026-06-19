/**
 * useCollections — AR aging query + batch-statement mutation (P2-14).
 *
 * `useArAging` loads the branch's accounts-receivable aging (current/30/60/90+
 * buckets per patient + summary). `useStatementBatch` triggers a batch
 * statement run and invalidates the aging cache on success.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getArAgingOptions,
  getArAgingQueryKey,
  getCollectionsWorklistOptions,
  getCollectionsWorklistQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import {
  generateStatementBatch,
  sendPatientStatement,
  createCollectionNote,
  type ArAgingResponse,
  type GenerateStatementBatchResponse,
  type CollectionsWorklistResponse,
  type CreateCollectionNoteRequest,
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
export type CollectionsWorklist = CollectionsWorklistResponse;

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

/**
 * BR-050: manual "send statement" — enqueue a patient's current statement
 * (email + push). Tracks which patient is sending so a per-row button can show
 * its own pending/sent state. Invalidates aging on success.
 */
export function useSendStatement({ branchId }: UseArAgingOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (patientId: string) => {
      const { data } = await sendPatientStatement({
        path: { patientId },
        body: { branchId: branchId ?? undefined },
        throwOnError: true,
      });
      return data; // { patientId, sent, outstandingBalanceCents, channels }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getArAgingQueryKey({ query: { branchId: branchId ?? undefined } }) });
    },
  });

  return {
    send: mutation.mutateAsync,
    sendingPatientId: mutation.isPending ? mutation.variables ?? null : null,
    lastSent: mutation.data ?? null,
    error: mutation.error as Error | null,
  };
}

/** Phase 2.4: the actionable overdue-patient worklist (branch-scoped). */
export function useCollectionsWorklist({ branchId }: UseArAgingOptions) {
  const query = useQuery({
    ...getCollectionsWorklistOptions({ query: { branchId: branchId ?? undefined } }),
    enabled: Boolean(branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    worklist: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Phase 2.4: log a collections outreach note; refreshes the worklist on success. */
export function useLogCollectionNote({ branchId }: UseArAgingOptions) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: Omit<CreateCollectionNoteRequest, 'branchId'>) => {
      const { data } = await createCollectionNote({
        body: { ...input, branchId: branchId ?? undefined },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getCollectionsWorklistQueryKey({ query: { branchId: branchId ?? undefined } }) });
    },
  });

  return {
    logNote: mutation.mutateAsync,
    isLogging: mutation.isPending,
    error: mutation.error as Error | null,
  };
}
