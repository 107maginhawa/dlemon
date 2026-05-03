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
}

export function CalendarDay({ date, appointments, onAppointmentClick, onSlotClick, onCheckIn }: CalendarDayProps) {
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
          {appointments.map(appt => {
            const top = getTopPx(appt.scheduledAt);
            const height = getHeightPx(appt.durationMinutes);
            return (
              <div
                key={appt.id}
                className="absolute left-2 right-2 z-[2]"
                style={{ top, height: Math.max(height, 36) }}
              >
                <AppointmentCard
                  appointment={appt}
                  onClick={onAppointmentClick}
                  onCheckIn={onCheckIn}
                />
              </div>
            );
          })}

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
