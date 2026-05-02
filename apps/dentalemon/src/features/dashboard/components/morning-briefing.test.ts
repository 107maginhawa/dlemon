/**
 * MorningBriefing component tests -- pure logic helpers
 *
 * Tests: greeting, date formatting, collections calculations,
 * trend calculation, appointment grouping, treatment filtering,
 * outstanding sums, payment plan filtering, role-based access
 */

import { describe, test, expect } from 'bun:test';
import { canAccess, canViewFinancials } from '../../../utils/rbac';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Appointment {
  id: string;
  patientName?: string;
  scheduledAt: string;
  status: string;
  procedureType?: string;
}

interface Payment {
  amountCents: number;
  createdAt: string;
}

interface Treatment {
  id: string;
  status: string;
  procedureType?: string;
}

interface Invoice {
  id: string;
  balanceCents: number;
  status: string;
}

interface PaymentPlan {
  id: string;
  status: string;
  patientName?: string;
}

// ---------------------------------------------------------------------------
// Pure logic helpers (mirrors exports from morning-briefing.tsx)
// ---------------------------------------------------------------------------

function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function calcCollectionsToday(payments: Payment[], today: string): number {
  return payments
    .filter((p) => p.createdAt.startsWith(today))
    .reduce((sum, p) => sum + p.amountCents, 0);
}

function calcTrend(today: number, yesterday: number): string {
  if (yesterday === 0 && today === 0) return '\u2014';
  if (yesterday === 0) return '+100%';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

function groupAppointmentsByStatus(appointments: Appointment[]): {
  done: Appointment[];
  now: Appointment[];
  upcoming: Appointment[];
} {
  const done: Appointment[] = [];
  const now: Appointment[] = [];
  const upcoming: Appointment[] = [];

  for (const appt of appointments) {
    switch (appt.status) {
      case 'completed':
      case 'noShow':
        done.push(appt);
        break;
      case 'checkedIn':
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

function getNextAppointment(appointments: Appointment[], _now?: Date): Appointment | null {
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'checkedIn'
  );
  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return upcoming[0];
}

function filterPendingTreatments(treatments: Treatment[]): Treatment[] {
  const excluded = new Set(['verified', 'dismissed']);
  return treatments.filter((t) => !excluded.has(t.status));
}

function sumOutstanding(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);
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
    const appts: Appointment[] = [
      { id: '1', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
      { id: '2', scheduledAt: '2026-05-02T09:00:00Z', status: 'checkedIn' },
      { id: '3', scheduledAt: '2026-05-02T10:00:00Z', status: 'scheduled' },
      { id: '4', scheduledAt: '2026-05-02T11:00:00Z', status: 'noShow' },
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
    const appts: Appointment[] = [
      { id: '1', scheduledAt: '2026-05-02T14:00:00Z', status: 'scheduled' },
      { id: '2', scheduledAt: '2026-05-02T09:30:00Z', status: 'checkedIn' },
      { id: '3', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
    ];
    const result = getNextAppointment(appts);
    expect(result?.id).toBe('2');
  });

  test('returns null for empty array', () => {
    expect(getNextAppointment([])).toBeNull();
  });

  test('returns null when all completed', () => {
    const appts: Appointment[] = [
      { id: '1', scheduledAt: '2026-05-02T08:00:00Z', status: 'completed' },
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
    const invoices: Invoice[] = [
      { id: '1', balanceCents: 800000, status: 'overdue' },
      { id: '2', balanceCents: 350000, status: 'overdue' },
      { id: '3', balanceCents: 120000, status: 'overdue' },
    ];
    expect(sumOutstanding(invoices)).toBe(1270000);
  });
});

describe('MorningBriefing -- getPlansBehind', () => {
  test('filters to behind plans only', () => {
    const plans: PaymentPlan[] = [
      { id: '1', status: 'onTrack', patientName: 'Russel' },
      { id: '2', status: 'behind', patientName: 'Juan' },
      { id: '3', status: 'onTrack', patientName: 'Maria' },
    ];
    const result = getPlansBehind(plans);
    expect(result.length).toBe(1);
    expect(result[0].patientName).toBe('Juan');
  });

  test('returns empty when none behind', () => {
    const plans: PaymentPlan[] = [
      { id: '1', status: 'onTrack' },
    ];
    expect(getPlansBehind(plans)).toEqual([]);
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
