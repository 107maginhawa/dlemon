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
import { createDentalInvoice, issueDentalInvoice } from '@monobase/sdk-ts/generated';
import { toastError } from '@/lib/error-toast';
import { useOrgContextStore } from '@/stores/org-context.store';
import { type Invoice } from '@/features/billing/hooks/use-invoices';

// Cause-fix (oli QA_ESCAPES §6): this hook hits the SAME endpoint as
// use-invoices.ts, so it consumes that hook's proven SDK-derived type instead of
// re-declaring its own + casting. `Invoice` = DentalInvoice intersected for the
// two live-confirmed enrichments the (stale) SDK omits (patientName, visitDate).
export type WorkspaceInvoice = Invoice;

export interface CreateInvoiceInput {
  visitId: string;
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
    // The SDK response is { data: DentalInvoice[]; pagination }. Single `as` widens
    // to the documented enrichment shape — no blind `as unknown as` (GAP-D).
    select: (data) => {
      const items = Array.isArray(data) ? data : (data?.data ?? []);
      return items as WorkspaceInvoice[];
    },
    enabled: Boolean(patientId && branchId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateInvoice(patientId: string | null) {
  const qc = useQueryClient();
  // QA-008 (request-side contract-drift): POST /dental/billing/invoices REQUIRES
  // branchId + dentistMemberId (CreateDentalInvoiceRequest; live-confirmed 400
  // "branchId/dentistMemberId required" 2026-06-04). The previous body was only
  // { patientId, visitId } wrapped in `as any`, so the cast hid that the
  // "Create Invoice & Pay" button always failed. Source branch + member from org
  // context (same fix shape as QA-004) and build the full, SDK-typed body.
  const branchId = useOrgContextStore((s) => s.branchId);
  const dentistMemberId = useOrgContextStore((s) => s.memberId);
  return useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      if (!patientId || !branchId || !dentistMemberId) {
        throw new Error('Missing patient, branch, or member context — cannot create invoice.');
      }
      const { data } = await createDentalInvoice({
        body: {
          patientId,
          visitId: input.visitId,
          branchId,
          dentistMemberId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        },
        throwOnError: true,
      });
      // G-08: issue immediately so the "Create Invoice & Pay" CTA lands on a payable
      // invoice. createDentalInvoice yields status='draft' and recordDentalPayment
      // rejects draft (INVALID_STATUS_TRANSITION 'issue it first') — so without this
      // the CTA over-promised and stranded the user on an Issue step. Surfacing an
      // issue failure (no swallow) keeps the create+issue an all-or-nothing promise.
      if (data?.id) {
        await issueDentalInvoice({
          path: { invoiceId: data.id },
          throwOnError: true,
        });
      }
      return data;
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
