/**
 * Regression: ISSUE-021 — report CSV exports emitted raw centavos.
 * Found by /qa on 2026-06-20.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-06-20.md
 *
 * Revenue + Treatment CSV exports serialized money columns as the raw centavos
 * integer (₱279,420.00 → "27942000"), so opening the file in a spreadsheet read
 * every Billed/Collected/Outstanding/Total figure 100× too large. csvAmount now
 * emits decimal pesos with no symbol/commas so the cell parses as a number.
 *
 * Reproduced live: Revenue Export CSV row was
 *   2026-06-19,27942000,7217000,20725000   (raw centavos)
 * where the UI showed ₱279,420.00 / ₱72,170.00 / ₱207,250.00.
 */
import { describe, test, expect } from 'bun:test';
import { csvAmount } from './csv';

describe('csvAmount — report CSV money serialization', () => {
  test('the reproduced value: 27942000 centavos → "279420.00" (not raw cents)', () => {
    expect(csvAmount(27942000)).toBe('279420.00');
    expect(csvAmount(27942000)).not.toBe('27942000');
  });

  test('always two decimal places', () => {
    expect(csvAmount(100)).toBe('1.00');
    expect(csvAmount(150)).toBe('1.50');
    expect(csvAmount(0)).toBe('0.00');
  });

  test('odd centavos keep the exact decimal', () => {
    expect(csvAmount(99)).toBe('0.99');
    expect(csvAmount(7217001)).toBe('72170.01');
  });

  test('no currency symbol and no thousands commas (spreadsheet-safe)', () => {
    const out = csvAmount(123456789);
    expect(out).not.toMatch(/[₱,]/);
    expect(out).toBe('1234567.89');
  });
});
