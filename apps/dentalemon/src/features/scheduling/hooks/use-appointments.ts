/**
 * useAppointments — TanStack Query hook for the calendar
 *
 * Loads appointments by date (day view) or week start (week view).
 * Query key includes date and view so it refetches automatically
 * when the user navigates dates or switches views.
 */
import { useQuery } from '@tanstack/react-query';
import { listAppointmentsOptions } from '@monobase/sdk-ts/generated/react-query';
import type { DentalAppointment } from '@monobase/sdk-ts/generated';
import type { Appointment } from '../components/appointment-card';

export type { Appointment };

// The list response is Array<DentalAppointment> plus a `patientName` enrichment the
// SDK omits (live-confirmed 2026-06-04) — intersect it.
type DentalAppointmentRow = DentalAppointment & { patientName?: string };

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
 * V-SCH-006/007: the wire response uses startAt/endAt/visitType/providerId.
 * Normalize to the display-facing Appointment shape (scheduledAt/durationMinutes/
 * serviceType/dentistMemberId) so calendar components stay unchanged.
 *
 * Cause-fix (oli QA_ESCAPES §6): typed against the SDK DentalAppointment so each
 * field-access is checked — no `as unknown as Appointment`. startAt/endAt are Date
 * at runtime (the listAppointments transformer runs); new Date()/`instanceof`
 * guards keep it robust either way. scheduledAt is emitted as a real ISO string
 * (the previous code leaked a Date object behind a `string` type).
 */
function normalizeAppointment(a: DentalAppointmentRow): Appointment {
  const startMs = new Date(a.startAt).getTime();
  const endMs = new Date(a.endAt).getTime();
  const durationMinutes = Math.max(Math.round((endMs - startMs) / 60_000), 1);
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patientName,
    dentistMemberId: a.providerId,
    branchId: a.branchId,
    scheduledAt: a.startAt instanceof Date ? a.startAt.toISOString() : String(a.startAt),
    durationMinutes,
    serviceType: a.visitType,
    status: a.status,
    notes: a.notes ?? undefined,
    walkIn: a.walkIn,
  };
}

export function useAppointments({ date, view, branchId }: UseAppointmentsOptions) {
  const { from, to } = computeWindow(date, view);
  const query = useQuery({
    ...listAppointmentsOptions({ query: { branchId: branchId as string, date_from: from, date_to: to } }),
    // branchId is REQUIRED by GET /dental/appointments (it 400s on undefined), so
    // gate the query until the org-context branchId is available — otherwise the
    // calendar grid hard-errors instead of showing a loading/empty state.
    enabled: !!branchId,
    // listAppointments returns Array<DentalAppointment> (+ patientName enrichment);
    // single `as` adds the enrichment — no blind `as unknown as`.
    select: (data) => ((data ?? []) as DentalAppointmentRow[]).map(normalizeAppointment),
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
