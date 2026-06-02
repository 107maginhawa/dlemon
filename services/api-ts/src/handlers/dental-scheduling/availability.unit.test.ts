/**
 * Pure unit tests for the P1-25 availability engine + online-booking config.
 * No database — exercises slot-grid math, timezone handling, lead-time/horizon
 * filters, conflict subtraction, and config parsing/defaults.
 */

import { describe, test, expect } from 'bun:test';
import { generateCandidateSlots, isSlotFree, type OccupiedInterval } from './availability';
import {
  parseOnlineBookingConfig,
  isOnlineBookable,
  durationForVisitType,
} from './online-booking-config';
import type { WorkingHours } from './workingHours';

const HOURS_9_5: WorkingHours = {
  monday: { enabled: true, open: '09:00', close: '17:00' },
  tuesday: { enabled: true, open: '09:00', close: '17:00' },
  wednesday: { enabled: true, open: '09:00', close: '17:00' },
  thursday: { enabled: true, open: '09:00', close: '17:00' },
  friday: { enabled: true, open: '09:00', close: '17:00' },
  saturday: { enabled: false },
  sunday: { enabled: false },
};

// A wide-open window far in the future so lead-time/horizon never trims.
const FAR = (days: number) => new Date(Date.now() + days * 86_400_000);

describe('generateCandidateSlots', () => {
  test('walks working hours in a 30-min grid and fits slots before close (UTC)', () => {
    // 2026-03-16 is a Monday.
    const slots = generateCandidateSlots({
      hours: HOURS_9_5,
      timezone: 'UTC',
      dateFrom: new Date('2026-03-16T00:00:00.000Z'),
      dateTo: new Date('2026-03-16T23:59:59.999Z'),
      stepMinutes: 30,
      durationMinutes: 30,
      notBefore: new Date('2026-03-01T00:00:00.000Z'),
      notAfter: new Date('2026-04-30T00:00:00.000Z'),
    });
    // 09:00 → last fitting 30-min slot starts 16:30 → 16 slots.
    expect(slots.length).toBe(16);
    expect(slots[0]!.startAt.toISOString()).toBe('2026-03-16T09:00:00.000Z');
    expect(slots[slots.length - 1]!.startAt.toISOString()).toBe('2026-03-16T16:30:00.000Z');
    // No slot crosses close.
    expect(slots.every((s) => s.endAt.getTime() <= new Date('2026-03-16T17:00:00.000Z').getTime())).toBe(true);
  });

  test('a 60-min slot length yields fewer slots and never crosses close', () => {
    const slots = generateCandidateSlots({
      hours: HOURS_9_5,
      timezone: 'UTC',
      dateFrom: new Date('2026-03-16T00:00:00.000Z'),
      dateTo: new Date('2026-03-16T23:59:59.999Z'),
      stepMinutes: 30,
      durationMinutes: 60,
      notBefore: new Date('2026-03-01T00:00:00.000Z'),
      notAfter: new Date('2026-04-30T00:00:00.000Z'),
    });
    // last 60-min slot starts 16:00.
    expect(slots[slots.length - 1]!.startAt.toISOString()).toBe('2026-03-16T16:00:00.000Z');
  });

  test('excludes disabled days (Saturday/Sunday closed)', () => {
    // 2026-03-21 Sat, 2026-03-22 Sun.
    const slots = generateCandidateSlots({
      hours: HOURS_9_5,
      timezone: 'UTC',
      dateFrom: new Date('2026-03-21T00:00:00.000Z'),
      dateTo: new Date('2026-03-22T23:59:59.999Z'),
      stepMinutes: 30,
      durationMinutes: 30,
      notBefore: new Date('2026-03-01T00:00:00.000Z'),
      notAfter: new Date('2026-04-30T00:00:00.000Z'),
    });
    expect(slots.length).toBe(0);
  });

  test('honors branch timezone — 09:00 local in America/New_York is 13:00/14:00 UTC', () => {
    const slots = generateCandidateSlots({
      hours: HOURS_9_5,
      timezone: 'America/New_York',
      dateFrom: new Date('2026-03-16T00:00:00.000Z'),
      dateTo: new Date('2026-03-16T23:59:59.999Z'),
      stepMinutes: 60,
      durationMinutes: 30,
      notBefore: new Date('2026-03-01T00:00:00.000Z'),
      notAfter: new Date('2026-04-30T00:00:00.000Z'),
    });
    // EDT (UTC-4) on that date → 09:00 local = 13:00 UTC.
    expect(slots[0]!.startAt.toISOString()).toBe('2026-03-16T13:00:00.000Z');
  });

  test('drops slots before lead-time and after horizon', () => {
    // Window includes Monday 2026-03-16; trim everything before 12:00 and after 14:00.
    const slots = generateCandidateSlots({
      hours: HOURS_9_5,
      timezone: 'UTC',
      dateFrom: new Date('2026-03-16T00:00:00.000Z'),
      dateTo: new Date('2026-03-16T23:59:59.999Z'),
      stepMinutes: 60,
      durationMinutes: 30,
      notBefore: new Date('2026-03-16T12:00:00.000Z'),
      notAfter: new Date('2026-03-16T14:00:00.000Z'),
    });
    expect(slots.map((s) => s.startAt.toISOString())).toEqual([
      '2026-03-16T12:00:00.000Z',
      '2026-03-16T13:00:00.000Z',
      '2026-03-16T14:00:00.000Z',
    ]);
  });
});

