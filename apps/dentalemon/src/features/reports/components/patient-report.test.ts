/**
 * PatientReport component — unit tests
 *
 * Tests stats card computation and rendering data.
 */
import { describe, test, expect } from 'bun:test';
import {
  computePatientStats,
  type PatientReportRow,
} from '../hooks/use-patient-report';

// ---------------------------------------------------------------------------
// Stats card data tests
// ---------------------------------------------------------------------------

const patients: PatientReportRow[] = [
  { id: 'p1', displayName: 'Alice', status: 'active', createdAt: '2026-01-02T10:00:00Z' },
  { id: 'p2', displayName: 'Bob', status: 'active', createdAt: '2026-01-10T10:00:00Z' },
  { id: 'p3', displayName: 'Carol', status: 'archived', createdAt: '2025-06-01T10:00:00Z' },
  { id: 'p4', displayName: 'Dave', status: 'active', createdAt: '2026-02-01T10:00:00Z' },
];

describe('PatientReport — stats cards', () => {
  test('active count is correct', () => {
    const stats = computePatientStats(patients, '', '');
    expect(stats.totalActive).toBe(3);
  });

  test('archived count is correct', () => {
    const stats = computePatientStats(patients, '', '');
    expect(stats.totalArchived).toBe(1);
  });

  test('new registrations with date range', () => {
    const stats = computePatientStats(patients, '2026-01-01', '2026-01-31');
    expect(stats.newRegistrations).toBe(2); // Alice + Bob (not Dave in Feb)
  });

  test('handles single-day range', () => {
    const stats = computePatientStats(patients, '2026-01-02', '2026-01-02');
    expect(stats.newRegistrations).toBe(1); // Alice only
  });

  test('total patients displayed', () => {
    const stats = computePatientStats(patients, '', '');
    expect(stats.totalActive + stats.totalArchived).toBe(patients.length);
  });
});

describe('PatientReport — edge cases', () => {
  test('no patients returns all zeros', () => {
    const stats = computePatientStats([], '2026-01-01', '2026-12-31');
    expect(stats.totalActive).toBe(0);
    expect(stats.totalArchived).toBe(0);
    expect(stats.newRegistrations).toBe(0);
  });

  test('all archived', () => {
    const archived: PatientReportRow[] = [
      { id: 'p1', displayName: 'X', status: 'archived', createdAt: '2025-01-01T00:00:00Z' },
    ];
    const stats = computePatientStats(archived, '', '');
    expect(stats.totalActive).toBe(0);
    expect(stats.totalArchived).toBe(1);
  });
});
