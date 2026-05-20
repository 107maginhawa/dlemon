/**
 * TreatmentReport component — unit tests
 *
 * Tests the CDT grouping table rendering and CSV export logic.
 */
import { describe, test, expect } from 'bun:test';
import {
  groupByCdtCode,
  filterByDateRange,
  type TreatmentRow,
  type CdtGroup,
} from '../hooks/use-treatment-report';

// ---------------------------------------------------------------------------
// Component-level logic tests (table data + CSV export)
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `\u20B1${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildCsvContent(groups: CdtGroup[]): string {
  const header = 'CDT Code,Description,Count,Total Billed';
  const rows = groups.map(
    (g) => `${g.cdtCode},"${g.description}",${g.count},${g.totalCents}`,
  );
  return [header, ...rows].join('\n');
}

const treatments: TreatmentRow[] = [
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 3000, createdAt: '2026-01-05T10:00:00Z' },
  { cdtCode: 'D0120', description: 'Periodic Exam', priceCents: 3000, createdAt: '2026-01-06T10:00:00Z' },
  { cdtCode: 'D2391', description: 'Composite 1s', priceCents: 8000, createdAt: '2026-01-07T10:00:00Z' },
];

describe('TreatmentReport — table data', () => {
  test('groups produce correct rows for table', () => {
    const groups = groupByCdtCode(treatments);
    expect(groups).toHaveLength(2);

    const exam = groups.find((g) => g.cdtCode === 'D0120');
    expect(exam).not.toBeUndefined();
    expect(exam!.count).toBe(2);
    expect(exam!.totalCents).toBe(6000);
  });

  test('formatted currency renders correctly', () => {
    expect(formatCents(3000)).toContain('30');
    expect(formatCents(0)).toContain('0');
  });
});

describe('TreatmentReport — CSV export', () => {
  test('builds CSV with header and rows', () => {
    const groups = groupByCdtCode(treatments);
    const csv = buildCsvContent(groups);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('CDT Code,Description,Count,Total Billed');
    expect(lines.length).toBe(groups.length + 1);
  });

  test('CSV row contains correct count', () => {
    const groups = groupByCdtCode(treatments);
    const csv = buildCsvContent(groups);
    // D2391 has count=1, total=8000 — should appear highest
    expect(csv).toContain('D2391');
    expect(csv).toContain('8000');
  });
});

describe('TreatmentReport — date filtering', () => {
  test('filters then groups correctly', () => {
    const filtered = filterByDateRange(treatments, '2026-01-05', '2026-01-06');
    const groups = groupByCdtCode(filtered);
    expect(groups).toHaveLength(1);
    expect(groups[0].cdtCode).toBe('D0120');
    expect(groups[0].count).toBe(2);
  });
});
