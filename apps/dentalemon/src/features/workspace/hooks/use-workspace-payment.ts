/**
 * useWorkspacePayment — fetch/create invoices scoped to the workspace patient
 *
 * PAY-01: initiate payment — createInvoice mutation
 * PAY-02: view status — latestInvoice derived from invoices list
 *
 * API: GET /dental/billing/invoices?patientId=
 *      POST /dental/billing/invoices
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listDentalInvoicesOptions, listDentalInvoicesQueryKey } from '@monobase/sdk-ts/generated/react-query';
import { createDentalInvoice } from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';
import { useOrgContextStore } from '@/stores/org-context.store';

export interface WorkspaceInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  visitDate?: string;
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  createdAt: string;
}

export interface CreateInvoiceInput {
  patientId: string;
  visitId?: string;
  dueDate?: string;
}

export function usePatientInvoices(patientId: string | null) {
  // QA-004: the invoices endpoint REQUIRES branchId (400 "branchId is required"
  // without it). Sibling hooks (usePatientBilling, use-invoices) pass it; this
  // one omitted it → 400, which the payment modal swallowed into a false-empty
  // "no invoices" while a real draft invoice exists. Read the current branch from
  // org context and gate the query on it (don't fire a guaranteed-400 request).
  const branchId = useOrgContextStore((s) => s.branchId);
  return useQuery({
    ...listDentalInvoicesOptions({
      query: { patientId: patientId ?? undefined, branchId: branchId ?? undefined },
    }),
    select: (data) => {
      if (Array.isArray(data)) return data as unknown as WorkspaceInvoice[];
      const obj = data as Record<string, unknown>;
      const items = obj.data ?? obj.invoices ?? [];
      return (Array.isArray(items) ? items : []) as unknown as WorkspaceInvoice[];
    },
    enabled: Boolean(patientId && branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateInvoice(patientId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const { data } = await createDentalInvoice({ body: input as Parameters<typeof createDentalInvoice>[0]['body'], throwOnError: true } as any);
      return data as unknown as WorkspaceInvoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listDentalInvoicesQueryKey({ query: { patientId: patientId ?? undefined } }) });
    },
    // V-FE-ERR-001: surface invoice-creation failures instead of swallowing them.
    onError: (err) => {
      toastError(err, 'Failed to create invoice. Please try again.');
    },
  });
}
