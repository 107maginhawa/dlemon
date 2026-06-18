/**
 * CalendarWeek — 7-column week grid with appointment chips
 *
 * Wireframe: docs/prd/context/wireframes/calendar-week.html
 */

import React from 'react';
import type { Appointment } from './appointment-card';
import { computeAppointmentColumns, type AppointmentColumn } from '../utils/appointment-layout';
import { activateOnKey } from '@/lib/a11y';

const SLOT_HEIGHT_PX = 48;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2;

/** Horizontal inset (px) inside a day column, matching the legacy left/right-[3px]. */
const WEEK_GUTTER_PX = 3;
/** Gap (px) between side-by-side overlapping chips within a day column. */
const WEEK_COLUMN_GAP_PX = 2;

/** Horizontal placement for a week-view chip; lone chips keep the full-width inset. */
function weekChipStyle({ col, cols }: AppointmentColumn): React.CSSProperties {
  if (cols <= 1) return { left: WEEK_GUTTER_PX, right: WEEK_GUTTER_PX };
  const avail = `(100% - ${2 * WEEK_GUTTER_PX}px)`;
  return {
    left: `calc(${WEEK_GUTTER_PX}px + ${col} * (${avail} / ${cols}))`,
    width: `calc(${avail} / ${cols} - ${WEEK_COLUMN_GAP_PX}px)`,
  };
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function getTopPx(scheduledAt: string): number {
  const d = new Date(scheduledAt);
  const h = d.getHours();
  const m = d.getMinutes();
  const slotsFromStart = (h - DAY_START_HOUR) * 2 + m / 30;
  return slotsFromStart * SLOT_HEIGHT_PX;
}

export function getHeightPx(durationMinutes: number): number {
  return Math.max((durationMinutes / 30) * SLOT_HEIGHT_PX - 4, 30);
}

export function formatChipTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function truncateId(id: string, maxLen = 8): string {
  return id.length <= maxLen ? id : id.slice(0, maxLen) + '...';
}

const statusChipStyle: Record<string, string> = {
  scheduled: 'bg-blue-50/80 border-l-blue-500',
  checkedIn: 'bg-teal-50/80 border-l-teal-500',
  completed: 'bg-green-50/80 border-l-green-500',
  cancelled: 'bg-gray-50/60 border-l-gray-300 opacity-50',
  noShow: 'bg-red-50/80 border-l-red-500',
};

export interface CalendarWeekProps {
  weekStart: string;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onDayClick: (date: string) => void;
}

export function CalendarWeek({ weekStart, appointments, onAppointmentClick, onDayClick }: CalendarWeekProps) {
  const weekDates = getWeekDates(weekStart);
  const todayISO = new Date().toISOString().slice(0, 10);

  // Group appointments by date
  const byDate: Record<string, Appointment[]> = {};
  for (const appt of appointments) {
    const d = appt.scheduledAt.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(appt);
  }

  // Generate time labels
  const timeLabels: { hour: number; minute: number }[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    timeLabels.push({ hour: h, minute: 0 });
    timeLabels.push({ hour: h, minute: 30 });
  }
  // Final 7PM label
  timeLabels.push({ hour: DAY_END_HOUR, minute: 0 });

  return (
    <div className="flex-1 bg-background overflow-hidden flex flex-col" role="main" aria-label="Week schedule" data-testid="calendar-week">
      {/* Column headers */}
      <div className="grid flex-shrink-0 border-b border-border" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-border h-12" />
        {weekDates.map((d, i) => {
          const isToday = d === todayISO;
          const dayNum = new Date(d).getDate();
          const isWeekend = i >= 5;
          return (
            <div
              key={d}
              className={`h-12 flex flex-col items-center justify-center gap-0.5 border-r border-border/40 cursor-pointer hover:bg-secondary/40 transition-colors ${
                isToday ? 'bg-lemon-soft' : isWeekend ? 'bg-secondary/20' : ''
              }`}
              role="columnheader"
              aria-label={`${DAY_NAMES[i]} ${dayNum}${isToday ? ', today' : ''}`}
              onClick={() => onDayClick(d)}
            >
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-lemon-foreground' : 'text-muted-foreground'}`}>
                {DAY_NAMES[i]}
              </span>
              <span
                className={`text-lg font-bold tabular-nums leading-none ${
                  isToday
                    ? 'bg-lemon text-lemon-foreground w-[30px] h-[30px] rounded-full flex items-center justify-center text-[15px]'
                    : ''
                }`}
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Week body */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* Time labels */}
          <div className="border-r border-border" aria-hidden="true">
            {timeLabels.map((slot, i) => {
              const isHour = slot.minute === 0;
              const isLast = i === timeLabels.length - 1;
              return (
                <div
                  key={i}
                  className="flex items-start justify-end pr-2 pt-1 border-b border-border/40"
                  style={{ height: isLast ? SLOT_HEIGHT_PX : SLOT_HEIGHT_PX }}
                >
                  <span className="text-[11px] font-medium tabular-nums whitespace-nowrap" style={{ color: isHour ? undefined : 'transparent' }}>
                    {isHour ? `${slot.hour > 12 ? slot.hour - 12 : slot.hour} ${slot.hour >= 12 ? 'PM' : 'AM'}` : '.'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {weekDates.map((d, colIdx) => {
            const isToday = d === todayISO;
            const isWeekend = colIdx >= 5;
            const dayAppts = byDate[d] || [];

            // Current time line
            let currentTimeTop: number | null = null;
            if (isToday) {
              const now = new Date();
              const h = now.getHours();
              const m = now.getMinutes();
              if (h >= DAY_START_HOUR && h < DAY_END_HOUR) {
                currentTimeTop = getTopPx(`${d}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
              }
            }

            return (
              <div
                key={d}
                className={`border-r border-border/40 relative ${
                  isToday ? 'bg-[rgba(255,233,125,0.03)]' : isWeekend ? 'bg-secondary/10' : ''
                }`}
                aria-label={`${DAY_NAMES[colIdx]} appointments`}
              >
                {/* Slot rows */}
                {timeLabels.map((_, i) => (
                  <div key={i} className="border-b border-border/40" style={{ height: SLOT_HEIGHT_PX }} />
                ))}

                {/* Appointment chips — overlapping chips split into columns */}
                {(() => { const dayColumns = computeAppointmentColumns(dayAppts); return dayAppts.map(appt => {
                  const top = getTopPx(appt.scheduledAt);
                  const height = getHeightPx(appt.durationMinutes);
                  const chipStyle = statusChipStyle[appt.status] || statusChipStyle.scheduled;
                  const column = dayColumns.get(appt.id) ?? { col: 0, cols: 1 };
                  return (
                    <div
                      key={appt.id}
                      className={`absolute border-l-[3px] rounded-[5px] px-1.5 py-1 cursor-pointer overflow-hidden z-[2] hover:brightness-95 transition-all min-h-[30px] ${chipStyle}`}
                      style={{ top, height, ...weekChipStyle(column) }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${truncateId(appt.patientId)}, ${formatChipTime(appt.scheduledAt)}`}
                      onClick={() => onAppointmentClick(appt)}
                      onKeyDown={activateOnKey(() => onAppointmentClick(appt))}
                    >
                      <div className="text-[11px] font-semibold truncate">{truncateId(appt.patientId)}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">{formatChipTime(appt.scheduledAt)}</div>
                    </div>
                  );
                }); })()}

                {/* Empty state */}
                {dayAppts.length === 0 && (
                  <div className="absolute inset-2 border-[1.5px] border-dashed border-border/20 rounded-md flex items-center justify-center pointer-events-none" aria-hidden="true">
                    <span className="text-[10px] font-medium text-muted-foreground/30">No appointments</span>
                  </div>
                )}

                {/* Current time line */}
                {currentTimeTop !== null && (
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-lemon z-10 pointer-events-none"
                    style={{ top: currentTimeTop }}
                    role="presentation"
                  >
                    <div className="absolute -left-px -top-[4px] w-[10px] h-[10px] rounded-full bg-lemon" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
