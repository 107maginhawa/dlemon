/**
 * useInvoices — TanStack Query hook for the billing list
 *
 * Loads invoices with optional status and branchId filters.
 * Query key includes both filters so the cache is keyed per-filter-combination.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

export interface Invoice {
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

interface UseInvoicesOptions {
  branchId?: string;
  status?: string;
}

async function fetchInvoices(branchId?: string, status?: string): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (branchId) params.set('branchId', branchId);
  const qs = params.toString();
  const url = `${API}/dental/billing/invoices${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);

  const data = await res.json();
  return Array.isArray(data) ? data : data.invoices ?? [];
}

export function useInvoices({ branchId, status }: UseInvoicesOptions) {
  const query = useQuery({
    queryKey: ['invoices', branchId ?? null, status ?? null],
    queryFn: () => fetchInvoices(branchId, status),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    invoices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
