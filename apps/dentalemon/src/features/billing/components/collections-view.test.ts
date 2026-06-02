/**
 * collections-view helper tests (pure, no DOM/network).
 *
 * Imports directly from the real helpers module to prevent test-impl drift.
 */

import { describe, test, expect } from 'bun:test';
import {
  formatCents,
  agingRisk,
  agingRiskClass,
  bucketPct,
  summarizeBatch,
  AGING_BUCKETS,
} from './collections-view.helpers';

describe('formatCents', () => {
  test('renders ₱ with two decimals', () => {
    expect(formatCents(123456)).toBe('₱1234.56');
    expect(formatCents(0)).toBe('₱0.00');
  });
});

describe('agingRisk', () => {
  test('tiers by oldest invoice age', () => {
    expect(agingRisk(0)).toBe('ok');
    expect(agingRisk(30)).toBe('ok');
    expect(agingRisk(31)).toBe('watch');
    expect(agingRisk(60)).toBe('watch');
    expect(agingRisk(61)).toBe('warn');
    expect(agingRisk(90)).toBe('warn');
    expect(agingRisk(91)).toBe('severe');
    expect(agingRisk(365)).toBe('severe');
  });
});

describe('agingRiskClass', () => {
  test('maps each tier to a distinct class', () => {
    const classes = new Set([
      agingRiskClass('ok'),
      agingRiskClass('watch'),
      agingRiskClass('warn'),
      agingRiskClass('severe'),
    ]);
    expect(classes.size).toBe(4);
    expect(agingRiskClass('severe')).toContain('red');
  });
});

describe('bucketPct', () => {
  test('rounds bucket share of total', () => {
    expect(bucketPct(2500, 10000)).toBe(25);
    expect(bucketPct(3333, 10000)).toBe(33);
  });
  test('guards against zero total', () => {
    expect(bucketPct(0, 0)).toBe(0);
  });
});

describe('summarizeBatch', () => {
  test('pluralizes and includes total', () => {
    expect(summarizeBatch(1, 5000)).toBe('Generated 1 statement · ₱50.00 outstanding');
    expect(summarizeBatch(3, 700000)).toBe('Generated 3 statements · ₱7000.00 outstanding');
  });
});

describe('AGING_BUCKETS', () => {
  test('covers the four canonical buckets in order', () => {
    expect(AGING_BUCKETS.map((b) => b.key)).toEqual([
      'currentCents',
      'days30Cents',
      'days60Cents',
      'days90PlusCents',
    ]);
  });
});
