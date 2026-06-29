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
  getCollectionsSummary,
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
  /** Total peso-cents collected month-to-date (the momentum number); null when showFinancials=false */
  monthCollectedCents: number | null;
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
    // The wire DTO exposes visitType (general/checkup/emergency/…), not a
    // free-text serviceType — surface it as the row's service label.
    serviceType: a.visitType,
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

  // Schedule fetches — every dashboard role may read appointments, so a failure
  // here IS a real dashboard error (propagated as SdkError via throwOnError).
  const todayPromise = listAppointments({ query: { branchId, date_from: today, date_to: today }, throwOnError: true });
  const tomorrowPromise = listAppointments({ query: { branchId, date_from: tomorrow, date_to: tomorrow }, throwOnError: true });

  // getDashboardSummary is OWNER-ONLY on the backend (assertBranchRole
  // ['dentist_owner']). The morning briefing is shown to 8 non-owner roles, so a
  // 403 here must NOT reject the whole query and blank the dashboard — degrade to
  // null metrics and let the schedule render. (G-dashboard-nonowner-summary-403)
  // ponytail: tolerate the failure in-place rather than threading the exact role
  //   through; one catch also covers the owner/associate gate mismatch + transient errors.
  const summaryPromise = getDashboardSummary({ query: { branchId } })
    .then((r) => ((r as { data?: unknown }).data ?? null) as Record<string, unknown> | null)
    .catch(() => null);

  // Financial invoice fetches — only requested for financial roles, who can read
  // them; a failure there is a real error worth surfacing.
  const overduePromise = showFinancials
    ? listDentalInvoices({ query: { status: 'overdue', branchId }, throwOnError: true })
    : null;

  // Month-to-date collected — the motivating "how are we doing" number. Reuses
  // the existing collections-summary endpoint (period=month → totalCollectedCents).
  // Fully isolated: this enhancement must NEVER reject the main query or blank the
  // page, so it swallows sync throws and rejections alike → null.
  const monthCollectedPromise: Promise<number | null> = (async () => {
    if (!showFinancials) return null;
    try {
      const r = await getCollectionsSummary({ query: { branchId, period: 'month' } });
      return (r as { data?: { totalCollectedCents?: number } }).data?.totalCollectedCents ?? null;
    } catch {
      return null;
    }
  })();

  // Await the schedule + financial fetches together so any rejection is jointly
  // handled (a sequential await would orphan a sibling's rejection). The
  // owner-only summary is awaited separately — it never rejects (own .catch).
  const [todayResult, tomorrowResult, overdueResult] = await Promise.all([
    todayPromise,
    tomorrowPromise,
    overduePromise ?? Promise.resolve(null),
  ]);
  const summaryData = await summaryPromise;
  const monthCollectedCents = await monthCollectedPromise;

  const todayData = (todayResult as { data: unknown }).data;
  const tomorrowData = (tomorrowResult as { data: unknown }).data;

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

  if (showFinancials && overdueResult) {
    const overdueRaw = (overdueResult as { data: unknown }).data;
    const arr = Array.isArray(overdueRaw) ? overdueRaw : ((overdueRaw as { data?: DentalInvoice[] })?.data ?? []);
    overdueInvoices = (arr as DentalInvoice[]).map(toInvoice);
  }

  return {
    todayAppointments,
    tomorrowAppointments,
    overdueInvoices,
    monthCollectedCents,
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
