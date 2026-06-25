/**
 * MorningBriefing component tests -- pure logic helpers
 *
 * Tests: greeting, date formatting, collections calculations,
 * trend calculation, appointment grouping, treatment filtering,
 * outstanding sums, payment plan filtering, role-based access
 */

import { describe, test, expect, afterEach, mock } from 'bun:test';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { canAccess, canViewFinancials, getDefaultRoute } from '../../../lib/rbac';
import { freshClient, makeWrapper, jsonResponse } from '@/test-utils';
import {
  getGreeting,
  formatTodayDate,
  calcTrend,
  groupAppointmentsByStatus,
  getNextAppointment,
  sumOutstanding,
  formatPaymentPlanSubtitle,
  formatLabOrderSubtitle,
  countPendingTreatments,
  formatDailyCollections,
} from './morning-briefing';
import { MorningBriefing } from './morning-briefing';
import {
  sortByTime,
  nowLineIndex,
  buildAttentionItems,
} from './morning-briefing.helpers';

// ---------------------------------------------------------------------------
// Local helpers not exported by the component
// ---------------------------------------------------------------------------

interface Payment {
  amountCents: number;
  createdAt: string;
}

interface Treatment {
  id: string;
  status: string;
  serviceType?: string;
}

interface PaymentPlan {
  id: string;
  status: string;
  patientName?: string;
}

function calcCollectionsToday(payments: Payment[], today: string): number {
  return payments
    .filter((p) => p.createdAt.startsWith(today))
    .reduce((sum, p) => sum + p.amountCents, 0);
}

function filterPendingTreatments(treatments: Treatment[]): Treatment[] {
  const excluded = new Set(['verified', 'dismissed']);
  return treatments.filter((t) => !excluded.has(t.status));
}

function getPlansBehind(plans: PaymentPlan[]): PaymentPlan[] {
  return plans.filter((p) => p.status === 'behind');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MorningBriefing -- getGreeting', () => {
  test('getGreeting(7) returns Good morning', () => {
    expect(getGreeting(7)).toBe('Good morning');
  });

  test('getGreeting(14) returns Good afternoon', () => {
    expect(getGreeting(14)).toBe('Good afternoon');
  });

  test('getGreeting(20) returns Good evening', () => {
    expect(getGreeting(20)).toBe('Good evening');
  });

  test('getGreeting(12) returns Good afternoon (noon boundary)', () => {
    expect(getGreeting(12)).toBe('Good afternoon');
  });

  test('getGreeting(0) returns Good morning (midnight)', () => {
    expect(getGreeting(0)).toBe('Good morning');
  });

  test('getGreeting(18) returns Good evening (boundary)', () => {
    expect(getGreeting(18)).toBe('Good evening');
  });
});

describe('MorningBriefing -- formatTodayDate', () => {
  test('formats date with weekday, month, day, year', () => {
    const d = new Date(2026, 4, 2); // May 2, 2026
    const result = formatTodayDate(d);
    expect(result).toContain('Saturday');
    expect(result).toContain('May');
    expect(result).toContain('2026');
  });

  test('formats another date correctly', () => {
    const d = new Date(2026, 0, 15); // Jan 15, 2026
    const result = formatTodayDate(d);
    expect(result).toContain('January');
    expect(result).toContain('2026');
  });
});

describe('MorningBriefing -- calcCollectionsToday', () => {
  test('sums payments for today only', () => {
    const payments: Payment[] = [
      { amountCents: 5000, createdAt: '2026-05-02T09:00:00Z' },
      { amountCents: 7400, createdAt: '2026-05-02T14:30:00Z' },
      { amountCents: 3000, createdAt: '2026-05-01T10:00:00Z' },
    ];
    expect(calcCollectionsToday(payments, '2026-05-02')).toBe(12400);
  });

  test('returns 0 when no payments match today', () => {
    const payments: Payment[] = [
      { amountCents: 3000, createdAt: '2026-05-01T10:00:00Z' },
    ];
    expect(calcCollectionsToday(payments, '2026-05-02')).toBe(0);
  });
});

