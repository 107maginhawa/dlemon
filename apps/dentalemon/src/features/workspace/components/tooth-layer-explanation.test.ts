/**
 * tooth-layer-explanation — P0-D "why does this tooth show this color?".
 *
 * The explanation derives its layer from the SAME resolveToothLayer the
 * odontogram uses, so the words can never disagree with the rendered color.
 * Written RED before implementation.
 */
import { describe, test, expect } from 'bun:test';
import { explainToothLayer } from './tooth-layer-explanation';

describe('explainToothLayer', () => {
  test('completed (performed/verified treatment) wins and is explained', () => {
    const e = explainToothLayer(16, undefined, { completed: new Set([16]), proposed: new Set([16]) });
    expect(e.layer).toBe('completed');
    expect(e.reason.toLowerCase()).toContain('performed');
  });

  test('proposed is explained', () => {
    const e = explainToothLayer(26, undefined, { proposed: new Set([26]) });
    expect(e.layer).toBe('proposed');
    expect(e.reason.toLowerCase()).toContain('planned');
  });

  test('declined is explained', () => {
    const e = explainToothLayer(46, undefined, { declined: new Set([46]) });
    expect(e.layer).toBe('declined');
    expect(e.reason.toLowerCase()).toContain('declined');
  });

  test('baseline from existing dentition is explained as existing', () => {
    const e = explainToothLayer(11, 'existing', {});
    expect(e.layer).toBe('baseline');
    expect(e.reason.toLowerCase()).toContain('existing');
  });

  test('an untouched tooth is baseline with no active work', () => {
    const e = explainToothLayer(21, undefined, {});
    expect(e.layer).toBe('baseline');
    expect(e.reason.toLowerCase()).toContain('no active');
  });

  test('the derived layer always matches resolveToothLayer (coherence with the chart)', async () => {
    const { resolveToothLayer } = await import('./dental-chart.helpers');
    const sets = { completed: new Set([16]), proposed: new Set([26]), declined: new Set([46]) };
    for (const n of [16, 26, 46, 11, 21]) {
      const cls = n === 11 ? ('existing' as const) : undefined;
      expect(explainToothLayer(n, cls, sets).layer).toBe(resolveToothLayer(n, cls, sets));
    }
  });
});
