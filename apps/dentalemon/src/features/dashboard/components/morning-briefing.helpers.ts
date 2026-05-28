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
