/**
 * useDashboardSummary — TanStack Query hook for the morning briefing
 *
 * Consolidates the 5 parallel fetches from MorningBriefing into a single
 * cached query. Returns appointments, summary metrics, and (for financial
 * roles) overdue invoices and daily collections.
 */
import { useQuery } from '@tanstack/react-query';
import {
  listAppointments,
  getDashboardSummary,
  listDentalInvoices,
} from '@monobase/sdk-ts/generated';
import type { DentalAppointment, DentalInvoice } from '@monobase/sdk-ts/generated';

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

function toAppointment(a: DentalAppointment): DashboardAppointment {
  const startAt = typeof a.startAt === 'string' ? a.startAt : (a.startAt as Date).toISOString();
  const endAt = a.endAt
    ? (typeof a.endAt === 'string' ? a.endAt : (a.endAt as Date).toISOString())
    : undefined;
  const durationMinutes = endAt
    ? Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000)
    : undefined;
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: (a as DentalAppointment & { patientName?: string }).patientName,
    scheduledAt: startAt,
    durationMinutes,
    status: a.status,
    serviceType: (a as DentalAppointment & { serviceType?: string }).serviceType,
  };
}

function toInvoice(inv: DentalInvoice): DashboardInvoice {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    patientId: inv.patientId,
    patientName: (inv as DentalInvoice & { patientName?: string }).patientName,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    balanceCents: inv.balanceCents,
    status: inv.status,
    dueDate: inv.dueDate
      ? (typeof inv.dueDate === 'string' ? inv.dueDate : (inv.dueDate as Date).toISOString().slice(0, 10))
      : undefined,
    createdAt: typeof inv.createdAt === 'string' ? inv.createdAt : (inv.createdAt as Date).toISOString(),
  };
}

async function fetchDashboardSummary(
  branchId: string,
  showFinancials: boolean,
): Promise<DashboardSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  // Parallel fetches via SDK — throwOnError propagates HTTP failures as SdkError
  const fetches: Promise<unknown>[] = [
    listAppointments({ query: { branchId, date_from: today, date_to: today }, throwOnError: true }),
    listAppointments({ query: { branchId, date_from: tomorrow, date_to: tomorrow }, throwOnError: true }),
    getDashboardSummary({ query: { branchId }, throwOnError: true }),
  ];

  if (showFinancials) {
    fetches.push(
      listDentalInvoices({ query: { status: 'overdue', branchId }, throwOnError: true }),
      listDentalInvoices({ query: { branchId }, throwOnError: true }),
    );
  }

  const results = await Promise.all(fetches);

  // Each SDK call returns { data } when throwOnError is true (throws on error, so data is defined here)
  const todayData = (results[0] as { data: unknown }).data;
  const tomorrowData = (results[1] as { data: unknown }).data;
  const summaryData = (results[2] as { data: unknown }).data as Record<string, unknown> | null;

  const toAppts = (raw: unknown): DashboardAppointment[] => {
    const arr = Array.isArray(raw) ? raw : ((raw as { appointments?: DentalAppointment[] })?.appointments ?? []);
    return (arr as DentalAppointment[]).map(toAppointment);
  };

  const todayAppointments = toAppts(todayData);
  const tomorrowAppointments = toAppts(tomorrowData);

  const activePaymentPlans = (summaryData?.activePaymentPlans as { count?: number } | null)?.count ?? null;
  const paymentPlansBehind = (summaryData?.activePaymentPlans as { behindCount?: number } | null)?.behindCount ?? null;
  const pendingLabOrders = (summaryData?.labOrders as { totalPending?: number } | null)?.totalPending ?? null;
  const overdueLabOrders = (summaryData?.labOrders as { overdueDelivery?: number } | null)?.overdueDelivery ?? null;

  let overdueInvoices: DashboardInvoice[] = [];
  let dailyCollectionsCents: number | null = null;

  if (showFinancials && results[3]) {
    const overdueRaw = (results[3] as { data: unknown }).data;
    const arr = Array.isArray(overdueRaw) ? overdueRaw : ((overdueRaw as { data?: DentalInvoice[] })?.data ?? []);
    overdueInvoices = (arr as DentalInvoice[]).map(toInvoice);
  }

  if (showFinancials && results[4]) {
    const allRaw = (results[4] as { data: unknown }).data;
    const arr = Array.isArray(allRaw) ? allRaw : ((allRaw as { data?: DentalInvoice[] })?.data ?? []);
    const allInvoices = (arr as DentalInvoice[]).map(toInvoice);
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
