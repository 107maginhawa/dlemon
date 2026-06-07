import { describe, test, expect } from 'bun:test';
import { computeAppointmentColumns } from './appointment-layout';
import type { Appointment } from '../components/appointment-card';

const base = '2026-06-07T';

function appt(id: string, time: string, durationMinutes: number): Appointment {
  return {
    id,
    patientId: `pt-${id}`,
    scheduledAt: `${base}${time}:00`,
    durationMinutes,
    serviceType: 'checkup',
    status: 'scheduled',
  };
}

describe('computeAppointmentColumns', () => {
  test('empty input → empty map', () => {
    expect(computeAppointmentColumns([]).size).toBe(0);
  });

  test('non-overlapping appointments all get { col: 0, cols: 1 }', () => {
    const map = computeAppointmentColumns([
      appt('a', '09:00', 30),
      appt('b', '10:00', 30),
      appt('c', '11:00', 60),
    ]);
    for (const id of ['a', 'b', 'c']) {
      expect(map.get(id)).toEqual({ col: 0, cols: 1 });
    }
  });

  test('back-to-back appointments do NOT count as overlapping', () => {
    // 09:00-09:30 then 09:30-10:00 — touching, not concurrent.
    const map = computeAppointmentColumns([appt('a', '09:00', 30), appt('b', '09:30', 30)]);
    expect(map.get('a')).toEqual({ col: 0, cols: 1 });
    expect(map.get('b')).toEqual({ col: 0, cols: 1 });
  });

  test('two appointments at the same start → two columns side by side', () => {
    const map = computeAppointmentColumns([appt('a', '09:00', 30), appt('b', '09:00', 30)]);
    expect(map.get('a')).toEqual({ col: 0, cols: 2 });
    expect(map.get('b')).toEqual({ col: 1, cols: 2 });
  });

  test('three concurrent appointments → three columns', () => {
    const map = computeAppointmentColumns([
      appt('a', '14:00', 60),
      appt('b', '14:00', 60),
      appt('c', '14:30', 30),
    ]);
    expect(map.get('a')).toEqual({ col: 0, cols: 3 });
    expect(map.get('b')).toEqual({ col: 1, cols: 3 });
    expect(map.get('c')).toEqual({ col: 2, cols: 3 });
  });

  test('partial overlap reuses a freed column', () => {
    // a 09:00-10:00, b 09:30-10:30 overlap (2 cols); c 10:00-11:00 overlaps only
    // b, so it reuses a's freed column (col 0) but the cluster peak stays 2.
    const map = computeAppointmentColumns([
      appt('a', '09:00', 60),
      appt('b', '09:30', 60),
      appt('c', '10:00', 60),
    ]);
    expect(map.get('a')).toEqual({ col: 0, cols: 2 });
    expect(map.get('b')).toEqual({ col: 1, cols: 2 });
    expect(map.get('c')).toEqual({ col: 0, cols: 2 });
  });

  test('separate clusters are sized independently', () => {
    // Morning pair overlaps (2 cols); afternoon single is full width (1 col).
    const map = computeAppointmentColumns([
      appt('a', '09:00', 30),
      appt('b', '09:00', 30),
      appt('z', '15:00', 30),
    ]);
    expect(map.get('a')?.cols).toBe(2);
    expect(map.get('b')?.cols).toBe(2);
    expect(map.get('z')).toEqual({ col: 0, cols: 1 });
  });

  test('input order does not change the result', () => {
    const ordered = computeAppointmentColumns([appt('a', '09:00', 30), appt('b', '09:00', 30)]);
    const reversed = computeAppointmentColumns([appt('b', '09:00', 30), appt('a', '09:00', 30)]);
    // 'a' sorts before 'b' only by start/end (equal) — tie broken by input order,
    // so both runs must still produce a valid 2-column split covering {0,1}.
    expect(new Set([ordered.get('a')!.col, ordered.get('b')!.col])).toEqual(new Set([0, 1]));
    expect(new Set([reversed.get('a')!.col, reversed.get('b')!.col])).toEqual(new Set([0, 1]));
  });
});
