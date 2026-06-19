/**
 * br-matrix.test.ts — TDD for the business-rule coverage matrix.
 *
 * Run from repo root:  bun test ./scripts/coverage/br-matrix.test.ts
 * (the leading ./ is required for Bun path filters). Root-level tests: they do
 * NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 *
 * Strategy: unit-test the PURE classification logic (severity derivation from
 * `type`, guard-typed predicate, coverage-state resolution, allowlist seeding,
 * gate verdict) against in-memory fixtures, then assert structural INVARIANTS
 * against the real registry-driven build (every row has a known severity; P0
 * gate semantics; allowlist excludes deferred-status BRs). Pure-fn tests are
 * exact; the end-to-end build asserts invariants that survive registry growth.
 */

import { describe, expect, test } from 'bun:test';
import {
  deriveSeverity,
  isGuardTyped,
  resolveCoverageState,
  isGatingExcluded,
  computeGateVerdict,
  buildBrMatrix,
  seedAllowlist,
  scanCodesForId,
  type BrRow,
} from './br-matrix';

// ─────────────────────────────────────────────────────────────────────────────
// (0) scan-code extraction — the registry id is `<CODE>[ / <ALIAS>…] [(prose)]`,
//     and a token scan must use the CODE(s), never the full prose id.
// ─────────────────────────────────────────────────────────────────────────────

