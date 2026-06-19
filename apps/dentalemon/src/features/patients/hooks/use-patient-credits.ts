/**
 * usePatientCredits — patient credit ledger query + add/apply mutations (Phase 4.1).
 *
 * GET ledger (balance + rows), POST a new credit, and POST apply-credit against
 * an invoice. Add/apply invalidate the ledger (and the caller refetches the
 * invoice list) so balances stay consistent.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPatientCreditsOptions,
  getPatientCreditsQueryKey,
} from '@monobase/sdk-ts/generated/react-query';
import { addPatientCredit, applyCreditToInvoice } from '@monobase/sdk-ts/generated';

export function usePatientCredits(patientId: string) {
  const queryClient = useQueryClient();
  const key = getPatientCreditsQueryKey({ path: { patientId } });

  const query = useQuery({
    ...getPatientCreditsOptions({ path: { patientId } }),
    enabled: Boolean(patientId),
    staleTime: 15_000,
  });

  const add = useMutation({
    mutationFn: async (input: { amountCents: number; source: string; note?: string }) => {
      const { data } = await addPatientCredit({ path: { patientId }, body: input, throwOnError: true });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const apply = useMutation({
    mutationFn: async (input: { invoiceId: string; amountCents: number }) => {
      const { data } = await applyCreditToInvoice({
        path: { invoiceId: input.invoiceId },
        body: { amountCents: input.amountCents },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    balanceCents: query.data?.balanceCents ?? 0,
    credits: query.data?.credits ?? [],
    isLoading: query.isLoading,
    addCredit: add.mutateAsync,
    isAdding: add.isPending,
    addError: add.error as Error | null,
    applyCredit: apply.mutateAsync,
    isApplying: apply.isPending,
    applyError: apply.error as Error | null,
  };
}
