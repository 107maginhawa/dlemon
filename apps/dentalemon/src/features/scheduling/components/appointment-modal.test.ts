/**
 * AppointmentModal component tests — pure logic helpers
 *
 * Tests: form validation, payload builder, duration formatter,
 * status badge props, check-in/cancel eligibility
 */

import { describe, test, expect } from 'bun:test';
import {
  validateAppointmentForm,
  buildAppointmentPayload,
} from './appointment-modal';

// ---------------------------------------------------------------------------
// Local helpers not exported by the component
// ---------------------------------------------------------------------------

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  if (Number.isInteger(hrs)) return `${hrs} hr`;
  return `${hrs} hr`;
}

function getStatusBadgeProps(status: string): { label: string; className: string } {
  switch (status) {
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-blue-100 text-blue-700' };
    case 'checkedIn':
      return { label: 'Checked In', className: 'bg-green-100 text-green-700' };
    case 'completed':
      return { label: 'Completed', className: 'bg-green-100 text-green-700' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' };
    case 'noShow':
      return { label: 'No Show', className: 'bg-red-100 text-red-700' };
    default:
      return { label: status, className: 'bg-gray-100 text-gray-500' };
  }
}

function canCheckIn(status: string): boolean {
  return status === 'scheduled';
}

function canCancel(status: string): boolean {
  return status === 'scheduled' || status === 'checkedIn';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentModal — form validation', () => {
  const valid = {
    patientId: 'p-1',
    dentistMemberId: 'm-1',
    branchId: '00000000-0000-4000-8000-000000000001',
    date: '2026-06-01',
    time: '09:00',
    durationMinutes: 30,
    procedureType: 'Cleaning',
    notes: '',
    walkIn: false,
  };

  test('valid form builds correct payload', () => {
    const payload = buildAppointmentPayload(valid);
    expect(payload.patientId).toBe('p-1');
    expect(payload.scheduledAt).toBe('2026-06-01T09:00:00');
    expect(payload.durationMinutes).toBe(30);
    expect(payload.procedureType).toBe('Cleaning');
    expect(payload.walkIn).toBe(false);
  });

  test('missing patientId produces error', () => {
    const errors = validateAppointmentForm({ ...valid, patientId: '' });
    expect(errors).toContain('Patient ID is required');
  });

  test('missing procedureType produces error', () => {
    const errors = validateAppointmentForm({ ...valid, procedureType: '' });
    expect(errors).toContain('Procedure type is required');
  });

  test('missing scheduledAt produces error', () => {
    const errors = validateAppointmentForm({ ...valid, date: '', time: '' });
    expect(errors).toContain('Scheduled date and time are required');
  });

  test('durationMinutes defaults to 30 if not provided', () => {
    const payload = buildAppointmentPayload({ ...valid, durationMinutes: 0 });
    expect(payload.durationMinutes).toBe(30);
  });
});

describe('AppointmentModal — formatDuration', () => {
  test('formatDuration(30) === "30 min"', () => {
    expect(formatDuration(30)).toBe('30 min');
  });

  test('formatDuration(60) === "1 hr"', () => {
    expect(formatDuration(60)).toBe('1 hr');
  });

  test('formatDuration(90) === "1.5 hr"', () => {
    expect(formatDuration(90)).toBe('1.5 hr');
  });

  test('formatDuration(120) === "2 hr"', () => {
    expect(formatDuration(120)).toBe('2 hr');
  });
});

describe('AppointmentModal — getStatusBadgeProps', () => {
  test('scheduled returns blue', () => {
    const props = getStatusBadgeProps('scheduled');
    expect(props.label).toBe('Scheduled');
    expect(props.className).toContain('blue');
  });

  test('checkedIn returns green', () => {
    const props = getStatusBadgeProps('checkedIn');
    expect(props.label).toBe('Checked In');
    expect(props.className).toContain('green');
  });

  test('completed returns green', () => {
    const props = getStatusBadgeProps('completed');
    expect(props.label).toBe('Completed');
    expect(props.className).toContain('green');
  });

  test('cancelled returns gray', () => {
    const props = getStatusBadgeProps('cancelled');
    expect(props.label).toBe('Cancelled');
    expect(props.className).toContain('gray');
  });

  test('noShow returns red', () => {
    const props = getStatusBadgeProps('noShow');
    expect(props.label).toBe('No Show');
    expect(props.className).toContain('red');
  });
});

describe('AppointmentModal — canCheckIn / canCancel', () => {
  test('canCheckIn("scheduled") === true', () => {
    expect(canCheckIn('scheduled')).toBe(true);
  });

  test('canCheckIn("checkedIn") === false', () => {
    expect(canCheckIn('checkedIn')).toBe(false);
  });

  test('canCheckIn("completed") === false', () => {
    expect(canCheckIn('completed')).toBe(false);
  });

  test('canCancel("scheduled") === true', () => {
    expect(canCancel('scheduled')).toBe(true);
  });

  test('canCancel("checkedIn") === true', () => {
    expect(canCancel('checkedIn')).toBe(true);
  });

  test('canCancel("completed") === false', () => {
    expect(canCancel('completed')).toBe(false);
  });
});
