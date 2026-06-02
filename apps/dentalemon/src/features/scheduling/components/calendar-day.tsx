/**
 * CalendarDay — vertical time grid from 7AM-7PM showing appointments
 *
 * Wireframe: docs/prd/context/wireframes/calendar-day.html
 */

import React from 'react';
import { AppointmentCard, type Appointment } from './appointment-card';

const SLOT_HEIGHT_PX = 48;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22; // Extended to 10 PM to capture late appointments
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2; // 30 half-hour slots

export function generateTimeSlots(startHour = DAY_START_HOUR, endHour = DAY_END_HOUR, intervalMins = 30) {
  const slots: { hour: number; minute: number; label: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMins) {
      slots.push({ hour: h, minute: m, label: formatTimeLabel(h, m) });
    }
  }
  return slots;
}

export function formatTimeLabel(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

function getTopPx(scheduledAt: string): number {
  const d = new Date(scheduledAt);
  const h = d.getHours();
  const m = d.getMinutes();
  const slotsFromStart = (h - DAY_START_HOUR) * 2 + m / 30;
  return slotsFromStart * SLOT_HEIGHT_PX;
}

function getHeightPx(durationMinutes: number): number {
  return (durationMinutes / 30) * SLOT_HEIGHT_PX - 6; // -6 for visual gap
}

const PX_PER_MINUTE = SLOT_HEIGHT_PX / 30;
/** Snap granularity for drag-to-reschedule (15-minute increments). */
export const RESCHEDULE_SNAP_MINUTES = 15;

/** Convert a vertical pixel delta into a minute delta snapped to RESCHEDULE_SNAP_MINUTES. */
export function pxDeltaToMinutes(deltaPx: number, snap = RESCHEDULE_SNAP_MINUTES): number {
  const rawMinutes = deltaPx / PX_PER_MINUTE;
  return Math.round(rawMinutes / snap) * snap;
}

/**
 * Compute the new start time after dragging an appointment by a pixel delta.
 * Clamps the start so the appointment stays within the day window.
 */
export function computeDraggedStart(
  scheduledAt: string,
  deltaPx: number,
  durationMinutes: number,
  dayStartHour = DAY_START_HOUR,
  dayEndHour = DAY_END_HOUR,
): string {
  const start = new Date(scheduledAt);
  const minuteDelta = pxDeltaToMinutes(deltaPx);
  let next = new Date(start.getTime() + minuteDelta * 60_000);
  const lowerBound = new Date(start);
  lowerBound.setHours(dayStartHour, 0, 0, 0);
  const upperBound = new Date(start);
  upperBound.setHours(dayEndHour, 0, 0, 0);
  upperBound.setTime(upperBound.getTime() - durationMinutes * 60_000);
  if (next.getTime() < lowerBound.getTime()) next = lowerBound;
  if (next.getTime() > upperBound.getTime()) next = upperBound;
  return next.toISOString();
}

/** Compute a new duration after resizing by a pixel delta. Minimum 15 minutes. */
export function computeResizedDuration(durationMinutes: number, deltaPx: number): number {
  const next = durationMinutes + pxDeltaToMinutes(deltaPx);
  return Math.max(RESCHEDULE_SNAP_MINUTES, next);
}

function formatSlotTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayH = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayH}:${minute.toString().padStart(2, '0')} ${period}`;
}

export interface CalendarDayProps {
  date: string;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onSlotClick: (time: string) => void;
  onCheckIn: (appointmentId: string) => void;
  onConfirm?: (appointmentId: string) => void;
  /** Drag-to-reschedule callback. newStartAt is a full ISO-8601 UTC timestamp. */
  onReschedule?: (appointmentId: string, newStartAt: string, newDurationMinutes: number) => void;
}

export function CalendarDay({ date, appointments, onAppointmentClick, onSlotClick, onCheckIn, onConfirm, onReschedule }: CalendarDayProps) {
  const slots = generateTimeSlots();

  // Current time indicator
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const isToday = date === todayISO;
  let currentTimeTop: number | null = null;
  if (isToday) {
    const h = now.getHours();
    const m = now.getMinutes();
    if (h >= DAY_START_HOUR && h < DAY_END_HOUR) {
      currentTimeTop = getTopPx(`${date}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
    }
  }

  return (
    <div className="flex-1 bg-background overflow-y-auto" role="main" aria-label="Day schedule">
      <div className="grid" style={{ gridTemplateColumns: '56px 1fr' }}>
        {/* Time labels */}
        <div className="border-r border-border sticky left-0 z-[5] bg-background" aria-hidden="true">
          {slots.map((slot, i) => {
            const isHour = slot.minute === 0;
            return (
              <div
                key={i}
                className="flex items-start justify-end pr-2 pt-1 border-b border-border/40"
                style={{ height: SLOT_HEIGHT_PX }}
              >
                <span className="text-[11px] font-medium tabular-nums whitespace-nowrap" style={{ color: isHour ? undefined : 'transparent' }}>
                  {isHour ? `${slot.hour > 12 ? slot.hour - 12 : slot.hour} ${slot.hour >= 12 ? 'PM' : 'AM'}` : '.'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Appointments column */}
        <div className="relative" style={{ minHeight: TOTAL_SLOTS * SLOT_HEIGHT_PX }}>
          {/* Slot rows */}
          {slots.map((slot, i) => (
            <div
              key={i}
              className="border-b border-border/40 relative group"
              style={{ height: SLOT_HEIGHT_PX }}
            >
              <div
                className="absolute inset-1.5 border-[1.5px] border-dashed border-border rounded-md flex items-center justify-center text-[11px] font-medium text-muted-foreground/40 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                role="button"
                tabIndex={0}
                aria-label={`Book ${formatSlotTime(slot.hour, slot.minute)} slot`}
                onClick={() => onSlotClick(formatSlotTime(slot.hour, slot.minute))}
              >
                + tap to book
              </div>
            </div>
          ))}

          {/* Appointment blocks */}
          {appointments.map(appt => (
            <DraggableAppointment
              key={appt.id}
              appt={appt}
              top={getTopPx(appt.scheduledAt)}
              height={Math.max(getHeightPx(appt.durationMinutes), 36)}
              onAppointmentClick={onAppointmentClick}
              onCheckIn={onCheckIn}
              onConfirm={onConfirm}
              onReschedule={onReschedule}
            />
          ))}

          {/* Current time line */}
          {currentTimeTop !== null && (
            <div
              className="absolute left-0 right-0 h-0.5 bg-[#FFE97D] z-10 pointer-events-none"
              style={{ top: currentTimeTop }}
              role="presentation"
              aria-label={`Current time`}
            >
              <div className="absolute -left-px -top-[4px] w-[10px] h-[10px] rounded-full bg-[#FFE97D]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Statuses whose appointments may be dragged/resized on the grid. */
export function canReschedule(status: string): boolean {
  return status === 'scheduled' || status === 'confirmed';
}

interface DraggableAppointmentProps {
  appt: Appointment;
  top: number;
  height: number;
  onAppointmentClick: (appointment: Appointment) => void;
  onCheckIn: (appointmentId: string) => void;
  onConfirm?: (appointmentId: string) => void;
  onReschedule?: (appointmentId: string, newStartAt: string, newDurationMinutes: number) => void;
}

/**
 * Wraps an AppointmentCard with pointer-driven drag-to-reschedule (move) and a
 * bottom resize handle (duration). Both snap to 15-minute increments and commit
 * via onReschedule on pointer-up. Dragging is disabled for non-reschedulable
 * statuses (checked-in / completed / cancelled / no-show).
 */
function DraggableAppointment({
  appt, top, height, onAppointmentClick, onCheckIn, onConfirm, onReschedule,
}: DraggableAppointmentProps) {
  const dragEnabled = !!onReschedule && canReschedule(appt.status);
  const [offsetY, setOffsetY] = React.useState(0);
  const [extraHeight, setExtraHeight] = React.useState(0);
  const modeRef = React.useRef<'move' | 'resize' | null>(null);
  const startYRef = React.useRef(0);
  const movedRef = React.useRef(false);

  function endDrag(deltaPx: number) {
    const mode = modeRef.current;
    modeRef.current = null;
    setOffsetY(0);
    setExtraHeight(0);
    if (!onReschedule || !movedRef.current) return;
    if (mode === 'move') {
      const newStart = computeDraggedStart(appt.scheduledAt, deltaPx, appt.durationMinutes);
      const changed = pxDeltaToMinutes(deltaPx) !== 0;
      if (changed) onReschedule(appt.id, newStart, appt.durationMinutes);
    } else if (mode === 'resize') {
      const newDuration = computeResizedDuration(appt.durationMinutes, deltaPx);
      if (newDuration !== appt.durationMinutes) {
        onReschedule(appt.id, new Date(appt.scheduledAt).toISOString(), newDuration);
      }
    }
  }

  function handlePointerDown(mode: 'move' | 'resize', e: React.PointerEvent) {
    if (!dragEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    modeRef.current = mode;
    startYRef.current = e.clientY;
    movedRef.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!modeRef.current) return;
    const delta = e.clientY - startYRef.current;
    if (Math.abs(delta) > 2) movedRef.current = true;
    const snapped = pxDeltaToMinutes(delta) * PX_PER_MINUTE;
    if (modeRef.current === 'move') setOffsetY(snapped);
    else setExtraHeight(snapped);
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!modeRef.current) return;
    endDrag(e.clientY - startYRef.current);
  }

  return (
    <div
      className="absolute left-2 right-2 z-[2] touch-none"
      style={{ top: top + offsetY, height: Math.max(height + extraHeight, 36) }}
      onPointerMove={dragEnabled ? handlePointerMove : undefined}
      onPointerUp={dragEnabled ? handlePointerUp : undefined}
    >
      <div
        onPointerDown={(e) => handlePointerDown('move', e)}
        className={dragEnabled ? 'cursor-grab active:cursor-grabbing h-full' : 'h-full'}
        data-testid={`appt-draggable-${appt.id}`}
      >
        <AppointmentCard
          appointment={appt}
          onClick={onAppointmentClick}
          onCheckIn={onCheckIn}
          onConfirm={onConfirm}
        />
      </div>
      {dragEnabled && (
        <div
          onPointerDown={(e) => handlePointerDown('resize', e)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-2 cursor-ns-resize flex items-center justify-center"
          role="separator"
          aria-label={`Resize ${appt.serviceType} appointment`}
          data-testid={`appt-resize-${appt.id}`}
        >
          <div className="w-6 h-1 rounded-full bg-border" />
        </div>
      )}
    </div>
  );
}
