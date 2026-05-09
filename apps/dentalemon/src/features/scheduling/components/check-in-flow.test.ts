/**
 * CheckInFlow tests — pure logic helpers
 *
 * Tests: check-in eligibility, response parsing
 */

import { describe, test, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

interface AppointmentStatus {
  status: string;
}

function canCheckIn(appointment: AppointmentStatus): boolean {
  return appointment.status === 'scheduled';
}

interface CheckInResponse {
  appointment: Record<string, unknown>;
  visitId: string;
}

function parseCheckInResponse(response: CheckInResponse): { visitId: string; appointment: Record<string, unknown> } {
  return {
    visitId: response.visitId,
    appointment: response.appointment,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CheckInFlow — canCheckIn', () => {
  test('canCheckIn({ status: "scheduled" }) === true', () => {
    expect(canCheckIn({ status: 'scheduled' })).toBe(true);
  });

  test('canCheckIn({ status: "checkedIn" }) === false', () => {
    expect(canCheckIn({ status: 'checkedIn' })).toBe(false);
  });
});

describe('CheckInFlow — parseCheckInResponse', () => {
  test('returns visitId and appointment', () => {
    const response: CheckInResponse = {
      appointment: { id: 'a-1', status: 'checkedIn' },
      visitId: 'v-1',
    };
    const result = parseCheckInResponse(response);
    expect(result.visitId).toBe('v-1');
    expect(result.appointment).toEqual({ id: 'a-1', status: 'checkedIn' });
  });
});
