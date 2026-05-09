/**
 * useAppointments — TanStack Query hook for the calendar
 *
 * Loads appointments by date (day view) or week start (week view).
 * Query key includes date and view so it refetches automatically
 * when the user navigates dates or switches views.
 */
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl } from '@/utils/config';
import type { Appointment } from '../components/appointment-card';

export type { Appointment };

const API = apiBaseUrl;

interface UseAppointmentsOptions {
  date: string;       // ISO date string YYYY-MM-DD
  view: 'day' | 'week';
}

/** Compute Monday of the week containing the given date string. */
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function fetchAppointments(date: string, view: 'day' | 'week'): Promise<Appointment[]> {
  const url =
    view === 'day'
      ? `${API}/dental/appointments?date=${date}`
      : `${API}/dental/appointments?weekStart=${getMondayOfWeek(date)}`;

  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load appointments (${res.status})`);

  const data = await res.json();
  return Array.isArray(data) ? data : data.appointments ?? [];
}

export function useAppointments({ date, view }: UseAppointmentsOptions) {
  const query = useQuery({
    queryKey: ['appointments', view, view === 'day' ? date : getMondayOfWeek(date)],
    queryFn: () => fetchAppointments(date, view),
    staleTime: 30_000, // 30s — calendar data is fresher than dashboard
    refetchOnWindowFocus: true,
  });

  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
