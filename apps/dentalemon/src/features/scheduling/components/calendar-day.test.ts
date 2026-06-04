/**
 * CalendarDay component tests — pure logic helpers
 *
 * Tests: time slot generation, appointment positioning,
 * time label formatting, grouping by hour
 */

import { describe, test, expect } from 'bun:test';
import {
  generateTimeSlots,
  formatTimeLabel,
  pxDeltaToMinutes,
  computeDraggedStart,
  computeResizedDuration,
  canReschedule,
  RESCHEDULE_SNAP_MINUTES,
} from './calendar-day';

// ---------------------------------------------------------------------------
// Local helpers not exported by the component
// ---------------------------------------------------------------------------

interface SimpleAppointment {
  id: string;
  scheduledAt: string;
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
  test('returns 30 slots (7AM-10PM @ 30min)', () => {
    const slots = generateTimeSlots();
    expect(slots).toHaveLength(30);
  });

  test('first slot is 07:00', () => {
    const slots = generateTimeSlots();
    expect(slots[0].hour).toBe(7);
    expect(slots[0].minute).toBe(0);
    expect(slots[0].label).toBe('7:00 AM');
  });

  test('last slot is 21:30', () => {
    const slots = generateTimeSlots();
    const last = slots[slots.length - 1];
    expect(last.hour).toBe(21);
    expect(last.minute).toBe(30);
    expect(last.label).toBe('9:30 PM');
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

// ---------------------------------------------------------------------------
// Drag-to-reschedule geometry (P2-15 feature 3)
// SLOT_HEIGHT_PX = 48 over 30 min → 1.6 px/min. Snap = 15 min = 24px.
// ---------------------------------------------------------------------------

describe('CalendarDay — pxDeltaToMinutes', () => {
  test('snaps to 15-minute increments', () => {
    expect(pxDeltaToMinutes(24)).toBe(15);   // exactly one snap unit down
    expect(pxDeltaToMinutes(48)).toBe(30);   // one slot
    expect(pxDeltaToMinutes(-24)).toBe(-15); // upward drag
  });

  test('rounds near-snap deltas to the nearest increment', () => {
    expect(pxDeltaToMinutes(20)).toBe(15); // 12.5 min → snaps to 15
    expect(pxDeltaToMinutes(5)).toBe(0);   // tiny jitter → no change
  });
});

describe('CalendarDay — computeDraggedStart', () => {
  test('moving down by one slot (48px) advances start by 30 minutes', () => {
    const next = computeDraggedStart('2026-06-01T09:00:00', 48, 30);
    expect(new Date(next).getHours()).toBe(9);
    expect(new Date(next).getMinutes()).toBe(30);
  });

  test('moving up by 24px moves start back 15 minutes', () => {
    const next = computeDraggedStart('2026-06-01T09:00:00', -24, 30);
    expect(new Date(next).getMinutes()).toBe(45);
    expect(new Date(next).getHours()).toBe(8);
  });

  test('clamps to the day start (cannot drag before 7AM)', () => {
    const next = computeDraggedStart('2026-06-01T07:15:00', -240, 30);
    expect(new Date(next).getHours()).toBe(7);
    expect(new Date(next).getMinutes()).toBe(0);
  });
});

describe('CalendarDay — computeResizedDuration', () => {
  test('dragging the handle down one slot adds 30 minutes', () => {
    expect(computeResizedDuration(30, 48)).toBe(60);
  });

  test('cannot shrink below the snap minimum', () => {
    expect(computeResizedDuration(30, -480)).toBe(RESCHEDULE_SNAP_MINUTES);
  });
});

describe('CalendarDay — canReschedule', () => {
  test('scheduled and confirmed are draggable', () => {
    expect(canReschedule('scheduled')).toBe(true);
    expect(canReschedule('confirmed')).toBe(true);
  });

  test('checked-in / terminal states are not draggable', () => {
    expect(canReschedule('checked_in')).toBe(false);
    expect(canReschedule('completed')).toBe(false);
    expect(canReschedule('cancelled')).toBe(false);
    expect(canReschedule('no_show')).toBe(false);
  });
});