describe('MorningBriefing -- calcTrend', () => {
  test('positive trend includes + sign', () => {
    const result = calcTrend(12400, 9800);
    expect(result).toContain('+');
    expect(result).toContain('%');
  });

  test('negative trend includes - sign', () => {
    const result = calcTrend(5000, 10000);
    expect(result).toContain('-');
    expect(result).toContain('%');
  });

  test('zero/zero returns em dash', () => {
    expect(calcTrend(0, 0)).toBe('\u2014');
  });

  test('from zero yesterday returns +100%', () => {
    expect(calcTrend(5000, 0)).toBe('+100%');
  });

  test('equal values returns 0%', () => {
    expect(calcTrend(5000, 5000)).toBe('0%');
  });
});

describe('MorningBriefing -- groupAppointmentsByStatus', () => {
  test('splits appointments into done, now, upcoming', () => {
    const appts = [
      { id: '1', patientId: 'p1', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
      { id: '2', patientId: 'p2', scheduledAt: '2026-05-02T09:00:00Z', status: 'checked_in' },
      { id: '3', patientId: 'p3', scheduledAt: '2026-05-02T10:00:00Z', status: 'scheduled' },
      { id: '4', patientId: 'p4', scheduledAt: '2026-05-02T11:00:00Z', status: 'no_show' },
    ];
    const result = groupAppointmentsByStatus(appts);
    expect(result.done.length).toBe(2);
    expect(result.now.length).toBe(1);
    expect(result.upcoming.length).toBe(1);
  });

  test('empty array returns empty groups', () => {
    const result = groupAppointmentsByStatus([]);
    expect(result.done.length).toBe(0);
    expect(result.now.length).toBe(0);
    expect(result.upcoming.length).toBe(0);
  });
});

describe('MorningBriefing -- getNextAppointment', () => {
  test('returns first scheduled/checkedIn appointment by time', () => {
    const appts = [
      { id: '1', patientId: 'p1', scheduledAt: '2026-05-02T14:00:00Z', status: 'scheduled' },
      { id: '2', patientId: 'p2', scheduledAt: '2026-05-02T09:30:00Z', status: 'checked_in' },
      { id: '3', patientId: 'p3', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
    ];
    const result = getNextAppointment(appts);
    expect(result?.id).toBe('2');
  });

  test('returns null for empty array', () => {
    expect(getNextAppointment([])).toBeNull();
  });

  test('returns null when all completed', () => {
    const appts = [
      { id: '1', patientId: 'p1', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
    ];
    expect(getNextAppointment(appts)).toBeNull();
  });
});

describe('MorningBriefing -- filterPendingTreatments', () => {
  test('filters out verified and dismissed', () => {
    const treatments: Treatment[] = [
      { id: '1', status: 'diagnosed' },
      { id: '2', status: 'verified' },
      { id: '3', status: 'planned' },
      { id: '4', status: 'dismissed' },
      { id: '5', status: 'performed' },
    ];
    const result = filterPendingTreatments(treatments);
    expect(result.length).toBe(3);
    expect(result.map((t) => t.id)).toEqual(['1', '3', '5']);
  });

  test('keeps diagnosed, planned, performed', () => {
    const treatments: Treatment[] = [
      { id: '1', status: 'diagnosed' },
      { id: '2', status: 'planned' },
      { id: '3', status: 'performed' },
    ];
    const result = filterPendingTreatments(treatments);
    expect(result.length).toBe(3);
  });

  test('empty input returns empty', () => {
    expect(filterPendingTreatments([])).toEqual([]);
  });
});

describe('MorningBriefing -- sumOutstanding', () => {
  test('returns 0 for empty array', () => {
    expect(sumOutstanding([])).toBe(0);
  });

  test('sums balanceCents correctly', () => {
    const invoices = [
      { id: '1', invoiceNumber: 'INV-001', patientId: 'p1', totalCents: 800000, paidCents: 0, balanceCents: 800000, status: 'overdue', createdAt: '2026-01-01' },
      { id: '2', invoiceNumber: 'INV-002', patientId: 'p2', totalCents: 350000, paidCents: 0, balanceCents: 350000, status: 'overdue', createdAt: '2026-01-02' },
      { id: '3', invoiceNumber: 'INV-003', patientId: 'p3', totalCents: 120000, paidCents: 0, balanceCents: 120000, status: 'overdue', createdAt: '2026-01-03' },
    ];
    expect(sumOutstanding(invoices)).toBe(1270000);
  });
});

describe('MorningBriefing -- getPlansBehind', () => {
  test('filters to behind plans only', () => {
    const plans: PaymentPlan[] = [
      { id: '1', status: 'on_track', patientName: 'Russel' },
      { id: '2', status: 'behind', patientName: 'Juan' },
      { id: '3', status: 'on_track', patientName: 'Maria' },
    ];
    const result = getPlansBehind(plans);
    expect(result.length).toBe(1);
    expect(result[0].patientName).toBe('Juan');
  });

  test('returns empty when none behind', () => {
    const plans: PaymentPlan[] = [
      { id: '1', status: 'on_track' },
    ];
    expect(getPlansBehind(plans)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FR0.7: Payment Plans — "behind" badge logic
// ---------------------------------------------------------------------------

describe('MorningBriefing -- payment plans behind badge', () => {
  test('formatPaymentPlanSubtitle shows "behind" count when > 0', () => {
    const result = formatPaymentPlanSubtitle(5, 2);
    expect(result).toContain('2');
    expect(result).toContain('behind');
  });

  test('formatPaymentPlanSubtitle shows "active plans" only when behind is 0', () => {
    const result = formatPaymentPlanSubtitle(5, 0);
    expect(result).toBe('active plans');
    expect(result).not.toContain('behind');
  });

  test('formatPaymentPlanSubtitle shows "active plans" when behind is null', () => {
    const result = formatPaymentPlanSubtitle(5, null);
    expect(result).toBe('active plans');
  });
});

// ---------------------------------------------------------------------------
// FR0.8: Lab Orders — overdue display logic
// ---------------------------------------------------------------------------

describe('MorningBriefing -- lab order status display', () => {
  test('formatLabOrderSubtitle shows pending and overdue when both > 0', () => {
    const result = formatLabOrderSubtitle(4, 2);
    expect(result).toContain('4');
    expect(result).toContain('pending');
    expect(result).toContain('2');
    expect(result).toContain('overdue');
  });

  test('formatLabOrderSubtitle shows only pending when overdue is 0', () => {
    const result = formatLabOrderSubtitle(3, 0);
    expect(result).toContain('pending');
    expect(result).not.toContain('overdue');
  });

  test('formatLabOrderSubtitle shows only pending when overdue is null', () => {
    const result = formatLabOrderSubtitle(3, null);
    expect(result).toContain('pending');
    expect(result).not.toContain('overdue');
  });

  test('formatLabOrderSubtitle handles zero pending', () => {
    const result = formatLabOrderSubtitle(0, 0);
    expect(result).toContain('pending');
  });
});

// ---------------------------------------------------------------------------
// FR0.3: Pending treatments count
// ---------------------------------------------------------------------------

describe('MorningBriefing -- pending treatments count', () => {
  test('countPendingTreatments returns count of scheduled appointments', () => {
    const appts = [
      { status: 'scheduled' },
      { status: 'completed' },
      { status: 'scheduled' },
      { status: 'checked_in' },
    ];
    expect(countPendingTreatments(appts)).toBe(2);
  });

  test('countPendingTreatments returns 0 for empty array', () => {
    expect(countPendingTreatments([])).toBe(0);
  });

  test('countPendingTreatments returns 0 when all completed', () => {
    const appts = [{ status: 'completed' }, { status: 'no_show' }];
    expect(countPendingTreatments(appts)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FR0.4: Daily collections formatting
// ---------------------------------------------------------------------------

describe('MorningBriefing -- daily collections display', () => {
  test('formatDailyCollections returns formatted peso amount', () => {
    const result = formatDailyCollections(1250000);
    expect(result).toContain('12,500');
  });

  test('formatDailyCollections returns dash for null', () => {
    const result = formatDailyCollections(null);
    expect(result).toContain('\u2014');
  });

  test('formatDailyCollections returns zero amount for 0', () => {
    const result = formatDailyCollections(0);
    expect(result).toContain('0');
  });
});

describe('MorningBriefing -- role-based access (rbac.ts)', () => {
  test('staff_scheduling cannot access dashboard', () => {
    expect(canAccess('staff_scheduling', 'dashboard')).toBe(false);
  });

  test('staff_full cannot view financials', () => {
    expect(canViewFinancials('staff_full')).toBe(false);
  });

  test('dentist_owner can view financials', () => {
    expect(canViewFinancials('dentist_owner')).toBe(true);
  });

  test('dentist_associate can view financials', () => {
    expect(canViewFinancials('dentist_associate')).toBe(true);
  });

  test('staff_full can access dashboard', () => {
    expect(canAccess('staff_full', 'dashboard')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// First-slice helpers: sortByTime, nowLineIndex, buildAttentionItems
// ---------------------------------------------------------------------------

describe('MorningBriefing -- sortByTime', () => {
  test('sorts ascending by scheduledAt', () => {
    const appts = [
      { id: 'b', scheduledAt: '2026-06-25T11:00:00Z' },
      { id: 'a', scheduledAt: '2026-06-25T09:00:00Z' },
      { id: 'c', scheduledAt: '2026-06-25T14:00:00Z' },
    ];
    const result = sortByTime(appts);
    expect(result.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  test('does not mutate the input array', () => {
    const appts = [
      { id: 'b', scheduledAt: '2026-06-25T11:00:00Z' },
      { id: 'a', scheduledAt: '2026-06-25T09:00:00Z' },
    ];
    const before = appts.map((a) => a.id);
    sortByTime(appts);
    expect(appts.map((a) => a.id)).toEqual(before);
  });

  test('empty array returns empty', () => {
    expect(sortByTime([])).toEqual([]);
  });
});

describe('MorningBriefing -- nowLineIndex', () => {
  const sorted = [
    { id: 'a', scheduledAt: '2026-06-25T09:00:00Z' },
    { id: 'b', scheduledAt: '2026-06-25T11:00:00Z' },
    { id: 'c', scheduledAt: '2026-06-25T14:00:00Z' },
  ];

  test('mid-day: index of first appointment after now', () => {
    const now = new Date('2026-06-25T10:00:00Z');
    expect(nowLineIndex(sorted, now)).toBe(1);
  });

  test('before all appointments: index 0', () => {
    const now = new Date('2026-06-25T08:00:00Z');
    expect(nowLineIndex(sorted, now)).toBe(0);
  });

  test('after all appointments: -1', () => {
    const now = new Date('2026-06-25T15:00:00Z');
    expect(nowLineIndex(sorted, now)).toBe(-1);
  });

  test('empty array: -1', () => {
    expect(nowLineIndex([], new Date('2026-06-25T10:00:00Z'))).toBe(-1);
  });
});

describe('MorningBriefing -- buildAttentionItems', () => {
  const baseAppts = [
    { id: '1', status: 'scheduled', scheduledAt: '2026-06-25T09:00:00Z' },
    { id: '2', status: 'scheduled', scheduledAt: '2026-06-25T10:00:00Z' },
    { id: '3', status: 'checked_in', scheduledAt: '2026-06-25T11:00:00Z' },
    { id: '4', status: 'completed', scheduledAt: '2026-06-25T12:00:00Z' },
  ];
  const overdueInvoices = [
    { id: 'i1', balanceCents: 500000 },
    { id: 'i2', balanceCents: 300000 },
  ];

  test('financial role includes unconfirmed, checked-in, and financial items', () => {
    const items = buildAttentionItems({
      appointments: baseAppts,
      overdueInvoices,
      overdueLabOrders: 2,
      paymentPlansBehind: 1,
      showFinancials: true,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain('unconfirmed');
    expect(ids).toContain('checked-in');
    expect(ids).toContain('overdue-balances');
    expect(ids).toContain('lab-due');
    expect(ids).toContain('plans-behind');

    const unconfirmed = items.find((i) => i.id === 'unconfirmed');
    expect(unconfirmed?.count).toBe(2);
    const checkedIn = items.find((i) => i.id === 'checked-in');
    expect(checkedIn?.count).toBe(1);
    const overdue = items.find((i) => i.id === 'overdue-balances');
    expect(overdue?.count).toBe(2);
  });

  test('non-financial role omits all financial items', () => {
    const items = buildAttentionItems({
      appointments: baseAppts,
      overdueInvoices,
      overdueLabOrders: 2,
      paymentPlansBehind: 1,
      showFinancials: false,
    });
    const ids = items.map((i) => i.id);
    expect(ids).toContain('unconfirmed');
    expect(ids).toContain('checked-in');
    expect(ids).not.toContain('overdue-balances');
    expect(ids).not.toContain('lab-due');
    expect(ids).not.toContain('plans-behind');
  });

  test('zero-state returns no items', () => {
    const items = buildAttentionItems({
      appointments: [{ id: 'x', status: 'completed', scheduledAt: '2026-06-25T09:00:00Z' }],
      overdueInvoices: [],
      overdueLabOrders: 0,
      paymentPlansBehind: 0,
      showFinancials: true,
    });
    expect(items).toEqual([]);
  });

  test('each item carries a route for click-through', () => {
    const items = buildAttentionItems({
      appointments: baseAppts,
      overdueInvoices,
      overdueLabOrders: 0,
      paymentPlansBehind: 0,
      showFinancials: true,
    });
    for (const item of items) {
      expect(typeof item.route).toBe('string');
      expect(item.route.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Render-level role gating + non-owner resilience (G-dashboard-*)
//
// The summary endpoint (getDashboardSummary) is OWNER-ONLY on the backend, but
// the morning briefing is shown to 8 non-owner roles. These render tests prove:
//  (1) a non-owner's owner-only summary 403 does NOT blank the dashboard —
//      the schedule still renders (G-dashboard-nonowner-summary-403-...);
//  (2) financial MetricCards are gated by canViewFinancials at the RENDER level
//      (G-dashboard-financial-card-render-gating-untested).
// ---------------------------------------------------------------------------

const RENDER_TODAY = [
  { id: 'a1', patientId: 'p1', patientName: 'Maria Santos', providerId: 'pr1', branchId: 'b1', startAt: '2026-05-04T09:00:00Z', endAt: '2026-05-04T09:30:00Z', status: 'scheduled', visitType: 'checkup', walkIn: false, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', version: 1 },
  { id: 'a2', patientId: 'p2', patientName: 'Ramon Cruz', providerId: 'pr1', branchId: 'b1', startAt: '2026-05-04T10:00:00Z', endAt: '2026-05-04T10:30:00Z', status: 'completed', visitType: 'cleaning', walkIn: false, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z', version: 1 },
];
const RENDER_TOMORROW: unknown[] = [];
const RENDER_SUMMARY = { activePaymentPlans: { count: 2, behindCount: 0 }, labOrders: { totalPending: 1, overdueDelivery: 0 } };
const RENDER_OVERDUE: unknown[] = [];
const RENDER_ALL: unknown[] = [];

function renderFetch(responses: unknown[]) {
  let i = 0;
  return mock(() => jsonResponse(responses[i++ % responses.length]));
}

function renderErrorAt(failFrom: number, successes: unknown[]) {
  let i = 0;
  return mock(() => {
    const idx = i++;
    if (idx < failFrom) return jsonResponse(successes[idx]);
    return Promise.resolve(
      new Response(JSON.stringify({ message: `error 403` }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
}

describe('MorningBriefing -- render-level role gating', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
  });

  test('non-owner: owner-only summary 403 does NOT blank the dashboard — timeline renders', async () => {
    // calls: 0 today (ok), 1 tomorrow (ok), 2 summary (403, owner-only)
    global.fetch = renderErrorAt(2, [RENDER_TODAY, RENDER_TOMORROW]);

    render(
      React.createElement(MorningBriefing, { role: 'front_desk', branchId: 'b1' }),
      { wrapper: makeWrapper(freshClient()) },
    );

    // wait for post-load content; explicit timeout is robust under full-suite CPU load
    await screen.findByTestId('schedule-timeline', undefined, { timeout: 5000 });
    // the command-center regions render
    expect(screen.getByTestId('attention-queue')).toBeTruthy();
    expect(screen.getByTestId('kpi-ribbon')).toBeTruthy();
    // schedule renders (NOT suppressed behind an error banner)
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    // no error banner rendered
    expect(screen.queryByText(/error 403/i)).toBeNull();
  });

  test('new composition replaces the 6-card grid and Reminders block', async () => {
    global.fetch = renderFetch([
      RENDER_TODAY, RENDER_TOMORROW, RENDER_SUMMARY,
      { data: RENDER_OVERDUE }, { data: RENDER_ALL },
    ]);

    render(
      React.createElement(MorningBriefing, { role: 'dentist_owner', branchId: 'b1' }),
      { wrapper: makeWrapper(freshClient()) },
    );

    await screen.findByTestId('schedule-timeline', undefined, { timeout: 5000 });
    // the removed surfaces are gone
    expect(screen.queryByText('Reminders')).toBeNull();
    expect(screen.queryByText('Pending Treatments')).toBeNull();
    expect(screen.queryByText('Lab Orders')).toBeNull();
    // quick actions + tomorrow up-next are kept
    expect(screen.getByTestId('quick-new-patient')).toBeTruthy();
  });

  test('non-financial role (staff_full): KPI ribbon omits collections; no financial leakage', async () => {
    global.fetch = renderFetch([RENDER_TODAY, RENDER_TOMORROW, RENDER_SUMMARY]);

    render(
      React.createElement(MorningBriefing, { role: 'staff_full', branchId: 'b1' }),
      { wrapper: makeWrapper(freshClient()) },
    );

    await screen.findByTestId('kpi-ribbon', undefined, { timeout: 5000 });
    const ribbon = screen.getByTestId('kpi-ribbon');
    // collections label is NOT present for a non-financial role
    expect(ribbon.textContent).not.toContain('Collected');
    // done / remaining ARE present
    expect(ribbon.textContent).toContain('Done');
    expect(ribbon.textContent).toContain('Remaining');
  });

  test('financial role (dentist_owner): KPI ribbon shows collections', async () => {
    global.fetch = renderFetch([
      RENDER_TODAY, RENDER_TOMORROW, RENDER_SUMMARY,
      { data: RENDER_OVERDUE }, { data: RENDER_ALL },
    ]);

    render(
      React.createElement(MorningBriefing, { role: 'dentist_owner', branchId: 'b1' }),
      { wrapper: makeWrapper(freshClient()) },
    );

    await screen.findByTestId('kpi-ribbon', undefined, { timeout: 5000 });
    const ribbon = screen.getByTestId('kpi-ribbon');
    expect(ribbon.textContent).toContain('Collected');
  });
});

// ---------------------------------------------------------------------------
// staff_scheduling dashboard-denial — design pin (G-dashboard-staff-scheduling-
// denial-unenforceable-vs-documented).
//
// Resolution: the denial is real but enforced at NAV + LANDING, not as a hard
// route block. rbac denies the dashboard MODULE (no nav link) and getDefaultRoute
// routes staff_scheduling to /patients, so they never land on /dashboard. The
// /dashboard ROUTE itself is the intentional ungated universal-redirect fallback
// (_dashboard.tsx) — enforcing a redirect there would loop. Pin both halves so
// the (correct) design is documented, not silently regressed.
// ---------------------------------------------------------------------------

describe('MorningBriefing -- staff_scheduling dashboard denial (design pin)', () => {
  test('dashboard module is denied (no nav affordance)', () => {
    expect(canAccess('staff_scheduling', 'dashboard')).toBe(false);
  });

  test('landing route is /patients, so staff_scheduling never lands on the dashboard', () => {
    expect(getDefaultRoute('staff_scheduling')).toBe('/patients');
  });
});
