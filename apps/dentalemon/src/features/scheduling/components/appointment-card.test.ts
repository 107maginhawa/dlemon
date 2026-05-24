/**
 * AppointmentCard — unit tests (G6-S9)
 *
 * Tests exported pure functions + core rendering invariants.
 * No DOM rendering — avoids happy-dom setup overhead and tests
 * the stable, exported logic surface that drives the component.
 */

import { describe, test, expect } from 'bun:test';
import {
  getStatusBadgeProps,
  canCheckIn,
  type Appointment,
} from './appointment-card';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const BASE_APPOINTMENT: Appointment = {
  id: 'appt-001',
  patientId: 'patient-abc',
  patientName: 'Maria Santos',
  scheduledAt: '2026-05-24T09:00:00.000Z',
  durationMinutes: 30,
  serviceType: 'Cleaning',
  status: 'scheduled',
};

// ---------------------------------------------------------------------------
// getStatusBadgeProps
// ---------------------------------------------------------------------------

describe('getStatusBadgeProps — label mapping', () => {
  test('scheduled → "Scheduled" with blue classes', () => {
    const props = getStatusBadgeProps('scheduled');
    expect(props.label).toBe('Scheduled');
    expect(props.className).toContain('blue');
  });

  test('checked_in → "Checked In"', () => {
    const props = getStatusBadgeProps('checked_in');
    expect(props.label).toBe('Checked In');
  });

  test('completed → "Completed" with green classes', () => {
    const props = getStatusBadgeProps('completed');
    expect(props.label).toBe('Completed');
    expect(props.className).toContain('green');
  });

  test('cancelled → "Cancelled" with gray classes', () => {
    const props = getStatusBadgeProps('cancelled');
    expect(props.label).toBe('Cancelled');
    expect(props.className).toContain('gray');
  });

  test('no_show → "No Show" with red classes', () => {
    const props = getStatusBadgeProps('no_show');
    expect(props.label).toBe('No Show');
    expect(props.className).toContain('red');
  });

  test('unknown status returns the raw status string', () => {
    const props = getStatusBadgeProps('some_future_status');
    expect(props.label).toBe('some_future_status');
    expect(props.className).toContain('gray');
  });
});

// ---------------------------------------------------------------------------
// canCheckIn
// ---------------------------------------------------------------------------

describe('canCheckIn — eligibility logic', () => {
  test('status "scheduled" → true', () => {
    expect(canCheckIn('scheduled')).toBe(true);
  });

  test('status "checked_in" → false', () => {
    expect(canCheckIn('checked_in')).toBe(false);
  });

  test('status "completed" → false', () => {
    expect(canCheckIn('completed')).toBe(false);
  });

  test('status "cancelled" → false', () => {
    expect(canCheckIn('cancelled')).toBe(false);
  });

  test('status "no_show" → false', () => {
    expect(canCheckIn('no_show')).toBe(false);
  });

  test('unknown status → false (safe default)', () => {
    expect(canCheckIn('unknown_status')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Appointment interface shape (type-level guard)
// ---------------------------------------------------------------------------

describe('Appointment interface', () => {
  test('required fields are present in fixture', () => {
    expect(BASE_APPOINTMENT.id).toBeDefined();
    expect(BASE_APPOINTMENT.patientId).toBeDefined();
    expect(BASE_APPOINTMENT.scheduledAt).toBeDefined();
    expect(BASE_APPOINTMENT.durationMinutes).toBeGreaterThan(0);
    expect(BASE_APPOINTMENT.serviceType.length).toBeGreaterThan(0);
    expect(BASE_APPOINTMENT.status.length).toBeGreaterThan(0);
  });

  test('optional fields are not required', () => {
    const minimal: Appointment = {
      id: 'x',
      patientId: 'p1',
      scheduledAt: '2026-01-01T00:00:00Z',
      durationMinutes: 15,
      serviceType: 'Exam',
      status: 'scheduled',
    };
    expect(minimal.patientName).toBeUndefined();
    expect(minimal.notes).toBeUndefined();
    expect(minimal.walkIn).toBeUndefined();
  });

  test('walkIn flag coerces correctly', () => {
    const walkIn: Appointment = { ...BASE_APPOINTMENT, walkIn: true };
    expect(walkIn.walkIn).toBe(true);
    const notWalkIn: Appointment = { ...BASE_APPOINTMENT, walkIn: false };
    expect(notWalkIn.walkIn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Status badge className integrity
// ---------------------------------------------------------------------------

describe('getStatusBadgeProps — className never empty', () => {
  const statuses = ['scheduled', 'checked_in', 'completed', 'cancelled', 'no_show', 'draft', ''];

  for (const status of statuses) {
    test(`status "${status}" always has a non-empty className`, () => {
      const { className } = getStatusBadgeProps(status);
      expect(className.trim().length).toBeGreaterThan(0);
    });
  }
});
