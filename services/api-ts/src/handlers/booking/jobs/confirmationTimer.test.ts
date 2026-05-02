/**
 * Confirmation timer job unit tests
 *
 * Tests pure helper functions: isEligibleForAutoRejection and getTimeUntilAutoRejection.
 * The main job function requires a real DB, so we test the exported helpers.
 */

import { describe, test, expect } from 'bun:test';
import { isEligibleForAutoRejection, getTimeUntilAutoRejection } from './confirmationTimer';

describe('isEligibleForAutoRejection', () => {
  test('returns false for non-pending booking', () => {
    const booking = { status: 'confirmed', bookedAt: new Date(Date.now() - 20 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });

  test('returns false for already confirmed booking', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 20 * 60000), confirmationTimestamp: new Date() };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });

  test('returns true for pending booking past 15 min window', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 16 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking)).toBe(true);
  });

  test('returns false for pending booking within 15 min window', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 10 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });

  test('custom window: returns true after custom window', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 6 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking, 5)).toBe(true);
  });

  test('custom window: returns false within custom window', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 3 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking, 5)).toBe(false);
  });

  test('returns false for cancelled booking', () => {
    const booking = { status: 'cancelled', bookedAt: new Date(Date.now() - 20 * 60000), confirmationTimestamp: null };
    expect(isEligibleForAutoRejection(booking)).toBe(false);
  });
});

describe('getTimeUntilAutoRejection', () => {
  test('returns null for non-pending booking', () => {
    const booking = { status: 'confirmed', bookedAt: new Date(), confirmationTimestamp: null };
    expect(getTimeUntilAutoRejection(booking)).toBeNull();
  });

  test('returns null for confirmed booking', () => {
    const booking = { status: 'pending', bookedAt: new Date(), confirmationTimestamp: new Date() };
    expect(getTimeUntilAutoRejection(booking)).toBeNull();
  });

  test('returns positive seconds for booking within window', () => {
    // Booked 5 minutes ago, 15 min window -> ~10 min remaining
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 5 * 60000), confirmationTimestamp: null };
    const remaining = getTimeUntilAutoRejection(booking);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(500); // ~600 seconds
    expect(remaining!).toBeLessThanOrEqual(600);
  });

  test('returns 0 for booking past window', () => {
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 20 * 60000), confirmationTimestamp: null };
    const remaining = getTimeUntilAutoRejection(booking);
    expect(remaining).toBe(0);
  });

  test('respects custom window', () => {
    // Booked 3 minutes ago, 10 min window -> ~7 min remaining
    const booking = { status: 'pending', bookedAt: new Date(Date.now() - 3 * 60000), confirmationTimestamp: null };
    const remaining = getTimeUntilAutoRejection(booking, 10);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(380);
    expect(remaining!).toBeLessThanOrEqual(420);
  });
});
