export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatTodayDate(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function calcTrend(today: number, yesterday: number): string {
  if (yesterday === 0 && today === 0) return '—';
  if (yesterday === 0) return '+100%';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

export function groupAppointmentsByStatus(appointments: { status: string }[]): {
  done: typeof appointments;
  now: typeof appointments;
  upcoming: typeof appointments;
} {
  const done: typeof appointments = [];
  const now: typeof appointments = [];
  const upcoming: typeof appointments = [];

  for (const appt of appointments) {
    switch (appt.status) {
      case 'completed':
      case 'no_show':
        done.push(appt);
        break;
      case 'checked_in':
        now.push(appt);
        break;
      case 'scheduled':
      default:
        upcoming.push(appt);
        break;
    }
  }

  return { done, now, upcoming };
}

export function getNextAppointment<T extends { status: string; scheduledAt: string }>(
  appointments: T[],
): T | null {
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'checked_in',
  );
  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return upcoming[0] ?? null;
}

export function sumOutstanding(invoices: { balanceCents: number }[]): number {
  return invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);
}

export function formatPaymentPlanSubtitle(count: number, behind: number | null): string {
  if (behind != null && behind > 0) {
    return `active plans · ${behind} behind`;
  }
  return 'active plans';
}

export function formatLabOrderSubtitle(pending: number, overdue: number | null): string {
  if (overdue != null && overdue > 0) {
    return `${pending} pending · ${overdue} overdue`;
  }
  return `${pending} pending delivery`;
}

export function countPendingTreatments(appointments: { status: string }[]): number {
  return appointments.filter((a) => a.status === 'scheduled').length;
}

export function formatDailyCollections(cents: number | null): string {
  if (cents == null) return '₱—';
  const pesos = cents / 100;
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCents(cents: number): string {
  const pesos = cents / 100;
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getInitials(name?: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Dashboard-home redesign (first slice): timeline + attention-queue helpers
// ---------------------------------------------------------------------------

/** Ascending by scheduledAt. Returns a new array (does not mutate input). */
export function sortByTime<T extends { scheduledAt: string }>(appointments: T[]): T[] {
  return [...appointments].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

/**
 * Index at which to insert the "now" divider in a time-sorted list — the index
 * of the first appointment whose scheduledAt is strictly after `now`. Returns
 * `-1` when every appointment is in the past (or the list is empty), i.e. no
 * divider should be shown.
 */
export function nowLineIndex<T extends { scheduledAt: string }>(
  sortedAppointments: T[],
  now: Date,
): number {
  const nowMs = now.getTime();
  const idx = sortedAppointments.findIndex(
    (a) => new Date(a.scheduledAt).getTime() > nowMs,
  );
  return idx;
}

/**
 * Context-aware hero day. The Home hero should never be a dead "nothing today"
 * box while real work is one tap away: if today still has actionable
 * appointments (a future slot or someone scheduled/checked-in) show today;
 * otherwise promote tomorrow; if neither has anything, it's a genuine empty day.
 */
export type HeroWhich = 'today' | 'tomorrow' | 'empty';

export function pickHeroDay<T extends { status: string; scheduledAt: string }>(
  today: T[],
  tomorrow: T[],
  now: Date,
): { which: HeroWhich; appointments: T[]; isToday: boolean } {
  const nowMs = now.getTime();
  const todayHasRemaining = today.some((a) => {
    const future = new Date(a.scheduledAt).getTime() > nowMs;
    const active = a.status === 'scheduled' || a.status === 'checked_in';
    return future || active;
  });

  if (today.length > 0 && todayHasRemaining) {
    return { which: 'today', appointments: today, isToday: true };
  }
  if (tomorrow.length > 0) {
    return { which: 'tomorrow', appointments: tomorrow, isToday: false };
  }
  if (today.length > 0) {
    // Today is over (all done) and nothing tomorrow — still show today's record.
    return { which: 'today', appointments: today, isToday: true };
  }
  return { which: 'empty', appointments: [], isToday: true };
}

export type AttentionTone = 'info' | 'warning' | 'destructive';

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  tone: AttentionTone;
  route: string;
}

interface BuildAttentionItemsArgs {
  appointments: { status: string }[];
  overdueInvoices: { balanceCents: number }[];
  overdueLabOrders: number | null;
  paymentPlansBehind: number | null;
  showFinancials: boolean;
  /**
   * Whether to include the "overdue balances" item. Defaults true. The redesigned
   * Home sets this false because the MoneyPanel owns overdue balances (with names
   * + amounts), so the attention queue carries only the operational + non-balance
   * financial items and never double-counts them.
   */
  includeOverdueBalances?: boolean;
}

/**
 * Derive the "Needs attention" action items from already-fetched dashboard
 * data. Financial items (overdue balances, lab due, plans behind) are omitted
 * entirely when `showFinancials === false` — there is no financial data path
 * for non-financial roles. Items with a zero count are dropped.
 */
export function buildAttentionItems({
  appointments,
  overdueInvoices,
  overdueLabOrders,
  paymentPlansBehind,
  showFinancials,
  includeOverdueBalances = true,
}: BuildAttentionItemsArgs): AttentionItem[] {
  const items: AttentionItem[] = [];

  const unconfirmed = appointments.filter((a) => a.status === 'scheduled').length;
  if (unconfirmed > 0) {
    items.push({
      id: 'unconfirmed',
      label: unconfirmed === 1 ? 'unconfirmed appointment' : 'unconfirmed appointments',
      count: unconfirmed,
      tone: 'info',
      route: '/calendar',
    });
  }

  const checkedIn = appointments.filter((a) => a.status === 'checked_in').length;
  if (checkedIn > 0) {
    items.push({
      id: 'checked-in',
      label: checkedIn === 1 ? 'patient checked in' : 'patients checked in',
      count: checkedIn,
      tone: 'info',
      route: '/calendar',
    });
  }

  if (showFinancials) {
    if (includeOverdueBalances && overdueInvoices.length > 0) {
      items.push({
        id: 'overdue-balances',
        label: overdueInvoices.length === 1 ? 'overdue balance' : 'overdue balances',
        count: overdueInvoices.length,
        tone: 'destructive',
        route: '/billing',
      });
    }

    if (overdueLabOrders != null && overdueLabOrders > 0) {
      items.push({
        id: 'lab-due',
        label: overdueLabOrders === 1 ? 'lab case overdue' : 'lab cases overdue',
        count: overdueLabOrders,
        tone: 'warning',
        route: '/billing',
      });
    }

    if (paymentPlansBehind != null && paymentPlansBehind > 0) {
      items.push({
        id: 'plans-behind',
        label: paymentPlansBehind === 1 ? 'payment plan behind' : 'payment plans behind',
        count: paymentPlansBehind,
        tone: 'warning',
        route: '/billing',
      });
    }
  }

  return items;
}
