/**
 * ratchet.test.ts — TDD for the universal coverage gate.
 *
 * Run from repo root:  bun test ./scripts/coverage/lib/ratchet.test.ts
 * (the leading ./ is required for Bun path filters). Root-level tests: they do
 * NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ratchet,
  loadAllowlist,
  formatRatchetReport,
  type Gap,
  type AllowlistEntry,
} from './ratchet';

// ─────────────────────────────────────────────────────────────────────────────
// (a) ratchet()
// ─────────────────────────────────────────────────────────────────────────────

describe('ratchet', () => {
  test('a fully-allowlisted set of gaps passes (ok, no new gaps)', () => {
    const current: Gap[] = [{ id: 'A' }, { id: 'B' }];
    const allow: AllowlistEntry[] = [
      { id: 'A', reason: 'tracked' },
      { id: 'B', reason: 'tracked' },
    ];
    const r = ratchet(current, allow);
    expect(r.ok).toBe(true);
    expect(r.newGaps).toEqual([]);
    expect(r.resolved).toEqual([]);
  });

  test('a gap not on the allowlist is a new gap and fails the gate', () => {
    const current: Gap[] = [{ id: 'A' }, { id: 'C', kind: 'missing-403' }];
    const allow: AllowlistEntry[] = [{ id: 'A', reason: 'tracked' }];
    const r = ratchet(current, allow);
    expect(r.ok).toBe(false);
    expect(r.newGaps).toEqual([{ id: 'C', kind: 'missing-403' }]);
  });

  test('an allowlist id no longer present is reported as resolved (allowlist can shrink)', () => {
    const current: Gap[] = [{ id: 'A' }];
    const allow: AllowlistEntry[] = [
      { id: 'A', reason: 'tracked' },
      { id: 'B', reason: 'fixed last week' },
    ];
    const r = ratchet(current, allow);
    expect(r.ok).toBe(true);
    expect(r.resolved).toEqual(['B']);
  });

  test('reports new gaps AND resolved entries together', () => {
    const current: Gap[] = [{ id: 'A' }, { id: 'NEW' }];
    const allow: AllowlistEntry[] = [
      { id: 'A', reason: 'tracked' },
      { id: 'GONE', reason: 'was a gap' },
    ];
    const r = ratchet(current, allow);
    expect(r.ok).toBe(false);
    expect(r.newGaps.map((g) => g.id)).toEqual(['NEW']);
    expect(r.resolved).toEqual(['GONE']);
  });

  test('an empty allowlist means every current gap is a new gap', () => {
    const current: Gap[] = [{ id: 'A' }, { id: 'B' }];
    const r = ratchet(current, []);
    expect(r.ok).toBe(false);
    expect(r.newGaps.map((g) => g.id)).toEqual(['A', 'B']);
  });

  test('no current gaps → ok and the whole allowlist is resolved', () => {
    const allow: AllowlistEntry[] = [
      { id: 'A', reason: 'r' },
      { id: 'B', reason: 'r' },
    ];
    const r = ratchet([], allow);
    expect(r.ok).toBe(true);
    expect(r.newGaps).toEqual([]);
    expect(r.resolved.sort()).toEqual(['A', 'B']);
  });

  test('duplicate current gap ids are preserved in newGaps (a real generator smell)', () => {
    const current: Gap[] = [{ id: 'DUP' }, { id: 'DUP' }];
    const r = ratchet(current, []);
    expect(r.newGaps).toHaveLength(2);
  });

  test('a duplicated allowlist id resolves to a single entry', () => {
    const allow: AllowlistEntry[] = [
      { id: 'X', reason: 'a' },
      { id: 'X', reason: 'b' },
    ];
    const r = ratchet([], allow);
    expect(r.resolved).toEqual(['X']);
  });

  test('preserves the extra fields of a new gap (so the report can explain it)', () => {
    const current: Gap[] = [{ id: 'op1', operationId: 'createX', missing: '403' }];
    const r = ratchet(current, []);
    expect(r.newGaps[0]).toEqual({ id: 'op1', operationId: 'createX', missing: '403' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) loadAllowlist()
// ─────────────────────────────────────────────────────────────────────────────

describe('loadAllowlist', () => {
  let dir: string | null = null;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  function writeFixture(name: string, contents: string): string {
    dir = mkdtempSync(join(tmpdir(), 'ratchet-'));
    const p = join(dir, name);
    writeFileSync(p, contents, 'utf8');
    return p;
  }

  test('a missing file is tolerated → []', () => {
    expect(loadAllowlist(join(tmpdir(), 'does-not-exist-xyz.json'))).toEqual([]);
  });

  test('loads a valid allowlist of { id, reason }', () => {
    const p = writeFixture(
      'allow.json',
      JSON.stringify([
        { id: 'A', reason: 'legacy backlog' },
        { id: 'B', reason: 'tracked in #123' },
      ]),
    );
    expect(loadAllowlist(p)).toEqual([
      { id: 'A', reason: 'legacy backlog' },
      { id: 'B', reason: 'tracked in #123' },
    ]);
  });

  test('an empty array is valid → []', () => {
    const p = writeFixture('empty.json', '[]');
    expect(loadAllowlist(p)).toEqual([]);
  });

  test('throws on invalid JSON', () => {
    const p = writeFixture('bad.json', '{ not json');
    expect(() => loadAllowlist(p)).toThrow(/not valid JSON/);
  });

  test('throws when the root is not an array', () => {
    const p = writeFixture('obj.json', JSON.stringify({ id: 'A', reason: 'r' }));
    expect(() => loadAllowlist(p)).toThrow(/must be a JSON array/);
  });

  test('throws when an entry is missing its id', () => {
    const p = writeFixture('noid.json', JSON.stringify([{ reason: 'r' }]));
    expect(() => loadAllowlist(p)).toThrow(/missing\/empty "id"/);
  });

  test('throws when an entry has an empty/whitespace reason', () => {
    const p = writeFixture('noreason.json', JSON.stringify([{ id: 'A', reason: '   ' }]));
    expect(() => loadAllowlist(p)).toThrow(/missing\/empty "reason"/);
  });

  test('throws when an entry is not an object', () => {
    const p = writeFixture('notobj.json', JSON.stringify(['just-a-string']));
    expect(() => loadAllowlist(p)).toThrow(/not an object/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) formatRatchetReport()
// ─────────────────────────────────────────────────────────────────────────────

describe('formatRatchetReport', () => {
  test('a clean result reads as a pass with the label', () => {
    const out = formatRatchetReport(ratchet([], []), { label: 'journey-lock' });
    expect(out).toContain('✓ journey-lock');
    expect(out).toContain('no new gaps');
  });

  test('lists every new gap with its explaining fields', () => {
    const current: Gap[] = [{ id: 'createX', missing: '403', module: 'billing' }];
    const out = formatRatchetReport(ratchet(current, []), { label: 'neg-path' });
    expect(out).toContain('✗ neg-path');
    expect(out).toContain('createX');
    expect(out).toContain('missing=403');
    expect(out).toContain('module=billing');
  });

  test('reports resolved allowlist entries as a tighten-me hint', () => {
    const out = formatRatchetReport(ratchet([], [{ id: 'OLD', reason: 'r' }]));
    expect(out).toContain('OLD');
    expect(out).toContain('no longer needed');
  });

  test('defaults the label to "ratchet" when none is given', () => {
    expect(formatRatchetReport(ratchet([], []))).toContain('ratchet');
  });

  test('singular vs plural resolved wording', () => {
    const one = formatRatchetReport(ratchet([], [{ id: 'A', reason: 'r' }]));
    expect(one).toContain('entry is');
    const two = formatRatchetReport(
      ratchet([], [
        { id: 'A', reason: 'r' },
        { id: 'B', reason: 'r' },
      ]),
    );
    expect(two).toContain('entries are');
  });
});
