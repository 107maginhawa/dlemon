/**
 * Test #4 — raw BOP% → bucket label, with boundary cases.
 * Healthy <10 / Localized 10–30 / Generalized >30 (perio-review §2).
 */

import { describe, test, expect } from 'bun:test';
import { bopBucket, BOP_BUCKET_LABEL } from './perio-types';

describe('bopBucket', () => {
  test('9.9 → healthy', () => {
    expect(bopBucket(9.9)).toBe('healthy');
  });

  test('exactly 10 → localized (lower boundary inclusive)', () => {
    expect(bopBucket(10)).toBe('localized');
  });

  test('30 → localized (upper boundary inclusive)', () => {
    expect(bopBucket(30)).toBe('localized');
  });

  test('30.1 → generalized', () => {
    expect(bopBucket(30.1)).toBe('generalized');
  });

  test('0 → healthy, 100 → generalized', () => {
    expect(bopBucket(0)).toBe('healthy');
    expect(bopBucket(100)).toBe('generalized');
  });

  test('labels are human-readable', () => {
    expect(BOP_BUCKET_LABEL[bopBucket(5)]).toBe('Healthy');
    expect(BOP_BUCKET_LABEL[bopBucket(20)]).toBe('Localized');
    expect(BOP_BUCKET_LABEL[bopBucket(50)]).toBe('Generalized');
  });
});
