/**
 * AppointmentModal component tests — pure logic helpers
 *
 * Tests: form validation, payload builder, and duration options
 * against real production exports only.
 */

import { describe, test, expect } from 'bun:test';
import {
  validateAppointmentForm,
  buildAppointmentPayload,
  DURATION_OPTIONS,
} from './appointment-modal';

describe('AppointmentModal — form validation', () => {
  const valid = {
    patientId: 'p-1',
    dentistMemberId: 'm-1',
    branchId: '00000000-0000-4000-8000-000000000001',
    date: '2026-06-01',
    time: '09:00',
    durationMinutes: 30,
    serviceType: 'Cleaning',
    notes: '',
    walkIn: false,
  };

  test('valid form builds correct payload', () => {
    const payload = buildAppointmentPayload(valid);
    expect(payload.patientId).toBe('p-1');
    expect(payload.scheduledAt).toBe('2026-06-01T09:00:00');
    expect(payload.durationMinutes).toBe(30);
    expect(payload.serviceType).toBe('Cleaning');
    expect(payload.walkIn).toBe(false);
  });

  test('missing patientId produces error', () => {
    const errors = validateAppointmentForm({ ...valid, patientId: '' });
    expect(errors).toContain('Patient ID is required');
  });

  test('missing serviceType produces error', () => {
    const errors = validateAppointmentForm({ ...valid, serviceType: '' });
    expect(errors).toContain('Service type is required');
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

describe('DURATION_OPTIONS', () => {
  test('has exactly 4 options', () => {
    expect(DURATION_OPTIONS).toHaveLength(4);
  });

  test('values are 30, 60, 90, 120', () => {
    expect(DURATION_OPTIONS.map(o => o.value)).toEqual([30, 60, 90, 120]);
  });

  test('labels match expected display strings', () => {
    expect(DURATION_OPTIONS[0].label).toBe('30 min');
    expect(DURATION_OPTIONS[1].label).toBe('1 hr');
    expect(DURATION_OPTIONS[2].label).toBe('1.5 hr');
    expect(DURATION_OPTIONS[3].label).toBe('2 hr');
  });

  test('each option has value and label', () => {
    for (const opt of DURATION_OPTIONS) {
      expect(opt.value).toBeGreaterThan(0);
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
