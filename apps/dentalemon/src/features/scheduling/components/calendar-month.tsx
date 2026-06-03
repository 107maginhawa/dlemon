/**
 * CalendarMonth -- month grid view with appointment count badges
 *
 * 6 rows x 7 cols standard calendar grid (Mon-Sun).
 * Each cell shows day number + appointment count badge.
 * Overflow days (prev/next month) are greyed out.
 * Clicking a day fires onDayClick with YYYY-MM-DD.
 */

import React from 'react';
import type { Appointment } from './appointment-card';
import { APP_LOCALE } from '@/constants/brand';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Generate a 42-element array of ISO date strings (YYYY-MM-DD) representing
 * 6 weeks of the calendar grid for a given month (0-indexed).
 * Week starts on Monday.
 */
export function generateMonthGrid(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1);
  // getDay: 0=Sun..6=Sat. Convert to Mon-start: Mon=0..Sun=6
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6; // Sunday wraps

  const gridStart = new Date(year, month, 1 - startOffset);

  const dates: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Count appointments per date. Returns { 'YYYY-MM-DD': count }.
 */
export function countAppointmentsByDate(
  appointments: Array<{ scheduledAt: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const appt of appointments) {
    const date = appt.scheduledAt.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }
  return counts;
}

/**
 * Returns true if dateStr falls outside the target month (0-indexed).
 */
export function isOverflowDay(dateStr: string, year: number, month: number): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getFullYear() !== year || d.getMonth() !== month;
}

// ---------------------------------------------------------------------------
// Status dot colors
// ---------------------------------------------------------------------------

const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled: 'bg-blue-400',
  checkedIn: 'bg-teal-400',
  completed: 'bg-green-400',
  cancelled: 'bg-gray-300',
  noShow: 'bg-red-400',
};

function getStatusDots(appointments: Appointment[]): string[] {
  // Return unique status colors for this day (max 4)
  const seen = new Set<string>();
  const dots: string[] = [];
  for (const appt of appointments) {
    const color: string = STATUS_DOT_COLOR[appt.status] ?? STATUS_DOT_COLOR.scheduled ?? 'bg-blue-400';
    if (!seen.has(color)) {
      seen.add(color);
      dots.push(color);
      if (dots.length >= 4) break;
    }
  }
  return dots;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CalendarMonthProps {
  /** Currently selected date (determines which month to show) */
  selectedDate: string;
  /** All appointments for the displayed month */
  appointments: Appointment[];
  /** Called when user clicks a day cell */
  onDayClick: (date: string) => void;
}

export function CalendarMonth({ selectedDate, appointments, onDayClick }: CalendarMonthProps) {
  const selected = new Date(selectedDate + 'T12:00:00');
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const grid = generateMonthGrid(year, month);
  const counts = countAppointmentsByDate(appointments);

  const todayISO = new Date().toISOString().slice(0, 10);

  // Group appointments by date for dot colors
  const byDate: Record<string, Appointment[]> = {};
  for (const appt of appointments) {
    const d = appt.scheduledAt.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(appt);
  }

  const monthTitle = selected.toLocaleDateString(APP_LOCALE, { month: 'long', year: 'numeric' });

  return (
    <div className="flex-1 bg-background overflow-auto p-4" role="main" aria-label="Month schedule">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((name) => (
          <div
            key={name}
            className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-2"
            role="columnheader"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Day grid — 6 rows */}
      <div className="grid grid-cols-7 border-t border-l border-border">
        {grid.map((dateStr) => {
          const overflow = isOverflowDay(dateStr, year, month);
          const isToday = dateStr === todayISO;
          const isSelected = dateStr === selectedDate;
          const count = counts[dateStr] || 0;
          const dayNum = new Date(dateStr + 'T12:00:00').getDate();
          const dots = getStatusDots(byDate[dateStr] || []);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick(dateStr)}
              className={[
                'relative h-20 border-r border-b border-border p-1.5 text-left transition-colors',
                'hover:bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-lemon focus:ring-inset',
                overflow ? 'bg-secondary/10' : 'bg-background',
                isToday ? 'bg-[rgba(255,233,125,0.1)]' : '',
                isSelected ? 'ring-1 ring-lemon ring-inset' : '',
              ].join(' ')}
              aria-label={`${dateStr}${count > 0 ? `, ${count} appointment${count > 1 ? 's' : ''}` : ''}${isToday ? ', today' : ''}`}
              data-testid={`month-day-${dateStr}`}
            >
              {/* Day number */}
              <span
                className={[
                  'inline-flex items-center justify-center text-sm font-semibold tabular-nums',
                  isToday
                    ? 'bg-lemon text-lemon-foreground w-7 h-7 rounded-full text-[13px]'
                    : overflow
                      ? 'text-muted-foreground/40'
                      : 'text-foreground',
                ].join(' ')}
              >
                {dayNum}
              </span>

              {/* Appointment count badge */}
              {count > 0 && (
                <span
                  className={[
                    'absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold',
                    'flex items-center justify-center px-1',
                    overflow
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-lemon text-lemon-foreground',
                  ].join(' ')}
                  data-testid={`month-badge-${dateStr}`}
                >
                  {count}
                </span>
              )}

              {/* Status dots */}
              {dots.length > 0 && (
                <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">
                  {dots.map((color, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
