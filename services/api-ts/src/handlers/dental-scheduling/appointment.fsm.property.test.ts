/**
 * Property-based tests for the Appointment FSM
 *
 * Appointment lifecycle:
 *   scheduled → checked_in → completed | cancelled | no_show
 *   no_show → completed (reversible per schema comment)
 *   completed, cancelled are terminal
 *
 * Imports APPOINTMENT_TRANSITIONS from the schema.
 *
 * G6-S2: property tests via fast-check
 */
import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import { APPOINTMENT_TRANSITIONS, VALID_APPOINTMENT_STATUSES, type AppointmentStatus } from './repos/dental-appointment.schema';

const STATES = VALID_APPOINTMENT_STATUSES;

function isValidTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from].includes(to);
}

describe('Appointment FSM property tests', () => {
  test('declared transitions are bidirectionally consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATES),
        fc.constantFrom(...STATES),
        (from, to) => {
          const declared = APPOINTMENT_TRANSITIONS[from].includes(to);
          const computed = isValidTransition(from, to);
          expect(declared).toBe(computed);
        },
      ),
      { numRuns: 200 },
    );
  });

  test('terminal states reject all outgoing transitions', () => {
    const terminals = STATES.filter(s => APPOINTMENT_TRANSITIONS[s].length === 0);
    expect(terminals).toContain('completed');
    expect(terminals).toContain('cancelled');
    for (const terminal of terminals) {
      for (const to of STATES) {
        expect(isValidTransition(terminal, to)).toBe(false);
      }
    }
  });

  test('every declared target is a known state', () => {
    for (const from of STATES) {
      for (const to of APPOINTMENT_TRANSITIONS[from]) {
        expect(STATES).toContain(to as AppointmentStatus);
      }
    }
  });

  test('no self-loops are declared', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATES), (state) => {
        expect(isValidTransition(state, state)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  test('scheduled can move to confirmed, checked_in, cancelled, or no_show', () => {
    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('confirmed');
    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('checked_in');
    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('cancelled');
    expect(APPOINTMENT_TRANSITIONS['scheduled']).toContain('no_show');
  });

  test('confirmed can move to checked_in, cancelled, or no_show (but not back to scheduled)', () => {
    expect(APPOINTMENT_TRANSITIONS['confirmed']).toContain('checked_in');
    expect(APPOINTMENT_TRANSITIONS['confirmed']).toContain('cancelled');
    expect(APPOINTMENT_TRANSITIONS['confirmed']).toContain('no_show');
    expect(isValidTransition('confirmed', 'scheduled')).toBe(false);
  });

  test('confirmed cannot jump directly to completed (must check-in first) — P1-24', () => {
    expect(isValidTransition('confirmed', 'completed')).toBe(false);
  });

  test('no_show is reversible to completed (patient turns up late)', () => {
    expect(isValidTransition('no_show', 'completed')).toBe(true);
  });

  test('checked_in can reach completed, cancelled, or no_show', () => {
    expect(APPOINTMENT_TRANSITIONS['checked_in']).toContain('completed');
    expect(APPOINTMENT_TRANSITIONS['checked_in']).toContain('cancelled');
    expect(APPOINTMENT_TRANSITIONS['checked_in']).toContain('no_show');
  });

  test('scheduled cannot jump directly to completed', () => {
    expect(isValidTransition('scheduled', 'completed')).toBe(false);
  });

  test('all states covered in transition map', () => {
    for (const state of STATES) {
      expect(Object.keys(APPOINTMENT_TRANSITIONS)).toContain(state);
    }
  });
});
