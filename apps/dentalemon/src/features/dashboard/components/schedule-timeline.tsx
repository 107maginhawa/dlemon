/**
 * ScheduleTimeline -- today's chair-side agenda (dashboard-home redesign).
 *
 * The spine of the Home screen: today's appointments sorted by time, each row
 * showing time · patient (initials avatar) · service · status pill, plus a
 * balance flag for financial roles. A "now" divider is inserted before the
 * first appointment still in the future. Empty days get a humane onboarding
 * state with Add-appointment / View-week CTAs.
 */

import React from 'react';
import { sortByTime, nowLineIndex, formatTime, formatCents, getInitials } from './morning-briefing.helpers';

export interface TimelineAppointment {
  id: string;
  patientId: string;
  patientName?: string;
  scheduledAt: string;
  status: string;
  serviceType?: string;
  balanceCents?: number;
}

export interface ScheduleTimelineProps {
  appointments: TimelineAppointment[];
  now: Date;
  showFinancials: boolean;
  onAdd: () => void;
  onViewWeek: () => void;
  /** Section label — defaults to "Today". The context-aware Home passes "Tomorrow" etc. */
  title?: string;
  /** Right-aligned date label — defaults to today's weekday/month/day. */
  dateLabel?: string;
  /** When provided, each row becomes a button that opens that patient's workspace. */
  onSelectAppointment?: (patientId: string) => void;
  /** Whether to render the "Now" divider. Defaults true; false for a future day (nothing is "now"). */
  showNowLine?: boolean;
}

interface StatusPillStyle {
  label: string;
  className: string;
}

// Pill only for states that carry signal beyond the default. A timeline of
// identical "Scheduled" badges is unearned chrome (PRODUCT.md: chrome is earned,
// the interface recedes) — you scan a day for the exceptions (checked in, done,
// no-show), so only those get a pill. Default/unknown → no pill.
const STATUS_PILL: Record<string, StatusPillStyle> = {
  completed: { label: 'Done', className: 'bg-success/15 text-success-foreground' },
  checked_in: { label: 'Checked in', className: 'bg-info/15 text-info-foreground' },
  no_show: { label: 'No show', className: 'bg-muted text-muted-foreground' },
};

function StatusPill({ status }: { status: string }) {
  const pill = STATUS_PILL[status];
  if (!pill) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${pill.className}`}
    >
      {pill.label}
    </span>
  );
}

function Row({
  appt,
  showFinancials,
  onSelect,
}: {
  appt: TimelineAppointment;
  showFinancials: boolean;
  onSelect?: (patientId: string) => void;
}) {
  const inner = (
    <>
      <span className="text-xs font-medium text-muted-foreground tabular-nums w-[64px] flex-shrink-0">
        {formatTime(appt.scheduledAt)}
      </span>
      <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {getInitials(appt.patientName)}
      </div>
      <span className="text-sm font-medium truncate min-w-0">
        {appt.patientName ?? appt.patientId}
      </span>
      <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
        {appt.serviceType ?? '—'}
      </span>
      <StatusPill status={appt.status} />
      {showFinancials && appt.balanceCents != null && appt.balanceCents > 0 && (
        <span
          data-testid={`appt-balance-flag-${appt.id}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold tabular-nums bg-destructive/15 text-destructive-emphasis whitespace-nowrap"
        >
          {formatCents(appt.balanceCents)}
        </span>
      )}
    </>
  );

  const base = 'flex items-center gap-3 py-2.5 border-b border-border last:border-b-0';

  if (!onSelect) {
    return <div className={base}>{inner}</div>;
  }
  return (
    <button
      type="button"
      data-testid={`timeline-row-${appt.id}`}
      onClick={() => onSelect(appt.patientId)}
      className={`${base} w-full text-left -mx-2 px-2 rounded-lg hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors`}
    >
      {inner}
    </button>
  );
}

export function ScheduleTimeline({
  appointments,
  now,
  showFinancials,
  onAdd,
  onViewWeek,
  title = 'Today',
  dateLabel,
  onSelectAppointment,
  showNowLine = true,
}: ScheduleTimelineProps) {
  const sorted = sortByTime(appointments);
  const nowIdx = showNowLine ? nowLineIndex(sorted, now) : -1;
  const resolvedDate =
    dateLabel ?? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1"
      data-testid="schedule-timeline"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {resolvedDate}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">No appointments {title.toLowerCase()}.</p>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              data-testid="timeline-empty-add"
              onClick={onAdd}
              className="h-9 px-3.5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors"
            >
              Add appointment
            </button>
            <button
              type="button"
              data-testid="timeline-empty-view-week"
              onClick={onViewWeek}
              className="h-9 px-3.5 rounded-xl bg-background border border-border text-sm font-medium hover:bg-secondary/50 transition-colors"
            >
              View week
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {sorted.map((appt, i) => (
            <React.Fragment key={appt.id}>
              {i === nowIdx && (
                <div
                  data-testid="now-line"
                  className="flex items-center gap-2 py-1"
                  aria-label="Current time"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-lemon-foreground">
                    Now
                  </span>
                  <div className="flex-1 h-px bg-lemon" />
                </div>
              )}
              <Row
                appt={appt}
                showFinancials={showFinancials}
                onSelect={onSelectAppointment}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
