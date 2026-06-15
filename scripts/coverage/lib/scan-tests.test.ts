/**
 * scan-tests.test.ts — TDD for the reusable test-corpus scanner.
 *
 * Run from repo root:  bun test ./scripts/coverage/lib/scan-tests.test.ts
 * (the leading ./ is required for Bun path filters). Root-level tests: they do
 * NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 *
 * Strategy: assert behavioural INVARIANTS against the real corpora (every
 * reported match really contains the token at the reported line; journeys is a
 * subset of e2e; paths are repo-relative+sorted) rather than brittle exact
 * counts, plus a self-consistency token round-trip. The structural guarantees
 * hold no matter how the test tree grows.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './sources';
import {
  TEST_CORPORA,
  getCorpus,
  listFiles,
  scanForToken,
  scanForRegex,
  clearScanCache,
  type CorpusName,
  type ScanMatch,
} from './scan-tests';

const ALL_NAMES: CorpusName[] = ['api-unit', 'app-unit', 'e2e', 'journeys', 'hurl'];

// ─────────────────────────────────────────────────────────────────────────────
// (a) corpus definitions
// ─────────────────────────────────────────────────────────────────────────────

describe('TEST_CORPORA', () => {
  test('defines exactly the five named corpora', () => {
    expect(TEST_CORPORA.map((c) => c.name).sort()).toEqual([...ALL_NAMES].sort());
  });

  test('every corpus has a non-empty root, glob, and description', () => {
    for (const c of TEST_CORPORA) {
      expect(c.root.length, `${c.name} root`).toBeGreaterThan(0);
      expect(c.glob.length, `${c.name} glob`).toBeGreaterThan(0);
      expect(c.description.length, `${c.name} description`).toBeGreaterThan(0);
    }
  });

  test('getCorpus resolves by name and throws on an unknown id', () => {
    expect(getCorpus('hurl').glob).toBe('**/*.hurl');
    expect(() => getCorpus('nope' as CorpusName)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) listFiles
// ─────────────────────────────────────────────────────────────────────────────

describe('listFiles', () => {
  test('returns a sorted, repo-relative, POSIX file list rooted at the corpus root', () => {
    const files = listFiles('hurl');
    expect(files.length).toBeGreaterThan(0);
    // repo-relative under the corpus root, forward slashes only.
    for (const f of files) {
      expect(f.startsWith('specs/api/tests/contract/')).toBe(true);
      expect(f.endsWith('.hurl')).toBe(true);
      expect(f.includes('\\')).toBe(false);
    }
    // sorted
    expect([...files].sort()).toEqual(files);
    // and they actually exist on disk
    expect(() => readFileSync(join(ROOT, files[0]!), 'utf8')).not.toThrow();
  });

  test('journeys is a strict subset of e2e (journeys live under tests/e2e)', () => {
    const journeys = new Set(listFiles('journeys').filter((f) => f.endsWith('.spec.ts')));
    const e2e = new Set(listFiles('e2e'));
    // Every journey *.spec.ts file is also discovered by the broad e2e glob.
    for (const j of journeys) {
      expect(e2e.has(j), `${j} should also be an e2e match`).toBe(true);
    }
    expect(journeys.size).toBeGreaterThan(0);
  });

  test('caches the list (same array identity on repeat calls)', () => {
    clearScanCache();
    const a = listFiles('hurl');
    const b = listFiles('hurl');
    expect(a).toBe(b); // memoised — same reference
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) scanForToken
// ─────────────────────────────────────────────────────────────────────────────

describe('scanForToken', () => {
  test('an empty token yields no matches', () => {
    expect(scanForToken('')).toEqual([]);
  });

  test('every reported match really contains the token at the reported 1-based line', () => {
    const matches = scanForToken('BR-', ['api-unit']);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches.slice(0, 50)) {
      assertMatchIsReal(m, (line) => line.includes('BR-'));
    }
  });

  test('a token unlikely to exist anywhere yields no matches', () => {
    expect(scanForToken('Z_NONEXISTENT_TOKEN_QWERTY_42')).toEqual([]);
  });

  test('is case-sensitive', () => {
    const hits = scanForToken('br-001', ['api-unit']);
    // The canonical tag is upper-case BR-001; a lower-case scan must not match it.
    for (const h of hits) {
      expect(h.text.includes('br-001')).toBe(true);
      expect(h.text.includes('BR-001')).toBe(true); // would be false if any leaked
    }
  });

  test('restricting corpora limits the corpus field of every match', () => {
    const matches = scanForToken('test(', ['hurl']);
    // 'test(' is a JS/TS idiom that should never appear in .hurl files.
    expect(matches.every((m) => m.corpus === 'hurl')).toBe(true);
  });

  test('scanning all corpora tags matches with their originating corpus', () => {
    const matches = scanForToken('expect(');
    const corpora = new Set(matches.map((m) => m.corpus));
    // expect( appears in the TS unit corpora at minimum.
    expect(corpora.has('api-unit') || corpora.has('app-unit')).toBe(true);
    // Each tagged corpus is one of the five known names.
    for (const c of corpora) expect(ALL_NAMES).toContain(c);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) scanForRegex
// ─────────────────────────────────────────────────────────────────────────────

describe('scanForRegex', () => {
  test('finds negative-path status tokens and reports real lines', () => {
    const matches = scanForRegex(/\b(403|409|422)\b/, ['api-unit']);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches.slice(0, 50)) {
      assertMatchIsReal(m, (line) => /\b(403|409|422)\b/.test(line));
    }
  });

  test('a global-flagged regex does not skip lines (lastIndex is reset per line)', () => {
    const withG = scanForRegex(/expect/g, ['api-unit']);
    const withoutG = scanForRegex(/expect/, ['api-unit']);
    expect(withG.length).toBe(withoutG.length);
  });

  test('respects corpus restriction', () => {
    const matches = scanForRegex(/HTTP\/1\.1 \d{3}|HTTP \d{3}/, ['hurl']);
    expect(matches.every((m) => m.corpus === 'hurl')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Re-read the file off disk and confirm the reported line matches the predicate. */
function assertMatchIsReal(m: ScanMatch, predicate: (line: string) => boolean): void {
  const lines = readFileSync(join(ROOT, m.file), 'utf8').split('\n');
  const actual = lines[m.line - 1];
  expect(actual, `${m.file}:${m.line} should exist`).toBeDefined();
  expect(actual).toBe(m.text);
  expect(predicate(actual!), `${m.file}:${m.line} should satisfy the predicate`).toBe(true);
}
