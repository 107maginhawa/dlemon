/**
 * useDashboardSummary — TanStack Query hook for the morning briefing
 *
 * Consolidates the 5 parallel fetches from MorningBriefing into a single
 * cached query. Returns appointments, summary metrics, and (for financial
 * roles) overdue invoices and daily collections.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

export interface DashboardAppointment {
  id: string;
  patientId: string;
  patientName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  procedureType?: string;
}

export interface DashboardInvoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueDate?: string;
  createdAt: string;
}

export interface DashboardSummary {
  todayAppointments: DashboardAppointment[];
  tomorrowAppointments: DashboardAppointment[];
  overdueInvoices: DashboardInvoice[];
  /** Total peso-cents collected today; null when showFinancials=false */
  dailyCollectionsCents: number | null;
  activePaymentPlans: number | null;
  pendingLabOrders: number | null;
}

interface UseDashboardSummaryOptions {
  branchId: string;
  showFinancials: boolean;
}

function toAppointments(data: any): DashboardAppointment[] {
  if (Array.isArray(data)) return data;
  return data?.appointments ?? [];
}

async function fetchDashboardSummary(
  branchId: string,
  showFinancials: boolean,
): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const fetches: Promise<Response>[] = [
    fetch(`${API}/dental/appointments?date=${today}`, { credentials: 'include' }),
    fetch(`${API}/dental/appointments?date=${tomorrow}`, { credentials: 'include' }),
    fetch(`${API}/dental/dashboard/summary`, { credentials: 'include' }),
  ];

  if (showFinancials) {
    fetches.push(
      fetch(`${API}/dental/billing/invoices?status=overdue`, { credentials: 'include' }),
      fetch(`${API}/dental/billing/invoices?branchId=${encodeURIComponent(branchId)}`, { credentials: 'include' }),
    );
  }

  const responses = await Promise.all(fetches);

  if (!responses[0]!.ok || !responses[1]!.ok) {
    throw new Error('Failed to load appointments');
  }

  const todayData = await responses[0]!.json();
  const tomorrowData = await responses[1]!.json();
  const summaryData = responses[2]?.ok ? await responses[2].json() : null;

  const todayAppointments = toAppointments(todayData);
  const tomorrowAppointments = toAppointments(tomorrowData);

  const activePaymentPlans = summaryData?.activePaymentPlans?.count ?? null;
  const pendingLabOrders = summaryData?.labOrders?.totalPending ?? null;

  let overdueInvoices: DashboardInvoice[] = [];
  let dailyCollectionsCents: number | null = null;

  if (showFinancials && responses[3]) {
    if (responses[3].ok) {
      const invoiceData = await responses[3].json();
      overdueInvoices = Array.isArray(invoiceData) ? invoiceData : invoiceData.invoices ?? [];
    }
  }

  if (showFinancials && responses[4]) {
    if (responses[4].ok) {
      const allInvoicesData = await responses[4].json();
      const allInvoices: DashboardInvoice[] = Array.isArray(allInvoicesData)
        ? allInvoicesData
        : allInvoicesData.invoices ?? [];
      dailyCollectionsCents = allInvoices
        .filter((inv) => inv.status === 'paid' || inv.status === 'partial')
        .filter((inv) => inv.createdAt?.slice(0, 10) === today)
        .reduce((sum, inv) => sum + (inv.paidCents ?? inv.totalCents - inv.balanceCents), 0);
    }
  }

  return {
    todayAppointments,
    tomorrowAppointments,
    overdueInvoices,
    dailyCollectionsCents,
    activePaymentPlans,
    pendingLabOrders,
  };
}

export function useDashboardSummary({ branchId, showFinancials }: UseDashboardSummaryOptions) {
  const query = useQuery({
    queryKey: ['dashboard-summary', branchId, showFinancials],
    queryFn: () => fetchDashboardSummary(branchId, showFinancials),
    staleTime: 60_000, // 1 minute — dashboard data refreshes on focus/interval
    refetchOnWindowFocus: true,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
