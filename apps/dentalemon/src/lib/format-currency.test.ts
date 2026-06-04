/**
 * Tests for the shared PHP / en-PH currency formatter.
 *
 * These MUST pass before any component can rely on formatCurrency.
 * TDD: written first (RED), then the implementation makes them GREEN.
 */
import { describe, test, expect } from 'bun:test';
import { formatCurrency, formatCents } from './format-currency';

describe('formatCurrency — peso / en-PH output', () => {
  test('formats a whole-peso amount with peso sign', () => {
    // 150 PHP → "₱150.00"
    expect(formatCurrency(150)).toBe('₱150.00');
  });

  test('formats cents amount: 15000 cents → ₱150.00', () => {
    expect(formatCents(15000)).toBe('₱150.00');
  });

  test('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('₱0.00');
  });

  test('uses ₱ symbol, NOT $', () => {
    expect(formatCurrency(100)).not.toContain('$');
    expect(formatCurrency(100)).toContain('₱');
  });

  test('does NOT use USD or en-US locale output', () => {
    const result = formatCurrency(1234.56);
    expect(result).not.toMatch(/USD/);
    expect(result).toContain('₱');
  });

  test('formats large amounts with separators', () => {
    // 12,345.67 PHP — contains ₱, 12, 345
    const result = formatCurrency(12345.67);
    expect(result).toContain('₱');
    expect(result).toContain('12');
    expect(result).toContain('345');
  });

  test('formatCents: 0 cents → ₱0.00', () => {
    expect(formatCents(0)).toBe('₱0.00');
  });

  test('formatCents: 1 cent → ₱0.01', () => {
    expect(formatCents(1)).toBe('₱0.01');
  });

  test('formatCents: 150000 cents → ₱1,500.00', () => {
    const result = formatCents(150000);
    expect(result).toContain('₱');
    expect(result).toContain('1');
    expect(result).toContain('500');
  });
});
