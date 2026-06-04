/**
 * useDashboardSummary — TanStack Query hook for the morning briefing
 *
 * Consolidates the 5 parallel fetches from MorningBriefing into a single
 * cached query. Returns appointments, summary metrics, and (for financial
 * roles) overdue invoices and daily collections.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/lib/config';

const API = apiBaseUrl;

export interface DashboardAppointment {
  id: string;
  patientId: string;
  patientName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  serviceType?: string;
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
  /** Number of payment plans with "behind" status */
  paymentPlansBehind: number | null;
  pendingLabOrders: number | null;
  /** Lab orders past their expected delivery date */
  overdueLabOrders: number | null;
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

  const b = encodeURIComponent(branchId);
  const fetches: Promise<Response>[] = [
    fetch(`${API}/dental/appointments?date_from=${today}&date_to=${today}&branchId=${b}`, { credentials: 'include' }),
    fetch(`${API}/dental/appointments?date_from=${tomorrow}&date_to=${tomorrow}&branchId=${b}`, { credentials: 'include' }),
    fetch(`${API}/dental/dashboard/summary?branchId=${b}`, { credentials: 'include' }),
  ];

  if (showFinancials) {
    fetches.push(
      fetch(`${API}/dental/billing/invoices?status=overdue&branchId=${b}`, { credentials: 'include' }),
      fetch(`${API}/dental/billing/invoices?branchId=${b}`, { credentials: 'include' }),
    );
  }

  const responses = await Promise.all(fetches);

  // Check ALL responses — no silent swallowing on any fetch failure
  const labels = [
    'today appointments',
    'tomorrow appointments',
    'dashboard summary',
    'overdue invoices',
    'all invoices',
  ];
  for (let i = 0; i < responses.length; i++) {
    if (!responses[i]!.ok) {
      throw new Error(
        `Failed to load ${labels[i] ?? `response[${i}]`} (HTTP ${responses[i]!.status})`,
      );
    }
  }

  const todayData = await responses[0]!.json();
  const tomorrowData = await responses[1]!.json();
  const summaryData = await responses[2]!.json();

  const todayAppointments = toAppointments(todayData);
  const tomorrowAppointments = toAppointments(tomorrowData);

  const activePaymentPlans = summaryData?.activePaymentPlans?.count ?? null;
  const paymentPlansBehind = summaryData?.activePaymentPlans?.behindCount ?? null;
  const pendingLabOrders = summaryData?.labOrders?.totalPending ?? null;
  const overdueLabOrders = summaryData?.labOrders?.overdueDelivery ?? null;

  let overdueInvoices: DashboardInvoice[] = [];
  let dailyCollectionsCents: number | null = null;

  if (showFinancials && responses[3]) {
    const invoiceData = await responses[3].json();
    overdueInvoices = Array.isArray(invoiceData) ? invoiceData : invoiceData.invoices ?? [];
  }

  if (showFinancials && responses[4]) {
    const allInvoicesData = await responses[4].json();
    const allInvoices: DashboardInvoice[] = Array.isArray(allInvoicesData)
      ? allInvoicesData
      : allInvoicesData.invoices ?? [];
    dailyCollectionsCents = allInvoices
      .filter((inv) => inv.status === 'paid' || inv.status === 'partial')
      .filter((inv) => inv.createdAt?.slice(0, 10) === today)
      .reduce((sum, inv) => sum + (inv.paidCents ?? inv.totalCents - inv.balanceCents), 0);
  }

  return {
    todayAppointments,
    tomorrowAppointments,
    overdueInvoices,
    dailyCollectionsCents,
    activePaymentPlans,
    paymentPlansBehind,
    pendingLabOrders,
    overdueLabOrders,
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
