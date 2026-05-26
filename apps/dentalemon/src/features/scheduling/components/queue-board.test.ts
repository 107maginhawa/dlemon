/**
 * QueueBoard — pure logic tests (G6-S9)
 *
 * Tests exported pure helpers: timeWaiting, FSM transition config (PRIMARY_ACTION),
 * column config (COLUMNS).
 */

import { describe, test, expect } from 'bun:test';
import { timeWaiting } from './queue-board';

// ---------------------------------------------------------------------------
// timeWaiting
// ---------------------------------------------------------------------------

describe('timeWaiting', () => {
  function msAgo(ms: number): string {
    return new Date(Date.now() - ms).toISOString();
  }

  test('returns "Just now" for timestamps less than 1 minute ago', () => {
    expect(timeWaiting(msAgo(30_000))).toBe('Just now');
    expect(timeWaiting(msAgo(59_000))).toBe('Just now');
  });

  test('returns Xm for timestamps 1-59 minutes ago', () => {
    expect(timeWaiting(msAgo(60_000))).toBe('1m');
    expect(timeWaiting(msAgo(5 * 60_000))).toBe('5m');
    expect(timeWaiting(msAgo(59 * 60_000))).toBe('59m');
  });

  test('returns Xh Ym for timestamps 1+ hours ago', () => {
    expect(timeWaiting(msAgo(60 * 60_000))).toBe('1h 0m');
    expect(timeWaiting(msAgo(90 * 60_000))).toBe('1h 30m');
    expect(timeWaiting(msAgo(125 * 60_000))).toBe('2h 5m');
  });

  test('returns "Just now" for future timestamps (clock skew tolerance)', () => {
    const future = new Date(Date.now() + 5_000).toISOString();
    expect(timeWaiting(future)).toBe('Just now');
  });
});

// ---------------------------------------------------------------------------
// FSM transition table
// ---------------------------------------------------------------------------

import { PRIMARY_ACTION, COLUMNS } from './queue-board';

describe('COLUMNS', () => {
  test('has 4 columns in correct FSM order', () => {
    const statuses = COLUMNS.map((c) => c.status);
    expect(statuses).toEqual(['waiting', 'called', 'in_progress', 'completed']);
  });

  test('each column has a non-empty label', () => {
    for (const col of COLUMNS) {
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

describe('PRIMARY_ACTION', () => {
  test('waiting → called (Call)', () => {
    const action = PRIMARY_ACTION['waiting'];
    expect(action).not.toBeUndefined();
    expect(action!.next).toBe('called');
    expect(action!.label).toBe('Call');
  });

  test('called → in_progress (Start)', () => {
    const action = PRIMARY_ACTION['called'];
    expect(action).not.toBeUndefined();
    expect(action!.next).toBe('in_progress');
    expect(action!.label).toBe('Start');
  });

  test('in_progress → completed (Done)', () => {
    const action = PRIMARY_ACTION['in_progress'];
    expect(action).not.toBeUndefined();
    expect(action!.next).toBe('completed');
    expect(action!.label).toBe('Done');
  });

  test('completed has no primary action (terminal state)', () => {
    expect(PRIMARY_ACTION['completed']).toBeUndefined();
  });

  test('cancelled has no primary action (terminal state)', () => {
    expect(PRIMARY_ACTION['cancelled']).toBeUndefined();
  });
});