describe('scanCodesForId', () => {
  test('a bare code is its own single scan token', () => {
    expect(scanCodesForId('BR-001')).toEqual(['BR-001']);
  });

  test('drops a parenthetical prose label', () => {
    expect(scanCodesForId('V-PORTAL-001 (IDOR-free self-scope — headline invariant)')).toEqual([
      'V-PORTAL-001',
    ]);
  });

  test('splits slash-joined aliases into multiple scan tokens', () => {
    expect(scanCodesForId('AC-AUD-004 / V-AUD-001 / V-AUD-NEW-A')).toEqual([
      'AC-AUD-004',
      'V-AUD-001',
      'V-AUD-NEW-A',
    ]);
  });

  test('handles slash-aliases AND a parenthetical together', () => {
    expect(scanCodesForId('EM-DG-RBAC (erasure/legal-hold admin-only; non-admin → 403)')).toEqual([
      'EM-DG-RBAC',
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (a) severity derivation from `type`
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveSeverity', () => {
  test('P0 covers the authz / tenancy / security / privacy / compliance family', () => {
    for (const t of [
      'authorization',
      'access-control',
      'multi-tenancy',
      'security',
      'privacy',
      'compliance',
    ]) {
      expect(deriveSeverity(t), `${t} → P0`).toBe('P0');
    }
  });

  test('P1 covers the guard / state-machine / integrity / concurrency family', () => {
    for (const t of [
      'state-guard',
      'state-machine',
      'conflict-prevention',
      'data-integrity',
      'referential-integrity',
      'concurrency',
    ]) {
      expect(deriveSeverity(t), `${t} → P1`).toBe('P1');
    }
  });

  test('unknown / lower-stakes types fall through to P2', () => {
    for (const t of [
      'validation',
      'business-rule',
      'business-logic',
      'response-contract',
      'ux-guard',
      'schema-constraint',
      'calculation-stub',
      'documentation',
      'offline-ux',
      'a-type-that-does-not-exist',
    ]) {
      expect(deriveSeverity(t), `${t} → P2`).toBe('P2');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) guard-typed predicate (which BRs require a negative path)
// ─────────────────────────────────────────────────────────────────────────────

describe('isGuardTyped', () => {
  test('authz / access-control / state guards / tenancy require a negative path', () => {
    for (const t of [
      'authorization',
      'access-control',
      'multi-tenancy',
      'security',
      'state-guard',
      'state-machine',
      'conflict-prevention',
    ]) {
      expect(isGuardTyped(t), `${t} is guard-typed`).toBe(true);
    }
  });

  test('pure contract / ux / schema types are NOT guard-typed (positive ref suffices)', () => {
    for (const t of ['response-contract', 'ux-guard', 'schema-constraint', 'offline-ux']) {
      expect(isGuardTyped(t), `${t} is not guard-typed`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) coverage-state resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveCoverageState', () => {
  test('an unreferenced BR is UNTESTED regardless of type', () => {
    expect(resolveCoverageState({ corporaHit: [], guardTyped: true, hasNegativePath: false })).toBe(
      'UNTESTED',
    );
    expect(resolveCoverageState({ corporaHit: [], guardTyped: false, hasNegativePath: false })).toBe(
      'UNTESTED',
    );
  });

  test('a referenced non-guard BR is FULLY_COVERED on a positive reference alone', () => {
    expect(
      resolveCoverageState({ corporaHit: ['api-unit'], guardTyped: false, hasNegativePath: false }),
    ).toBe('FULLY_COVERED');
  });

  test('a referenced guard BR with a negative path is FULLY_COVERED', () => {
    expect(
      resolveCoverageState({ corporaHit: ['api-unit'], guardTyped: true, hasNegativePath: true }),
    ).toBe('FULLY_COVERED');
  });

  test('a referenced guard BR with NO negative path is POSITIVE_ONLY', () => {
    expect(
      resolveCoverageState({ corporaHit: ['api-unit'], guardTyped: true, hasNegativePath: false }),
    ).toBe('POSITIVE_ONLY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) gating exclusion (registry status → allowlisted-by-status)
// ─────────────────────────────────────────────────────────────────────────────

describe('isGatingExcluded', () => {
  test('deferred / not-implemented / unauditable statuses are excluded from gating', () => {
    for (const s of ['deferred', 'not-implemented', 'unauditable']) {
      expect(isGatingExcluded(s), `${s} excluded`).toBe(true);
    }
  });

  test('implemented / implemented-flag-gated / partial are NOT excluded', () => {
    for (const s of ['implemented', 'implemented-flag-gated', 'partial']) {
      expect(isGatingExcluded(s), `${s} not excluded`).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) gate verdict — the intended hard-fail / ratchet semantics
// ─────────────────────────────────────────────────────────────────────────────

describe('computeGateVerdict', () => {
  const row = (over: Partial<BrRow>): BrRow => ({
    key: 'mod::BR-X',
    brId: 'BR-X',
    module: 'mod',
    type: 'authorization',
    derivedSeverity: 'P0',
    status: 'implemented',
    guardTyped: true,
    corporaHit: ['api-unit'],
    hasNegativePath: true,
    coverageState: 'FULLY_COVERED',
    ...over,
  });

  test('a fully-covered P0 passes', () => {
    const v = computeGateVerdict([row({})], []);
    expect(v.ok).toBe(true);
    expect(v.p0Failures).toEqual([]);
  });

  test('an UNTESTED P0 is a hard failure (never allowlistable)', () => {
    const v = computeGateVerdict(
      [row({ corporaHit: [], hasNegativePath: false, coverageState: 'UNTESTED' })],
      [{ id: 'mod::BR-X', reason: 'try to suppress a P0' }],
    );
    expect(v.ok).toBe(false);
    expect(v.p0Failures.map((g) => g.id)).toContain('mod::BR-X');
  });

  test('a POSITIVE_ONLY P0 guard (no negative path) is a hard failure', () => {
    const v = computeGateVerdict(
      [row({ hasNegativePath: false, coverageState: 'POSITIVE_ONLY' })],
      [],
    );
    expect(v.ok).toBe(false);
    expect(v.p0Failures.map((g) => g.id)).toContain('mod::BR-X');
  });

  test('an excluded-status P0 (deferred) does not gate even when uncovered', () => {
    const v = computeGateVerdict(
      [
        row({
          status: 'deferred',
          corporaHit: [],
          hasNegativePath: false,
          coverageState: 'UNTESTED',
        }),
      ],
      [],
    );
    expect(v.p0Failures).toEqual([]);
  });

  test('a by-status allowlist entry is NOT falsely reported as resolved', () => {
    // An excluded-status (deferred) BR is in the allowlist by status. It never
    // enters the ratchet's `current` set, so a naive ratchet would call it
    // "resolved" (tighten me) — which is wrong, it is intentionally excluded.
    const deferredRow = row({
      key: 'mod::DEFER',
      type: 'documentation',
      derivedSeverity: 'P2',
      status: 'deferred',
      corporaHit: [],
      hasNegativePath: false,
      coverageState: 'UNTESTED',
    });
    const v = computeGateVerdict([deferredRow], [{ id: 'mod::DEFER', reason: 'deferred' }]);
    expect(v.resolved).not.toContain('mod::DEFER');
  });

  test('an uncovered P1 ratchets (allowlisted → not a new gap; unlisted → new gap)', () => {
    const p1Untested = row({
      key: 'mod::BR-P1',
      type: 'data-integrity',
      derivedSeverity: 'P1',
      corporaHit: [],
      hasNegativePath: false,
      coverageState: 'UNTESTED',
    });
    const allowed = computeGateVerdict([p1Untested], [{ id: 'mod::BR-P1', reason: 'baseline' }]);
    expect(allowed.newGaps.map((g) => g.id)).not.toContain('mod::BR-P1');

    const unlisted = computeGateVerdict([p1Untested], []);
    expect(unlisted.newGaps.map((g) => g.id)).toContain('mod::BR-P1');
    expect(unlisted.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) allowlist seeding — non-P0 uncovered BRs become the ratchet baseline
// ─────────────────────────────────────────────────────────────────────────────

describe('seedAllowlist', () => {
  const rows: BrRow[] = [
    {
      key: 'mod::P0bad',
      brId: 'P0bad',
      module: 'mod',
      type: 'security',
      derivedSeverity: 'P0',
      status: 'implemented',
      guardTyped: true,
      corporaHit: [],
      hasNegativePath: false,
      coverageState: 'UNTESTED',
    },
    {
      key: 'mod::P1bad',
      brId: 'P1bad',
      module: 'mod',
      type: 'data-integrity',
      derivedSeverity: 'P1',
      status: 'implemented',
      guardTyped: true,
      corporaHit: [],
      hasNegativePath: false,
      coverageState: 'UNTESTED',
    },
    {
      key: 'mod::P1pos',
      brId: 'P1pos',
      module: 'mod',
      type: 'state-machine',
      derivedSeverity: 'P1',
      status: 'implemented',
      guardTyped: true,
      corporaHit: ['api-unit'],
      hasNegativePath: false,
      coverageState: 'POSITIVE_ONLY',
    },
    {
      key: 'mod::ok',
      brId: 'ok',
      module: 'mod',
      type: 'data-integrity',
      derivedSeverity: 'P1',
      status: 'implemented',
      guardTyped: true,
      corporaHit: ['api-unit'],
      hasNegativePath: true,
      coverageState: 'FULLY_COVERED',
    },
    {
      key: 'mod::deferred',
      brId: 'deferred',
      module: 'mod',
      type: 'documentation',
      derivedSeverity: 'P2',
      status: 'deferred',
      guardTyped: false,
      corporaHit: [],
      hasNegativePath: false,
      coverageState: 'UNTESTED',
    },
  ];

  test('seeds only the non-P0, non-excluded, not-fully-covered rows', () => {
    const seeded = seedAllowlist(rows);
    const ids = seeded.map((e) => e.id);
    expect(ids).toContain('mod::P1bad'); // P1 untested
    expect(ids).toContain('mod::P1pos'); // P1 positive-only
    expect(ids).not.toContain('mod::P0bad'); // P0 never allowlisted
    expect(ids).not.toContain('mod::ok'); // fully covered
    expect(ids).not.toContain('mod::deferred'); // excluded by status (goes to br.allowlist by-status)
  });

  test('every seeded entry carries a non-empty reason', () => {
    for (const e of seedAllowlist(rows)) {
      expect(e.reason.length, e.id).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) end-to-end build against the REAL registry (structural invariants)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildBrMatrix (real registry)', () => {
  const rows = buildBrMatrix();

  test('produces one row per registry rule (128 total)', () => {
    expect(rows.length).toBe(128);
  });

  test('every row has a unique module-qualified key', () => {
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('every row has a known severity and a resolved coverage state', () => {
    for (const r of rows) {
      expect(['P0', 'P1', 'P2', 'P3'], r.key).toContain(r.derivedSeverity);
      expect(['FULLY_COVERED', 'POSITIVE_ONLY', 'UNTESTED'], r.key).toContain(r.coverageState);
    }
  });

  test('a guard-typed FULLY_COVERED row always carries a negative path', () => {
    for (const r of rows) {
      if (r.guardTyped && r.coverageState === 'FULLY_COVERED') {
        expect(r.hasNegativePath, r.key).toBe(true);
      }
    }
  });

  test('the duplicate-id BRs (BR-014/BR-015) appear once per owning module', () => {
    const br014 = rows.filter((r) => r.brId === 'BR-014');
    const br015 = rows.filter((r) => r.brId === 'BR-015');
    expect(br014.length).toBe(2); // dental-billing + dental-clinical
    expect(br015.length).toBe(3); // dental-billing + dental-clinical + dental-patient
    // keys remain unique despite the shared brId
    expect(new Set([...br014, ...br015].map((r) => r.key)).size).toBe(5);
  });

  test('a BR tagged by its bare code in the suite is detected as referenced', () => {
    // BR-001 (no-two-active-visits) is tagged in dental-visit.test.ts — the
    // code-token scan must credit it (proves the parenthetical-strip + scan).
    const br001 = rows.find((r) => r.key === 'dental-visit::BR-001');
    expect(br001, 'BR-001 row present').toBeTruthy();
    expect(br001!.corporaHit.length, 'BR-001 referenced').toBeGreaterThan(0);
  });

  test('registry deferred/not-implemented/unauditable statuses are gating-excluded', () => {
    const excluded = rows.filter((r) => isGatingExcluded(r.status));
    // BR-020 not-implemented, BR-031 unauditable, V-XRI-003 deferred
    expect(excluded.length).toBeGreaterThanOrEqual(3);
    for (const r of excluded) {
      expect(['deferred', 'not-implemented', 'unauditable'], r.key).toContain(r.status);
    }
  });
});
