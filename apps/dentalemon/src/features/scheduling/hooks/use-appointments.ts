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

export function useAppointments({ date, view, branchId }: UseAppointmentsOptions) {
  const queryDate = view === 'day' ? date : view === 'week' ? getMondayOfWeek(date) : getFirstOfMonth(date);
  const query = useQuery({
    ...listAppointmentsOptions({ query: { date: queryDate, branchId } }),
    select: (data) => (Array.isArray(data) ? data : (data as Record<string, unknown>).appointments ?? []) as unknown as Appointment[],
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
