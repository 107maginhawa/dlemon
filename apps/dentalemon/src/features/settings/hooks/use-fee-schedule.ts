/**
 * useFeeSchedule — TanStack Query hooks for the DEDICATED fee-schedule endpoint
 *
 *   GET   /dental/fee-schedule?branchId=...   — active CDT catalog + effective prices
 *   PATCH /dental/fee-schedule/{cdt}          — set a per-branch price (owner-only)
 *
 * This is the canonical fee store (dental-org G2 / decision §5 = DRIVE pricing).
 * Treatment/invoice line prices default from it server-side (closes AC-ORG-002).
 * The Fee Schedule UI must read/write HERE, not the `settings` blob — the blob is
 * not consumed by pricing, so a blob save was a no-op success toast.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFeeScheduleOptions,
  getFeeScheduleQueryKey,
  updateFeeScheduleEntryMutation,
} from '@monobase/sdk-ts/generated/react-query';
import type { DentalFeeScheduleModuleFeeScheduleEntry } from '@monobase/sdk-ts/generated';

export type FeeScheduleEntry = DentalFeeScheduleModuleFeeScheduleEntry;

export function useFeeSchedule(branchId: string | null) {
  const query = useQuery({
    ...getFeeScheduleOptions({ query: { branchId: branchId! } }),
    enabled: !!branchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    select: (data): FeeScheduleEntry[] =>
      ((data as { data?: FeeScheduleEntry[] })?.data ?? []),
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
  };
}

export function useUpdateFeeScheduleEntry(branchId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...updateFeeScheduleEntryMutation(),
    onSuccess: () => {
      if (branchId) {
        queryClient.invalidateQueries({
          queryKey: getFeeScheduleQueryKey({ query: { branchId } }),
        });
      }
    },
  });

  return {
    /** Set a single CDT code's per-branch price. */
    update: (cdtCode: string, priceCents: number) => {
      if (!branchId) return Promise.reject(new Error('No branch selected'));
      return mutation.mutateAsync({
        path: { cdt: cdtCode },
        body: { branchId, priceCents },
      });
    },
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  };
}
