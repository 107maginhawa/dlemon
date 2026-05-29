/**
 * useAppointments — TanStack Query hook for the calendar
 *
 * Loads appointments by date (day view) or week start (week view).
 * Query key includes date and view so it refetches automatically
 * when the user navigates dates or switches views.
 */
import { useQuery } from '@tanstack/react-query';
import { listAppointmentsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { Appointment } from '../components/appointment-card';

export type { Appointment };

interface UseAppointmentsOptions {
  date: string;       // ISO date string YYYY-MM-DD
  view: 'day' | 'week' | 'month';
  branchId?: string;
}

/** Compute Monday of the week containing the given date string. */
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Get first day of the month for a given date string. */
function getFirstOfMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-01`;
}

/** Add N days to a YYYY-MM-DD date string. */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * V-SCH-004: the list endpoint requires a [date_from, date_to] window (max 31 days).
 * Compute the window for the active calendar view.
 */
function computeWindow(date: string, view: 'day' | 'week' | 'month'): { from: string; to: string } {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const from = getMondayOfWeek(date);
    return { from, to: addDays(from, 6) };
  }
  // month: from first-of-month to first-of-next-month minus a day (cap at 30 to stay <= 31)
  const from = getFirstOfMonth(date);
  return { from, to: addDays(from, 30) };
}

/**
 * V-SCH-006/007: the wire response now uses startAt/endAt/visitType/providerId.
 * Normalize to the display-facing Appointment shape (scheduledAt/durationMinutes/
 * serviceType/dentistMemberId) so calendar components stay unchanged.
 */
function normalizeAppointment(raw: Record<string, unknown>): Appointment {
  const startAt = (raw['startAt'] ?? raw['scheduledAt']) as string | undefined;
  const endAt = raw['endAt'] as string | undefined;
  const durationMinutes = (raw['durationMinutes'] as number | undefined)
    ?? (startAt && endAt ? Math.max(Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000), 1) : 30);
  return {
    ...raw,
    scheduledAt: startAt ?? '',
    durationMinutes,
    serviceType: (raw['visitType'] ?? raw['serviceType'] ?? '') as string,
    dentistMemberId: (raw['providerId'] ?? raw['dentistMemberId']) as string | undefined,
  } as unknown as Appointment;
}

export function useAppointments({ date, view, branchId }: UseAppointmentsOptions) {
  const { from, to } = computeWindow(date, view);
  const query = useQuery({
    ...listAppointmentsOptions({ query: { branchId, date_from: from, date_to: to } as Record<string, unknown> }),
    select: (data) => {
      const rows = (Array.isArray(data) ? data : (data as Record<string, unknown>).appointments ?? []) as Record<string, unknown>[];
      return rows.map(normalizeAppointment);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
