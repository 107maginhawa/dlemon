/**
 * MyAppointmentsView — the patient's own upcoming/past appointments (E4 portal).
 *
 * Mobile-first, read-only. Shows ONLY what the /me/appointments endpoint
 * returns (date/time, type, status) — no staff fields. Honest empty + error
 * states; no actions in Phase 1.
 */
import { Badge, Card, CardContent, Skeleton } from '@monobase/ui';
import { Calendar } from 'lucide-react';
import { useMyAppointments, type MyAppointment } from '../hooks/use-my-portal';

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatVisitType(visitType: string): string {
  if (!visitType) return 'Visit';
  return visitType.charAt(0).toUpperCase() + visitType.slice(1);
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map appointment status → Badge variant. Upcoming-positive vs terminal-negative. */
export function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'confirmed':
    case 'checked_in':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'cancelled':
    case 'no_show':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function formatAppointmentWhen(startAt: Date | string): string {
  const d = startAt instanceof Date ? startAt : new Date(startAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Presentational row (exported for testing without the network)
// ---------------------------------------------------------------------------

export function AppointmentCard({ appointment }: { appointment: MyAppointment }) {
  return (
    <Card data-testid="portal-appointment-card" data-status={appointment.status}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">
            {formatVisitType(appointment.visitType)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground" data-testid="portal-appointment-when">
            {formatAppointmentWhen(appointment.startAt)}
          </p>
        </div>
        <Badge variant={statusVariant(appointment.status)} className="shrink-0">
          {formatStatusLabel(appointment.status)}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function MyAppointmentsView() {
  const { appointments, isLoading, error } = useMyAppointments();

  return (
    <section className="space-y-3" aria-labelledby="portal-appointments-heading">
      <h1 id="portal-appointments-heading" className="text-lg font-semibold tracking-tight">
        My Appointments
      </h1>

      {isLoading ? (
        <div className="space-y-3" data-testid="portal-appointments-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-destructive" role="alert">
            We couldn’t load your appointments. Please try again later.
          </CardContent>
        </Card>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent
            className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground"
            data-testid="portal-appointments-empty"
          >
            <Calendar className="h-6 w-6" aria-hidden="true" />
            <p className="text-sm">You have no appointments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="portal-appointments-list">
          {appointments.map((a) => (
            <AppointmentCard key={a.id} appointment={a} />
          ))}
        </div>
      )}
    </section>
  );
}