describe('isSlotFree', () => {
  const slot = {
    startAt: new Date('2026-03-16T09:00:00.000Z'),
    endAt: new Date('2026-03-16T09:30:00.000Z'),
  };

  test('free when no occupied interval overlaps', () => {
    const occupied: OccupiedInterval[] = [
      { startAt: new Date('2026-03-16T10:00:00.000Z'), durationMinutes: 30 },
    ];
    expect(isSlotFree(slot, occupied)).toBe(true);
  });

  test('not free when an appointment overlaps', () => {
    const occupied: OccupiedInterval[] = [
      { startAt: new Date('2026-03-16T09:15:00.000Z'), durationMinutes: 30 },
    ];
    expect(isSlotFree(slot, occupied)).toBe(false);
  });

  test('back-to-back intervals do not conflict (half-open)', () => {
    const occupied: OccupiedInterval[] = [
      { startAt: new Date('2026-03-16T09:30:00.000Z'), durationMinutes: 30 },
      { startAt: new Date('2026-03-16T08:30:00.000Z'), durationMinutes: 30 },
    ];
    expect(isSlotFree(slot, occupied)).toBe(true);
  });
});

describe('parseOnlineBookingConfig', () => {
  test('defaults to disabled with sane policy when settings missing', () => {
    const cfg = parseOnlineBookingConfig(undefined);
    expect(cfg.enabled).toBe(false);
    expect(cfg.leadTimeMinutes).toBe(120);
    expect(cfg.horizonDays).toBe(60);
    expect(cfg.slotStepMinutes).toBe(15);
    expect(cfg.bookableProviderMemberIds).toBe('all');
  });

  test('reads onlineBooking block out of branch settings', () => {
    const cfg = parseOnlineBookingConfig({
      clinicName: 'Acme',
      onlineBooking: { enabled: true, bookableVisitTypes: ['checkup'], leadTimeMinutes: 60 },
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.bookableVisitTypes).toEqual(['checkup']);
    expect(cfg.leadTimeMinutes).toBe(60);
  });

  test('falls back to defaults on a malformed block', () => {
    const cfg = parseOnlineBookingConfig({ onlineBooking: { leadTimeMinutes: 'soon' } });
    expect(cfg.enabled).toBe(false);
  });
});

describe('isOnlineBookable', () => {
  test('emergency is never bookable online even if configured', () => {
    const cfg = parseOnlineBookingConfig({ onlineBooking: { enabled: true, bookableVisitTypes: ['emergency', 'checkup'] } });
    expect(isOnlineBookable(cfg, 'emergency')).toBe(false);
    expect(isOnlineBookable(cfg, 'checkup')).toBe(true);
  });

  test('a type not in the allow-list is not bookable', () => {
    const cfg = parseOnlineBookingConfig({ onlineBooking: { enabled: true, bookableVisitTypes: ['checkup'] } });
    expect(isOnlineBookable(cfg, 'recall')).toBe(false);
  });
});

describe('durationForVisitType', () => {
  test('maps visit types to default durations', () => {
    expect(durationForVisitType('checkup')).toBe(30);
    expect(durationForVisitType('recall')).toBe(30);
    expect(durationForVisitType('treatment')).toBe(60);
  });
});
