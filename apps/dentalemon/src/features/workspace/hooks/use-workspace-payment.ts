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
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

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

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchPatientInvoices(patientId: string): Promise<WorkspaceInvoice[]> {
  const url = `${API}/dental/billing/invoices?patientId=${encodeURIComponent(patientId)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.invoices ?? data.data ?? []);
}

// ---------------------------------------------------------------------------
// Create invoice
// ---------------------------------------------------------------------------

export interface CreateInvoiceInput {
  patientId: string;
  visitId?: string;
  dueDate?: string;
}

async function createInvoice(input: CreateInvoiceInput): Promise<WorkspaceInvoice> {
  const res = await fetch(`${API}/dental/billing/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create invoice (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePatientInvoices(patientId: string | null) {
  return useQuery({
    queryKey: ['workspace-invoices', patientId],
    queryFn: () => fetchPatientInvoices(patientId!),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateInvoice(patientId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),
    onSuccess: () => {
      // Invalidate both the workspace-scoped key and the billing list key so
      // PAY-02 status banner updates immediately after invoice creation
      qc.invalidateQueries({ queryKey: ['workspace-invoices', patientId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
