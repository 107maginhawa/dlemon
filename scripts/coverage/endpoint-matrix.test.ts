/**
 * endpoint-matrix.test.ts — TDD for the per-operation ENDPOINT coverage matrix.
 *
 * Run from repo root:  bun test ./scripts/coverage/endpoint-matrix.test.ts
 * (the leading ./ is required for Bun path filters). These are root-level tests:
 * they do NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 */

import { describe, expect, test } from 'bun:test';
import {
  normalizeRequestPath,
  parseHurlRequestLine,
  buildPathResolver,
  resolveToOperationId,
  parseHurlContractOps,
  loadRecordedOps,
  classifyDisposition,
  gapsOf,
  seedAllowlist,
  type EndpointRow,
} from './endpoint-matrix';
import { ratchet } from './lib/ratchet';
import { cmpByCodepoint } from './lib/sources';

// ─────────────────────────────────────────────────────────────────────────────
// (a) path normalization — templated segments → positional placeholder
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeRequestPath', () => {
  test('normalizes OpenAPI {param} segments to a positional placeholder', () => {
    expect(normalizeRequestPath('/dental/visits/{id}')).toBe('/dental/visits/{}');
  });

  test('normalizes hurl {{var}} segments to the same placeholder', () => {
    expect(normalizeRequestPath('/dental/visits/{{visit_id}}')).toBe('/dental/visits/{}');
  });

  test('normalizes a multi-segment templated path positionally', () => {
    expect(
      normalizeRequestPath('/dental/patients/{{patientId}}/case-presentations/{{pid}}/accept'),
    ).toBe('/dental/patients/{}/case-presentations/{}/accept');
  });

  test('leaves a static path unchanged', () => {
    expect(normalizeRequestPath('/audit/logs')).toBe('/audit/logs');
  });

  test('drops a query string', () => {
    expect(normalizeRequestPath('/audit/logs?resource={{person_id}}&action=create')).toBe(
      '/audit/logs',
    );
  });

  test('strips a trailing slash (except root)', () => {
    expect(normalizeRequestPath('/dental/visits/')).toBe('/dental/visits');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) hurl request-line parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('parseHurlRequestLine', () => {
  test('parses a POST line with the {{api}} prefix var', () => {
    expect(parseHurlRequestLine('POST {{api}}/persons')).toEqual({
      method: 'POST',
      path: '/persons',
    });
  });

  test('parses a GET with a templated segment and query', () => {
    expect(
      parseHurlRequestLine('GET {{api}}/audit/logs?resource={{person_id}}&action=create'),
    ).toEqual({ method: 'GET', path: '/audit/logs?resource={{person_id}}&action=create' });
  });

  test('returns null for a non-api prefix (e.g. {{mailpit_api}})', () => {
    expect(parseHurlRequestLine('GET {{mailpit_api}}/api/v1/search?query=x')).toBeNull();
  });

  test('returns null for a non-request line', () => {
    expect(parseHurlRequestLine('Content-Type: application/json')).toBeNull();
    expect(parseHurlRequestLine('HTTP 200')).toBeNull();
    expect(parseHurlRequestLine('# a comment')).toBeNull();
  });

  test('ignores indented / commented request lines', () => {
    expect(parseHurlRequestLine('# POST {{api}}/persons')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) path resolver: (method, path) → operationId
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURE_OPENAPI = {
  paths: {
    '/persons': { post: { operationId: 'createPerson' } },
    '/persons/{person}': {
      get: { operationId: 'getPerson' },
      patch: { operationId: 'updatePerson' },
    },
    '/audit/logs': { get: { operationId: 'listAuditLogs' } },
    '/dental/visits/{id}': { get: { operationId: 'getDentalVisit' } },
  },
};

describe('buildPathResolver / resolveToOperationId', () => {
  const resolver = buildPathResolver(FIXTURE_OPENAPI);

  test('resolves a static path', () => {
    expect(resolveToOperationId(resolver, 'POST', '/persons')).toBe('createPerson');
  });

  test('resolves a templated path positionally regardless of var name', () => {
    expect(resolveToOperationId(resolver, 'GET', '/persons/{{anything}}')).toBe('getPerson');
    expect(resolveToOperationId(resolver, 'PATCH', '/persons/{xyz}')).toBe('updatePerson');
  });

  test('resolves a path with a query string', () => {
    expect(resolveToOperationId(resolver, 'GET', '/audit/logs?x=1')).toBe('listAuditLogs');
  });

  test('returns null for an unknown path or method', () => {
    expect(resolveToOperationId(resolver, 'DELETE', '/persons')).toBeNull();
    expect(resolveToOperationId(resolver, 'GET', '/nope')).toBeNull();
  });

  test('is case-insensitive on the method', () => {
    expect(resolveToOperationId(resolver, 'get', '/persons/{{x}}')).toBe('getPerson');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) hurl corpus → covered operationIds
// ─────────────────────────────────────────────────────────────────────────────

describe('parseHurlContractOps', () => {
  const resolver = buildPathResolver(FIXTURE_OPENAPI);

  test('extracts the set of operationIds referenced across hurl text blocks', () => {
    const hurl = [
      '# comment',
      'POST {{api}}/persons',
      'Content-Type: application/json',
      'HTTP 201',
      '',
      'GET {{api}}/audit/logs?resource={{person_id}}',
      'HTTP 200',
      'GET {{mailpit_api}}/api/v1/search', // non-api, ignored
    ].join('\n');
    const ops = parseHurlContractOps([hurl], resolver);
    expect(ops.has('createPerson')).toBe(true);
    expect(ops.has('listAuditLogs')).toBe(true);
    expect(ops.size).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) recorded-ops sink (JSONL) → covered operationIds
// ─────────────────────────────────────────────────────────────────────────────

describe('loadRecordedOps', () => {
  const resolver = buildPathResolver(FIXTURE_OPENAPI);

  test('returns an empty set when the sink is absent', () => {
    expect(loadRecordedOps('/no/such/file.jsonl', resolver).size).toBe(0);
  });

  test('resolves recorded {method, matchedRoutePath} lines to operationIds', () => {
    const sink = [
      JSON.stringify({ method: 'POST', matchedRoutePath: '/persons' }),
      JSON.stringify({ method: 'GET', matchedRoutePath: '/persons/:person' }),
      'not json — tolerated',
      JSON.stringify({ method: 'GET', matchedRoutePath: '/dental/visits/:id' }),
      '',
    ].join('\n');
    const ops = loadRecordedOps(sink, resolver, /* isText */ true);
    expect(ops.has('createPerson')).toBe(true);
    expect(ops.has('getPerson')).toBe(true); // Hono :param → positional match
    expect(ops.has('getDentalVisit')).toBe(true);
    expect(ops.size).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) disposition
// ─────────────────────────────────────────────────────────────────────────────

function row(p: Partial<EndpointRow>): EndpointRow {
  return {
    operationId: 'op',
    method: 'GET',
    path: '/x',
    module: 'm',
    hasHandler: true,
    hasSDK: true,
    hasFEConsumer: false,
    hasContractTest: false,
    hasIntegrationTest: false,
    hasJourney: false,
    disposition: 'tested',
    ...p,
  };
}

describe('classifyDisposition', () => {
  test('FE-consumed but untested → gap', () => {
    expect(classifyDisposition(row({ hasFEConsumer: true }))).toBe('gap');
  });

  test('FE-consumed AND tested by ANY layer → tested', () => {
    expect(classifyDisposition(row({ hasFEConsumer: true, hasContractTest: true }))).toBe(
      'tested',
    );
    expect(classifyDisposition(row({ hasFEConsumer: true, hasIntegrationTest: true }))).toBe(
      'tested',
    );
    expect(classifyDisposition(row({ hasFEConsumer: true, hasJourney: true }))).toBe('tested');
  });

  test('handler+SDK but no FE consumer → orphan', () => {
    expect(classifyDisposition(row({ hasHandler: true, hasSDK: true, hasFEConsumer: false }))).toBe(
      'orphan',
    );
  });

  test('an orphan that nonetheless has a test is still an orphan (not FE-consumed)', () => {
    expect(
      classifyDisposition(
        row({ hasHandler: true, hasSDK: true, hasFEConsumer: false, hasContractTest: true }),
      ),
    ).toBe('orphan');
  });

  test('neither consumed nor handler+SDK → tested (no obligation)', () => {
    expect(
      classifyDisposition(row({ hasHandler: true, hasSDK: false, hasFEConsumer: false })),
    ).toBe('tested');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f2) gaps + ratchet — the ARMED gate (this is what makes endpoint-matrix
//       --check enforce; before arming, main() ignored --check = a verified no-op)
// ─────────────────────────────────────────────────────────────────────────────

describe('gapsOf', () => {
  test('returns exactly the gap-disposition rows, keyed by operationId', () => {
    const rows = [
      row({ operationId: 'a', hasFEConsumer: true }), // gap
      row({ operationId: 'b', hasFEConsumer: true, hasContractTest: true }), // tested
      row({ operationId: 'c', hasHandler: true, hasSDK: true, hasFEConsumer: false }), // orphan
      row({ operationId: 'd', hasFEConsumer: true }), // gap
    ].map((r) => ({ ...r, disposition: classifyDisposition(r) }));

    const gaps = gapsOf(rows);
    expect(gaps.map((g) => g.id).sort()).toEqual(['a', 'd']);
    // gap carries the explanatory columns for the CI report
    expect(gaps[0]).toMatchObject({ id: 'a', operationId: 'a', method: 'GET', path: '/x' });
  });

  test('orphans are NOT gaps (nothing in the app calls them → cannot break it)', () => {
    const rows = [
      row({ operationId: 'orphan1', hasHandler: true, hasSDK: true, hasFEConsumer: false }),
    ].map((r) => ({ ...r, disposition: classifyDisposition(r) }));
    expect(gapsOf(rows)).toHaveLength(0);
  });
});

describe('armed ratchet (non-vacuity)', () => {
  // The headline regression this guards: endpoint-matrix --check used to be a
  // verified no-op (main() never loaded the allowlist). These assertions pin the
  // wiring so a future refactor that re-breaks the gate turns the suite RED.
  test('a NEW gap not on the allowlist FAILS the ratchet', () => {
    const rows = [row({ operationId: 'newlyWired', hasFEConsumer: true })].map((r) => ({
      ...r,
      disposition: classifyDisposition(r),
    }));
    const result = ratchet(gapsOf(rows), /* empty allowlist */ []);
    expect(result.ok).toBe(false);
    expect(result.newGaps.map((g) => g.id)).toContain('newlyWired');
  });

  test('a gap that IS on the allowlist passes (baseline debt is tolerated, tracked)', () => {
    const rows = [row({ operationId: 'baselineGap', hasFEConsumer: true })].map((r) => ({
      ...r,
      disposition: classifyDisposition(r),
    }));
    const result = ratchet(gapsOf(rows), [{ id: 'baselineGap', reason: 'baseline' }]);
    expect(result.ok).toBe(true);
  });

  test('seedAllowlist produces a reason-bearing entry for every current gap (only-shrink invariant holds)', () => {
    const rows = [
      row({ operationId: 'g1', method: 'POST', path: '/p', hasFEConsumer: true }),
      row({ operationId: 't1', hasFEConsumer: true, hasJourney: true }),
    ].map((r) => ({ ...r, disposition: classifyDisposition(r) }));
    const seeded = seedAllowlist(rows);
    expect(seeded.map((e) => e.id)).toEqual(['g1']);
    expect(seeded[0]!.reason.length).toBeGreaterThan(0);
    // a freshly-seeded baseline ratchets green by construction
    expect(ratchet(gapsOf(rows), seeded).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) integration: the real generated artifacts join cleanly
// ─────────────────────────────────────────────────────────────────────────────

describe('generated endpoint-matrix.json', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const ROOT = path.join(import.meta.dir, '..', '..');
  const JSON_PATH = path.join(ROOT, 'docs/testing/coverage/endpoint-matrix.json');

  test('exists and covers every contract-spine operation exactly once', () => {
    expect(fs.existsSync(JSON_PATH)).toBe(true);
    const rows = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as EndpointRow[];
    expect(rows.length).toBeGreaterThanOrEqual(360);
    const ids = new Set(rows.map((r) => r.operationId));
    expect(ids.size).toBe(rows.length); // no dupes
    for (const r of rows) {
      expect(typeof r.operationId).toBe('string');
      expect(['gap', 'orphan', 'tested']).toContain(r.disposition);
    }
  });

  test('disposition is internally consistent with the boolean columns', () => {
    const rows = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as EndpointRow[];
    for (const r of rows) {
      expect(classifyDisposition(r)).toBe(r.disposition);
    }
  });

  test('rows are sorted by operationId codepoint (the freshness-gate determinism invariant)', () => {
    // The CI freshness gate (git diff --exit-code docs/testing/coverage) only
    // holds if a Linux/CI regen byte-matches this committed artifact. That needs
    // an env-independent sort: cmpByCodepoint, NOT locale-dependent localeCompare.
    const rows = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as EndpointRow[];
    const ids = rows.map((r) => r.operationId);
    const resorted = [...ids].sort(cmpByCodepoint);
    expect(ids).toEqual(resorted);
  });

  test('the committed allowlist covers every current gap (the live --check is GREEN)', () => {
    const rows = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as EndpointRow[];
    const allowlistPath = path.join(ROOT, 'docs/testing/coverage/endpoint.allowlist.json');
    const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8')) as {
      id: string;
      reason: string;
    }[];
    const result = ratchet(gapsOf(rows), allowlist);
    // If this is RED, regenerate (`bun scripts/coverage/endpoint-matrix.ts`) and
    // either add a test for the new FE-consumed op or allowlist it with a reason.
    expect(result.newGaps.map((g) => g.id)).toEqual([]);
    // every allowlist entry must carry a non-empty reason (governance invariant)
    for (const e of allowlist) expect(e.reason.trim().length).toBeGreaterThan(0);
  });
});
