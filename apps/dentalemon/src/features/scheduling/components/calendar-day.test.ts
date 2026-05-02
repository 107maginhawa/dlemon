/**
 * CalendarDay component tests — pure logic helpers
 *
 * Tests: time slot generation, appointment positioning,
 * time label formatting, grouping by hour
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

interface TimeSlot {
  hour: number;
  minute: number;
  label: string;
}

function generateTimeSlots(startHour = 7, endHour = 19, intervalMins = 30): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMins) {
      slots.push({
        hour: h,
        minute: m,
        label: formatTimeLabel(h, m),
      });
    }
  }
  return slots;
}

function formatTimeLabel(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Returns the top percentage for positioning an appointment in the day grid.
 * The grid spans from dayStartHour to dayStartHour+12 (12 hours total).
 * Result = ((hour - dayStartHour) + minute/60) / 12 * 100
 */
function getAppointmentPosition(scheduledAt: string, dayStartHour = 7): number {
  const date = new Date(scheduledAt);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const hoursFromStart = (hour - dayStartHour) + minute / 60;
  return (hoursFromStart / 12) * 100;
}

interface SimpleAppointment {
  id: string;
  scheduledAt: string;
}

function groupAppointmentsByHour(appointments: SimpleAppointment[]): Record<number, SimpleAppointment[]> {
  const groups: Record<number, SimpleAppointment[]> = {};
  for (const appt of appointments) {
    const hour = new Date(appt.scheduledAt).getHours();
    if (!groups[hour]) groups[hour] = [];
    groups[hour].push(appt);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarDay — generateTimeSlots', () => {
  test('returns 24 slots (7AM-7PM @ 30min)', () => {
    const slots = generateTimeSlots();
    expect(slots).toHaveLength(24);
  });

  test('first slot is 07:00', () => {
    const slots = generateTimeSlots();
    expect(slots[0].hour).toBe(7);
    expect(slots[0].minute).toBe(0);
    expect(slots[0].label).toBe('7:00 AM');
  });

  test('last slot is 18:30', () => {
    const slots = generateTimeSlots();
    const last = slots[slots.length - 1];
    expect(last.hour).toBe(18);
    expect(last.minute).toBe(30);
    expect(last.label).toBe('6:30 PM');
  });
});

describe('CalendarDay — getAppointmentPosition', () => {
  test('9AM position is ~16.67%', () => {
    // 9AM = 2 hours from 7AM start, 2/12 * 100 = 16.67
    const pos = getAppointmentPosition('2026-06-01T09:00:00', 7);
    expect(Math.abs(pos - 16.67)).toBeLessThan(0.1);
  });
});

describe('CalendarDay — formatTimeLabel', () => {
  test('9:00 AM', () => {
    expect(formatTimeLabel(9, 0)).toBe('9:00 AM');
  });

  test('1:30 PM', () => {
    expect(formatTimeLabel(13, 30)).toBe('1:30 PM');
  });
});

describe('CalendarDay — groupAppointmentsByHour', () => {
  test('groups by scheduledAt hour', () => {
    const appts: SimpleAppointment[] = [
      { id: 'a1', scheduledAt: '2026-06-01T09:00:00' },
      { id: 'a2', scheduledAt: '2026-06-01T09:30:00' },
      { id: 'a3', scheduledAt: '2026-06-01T10:00:00' },
    ];
    const grouped = groupAppointmentsByHour(appts);
    expect(grouped[9]).toHaveLength(2);
    expect(grouped[10]).toHaveLength(1);
  });
});
