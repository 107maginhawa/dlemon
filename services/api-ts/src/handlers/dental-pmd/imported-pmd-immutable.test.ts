/**
 * BR-022 / AC-PMD-002: Imported PMDs are immutable
 *
 * PATCH, PUT, and DELETE on /dental/pmd/imported/:id must return 405 with code
 * IMPORTED_PMD_IMMUTABLE. This is the central compliance invariant of the PMD
 * module (MODULE_SPEC §5 BR-022, AC-PMD-002, §20 AI-instruction #3).
 *
 * The guard lives only in app.ts (the generated routes expose GET only), so a
 * throwaway Hono app would prove nothing about the wiring. We build the REAL
 * application via createApp(parseConfig()) and exercise the registered guards
 * end-to-end — same pattern as audit-append-only.test.ts, per
 * [[feedback_test_verification]].
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const FAKE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER_ID = 'bbbbbbbb-1111-4000-8000-000000000002';

// Build the real, fully-wired application once. The immutability guards are
// inline 405 responders with no auth/DB dependency, so they respond directly.
const app = createApp(parseConfig());

// V-XRI-004 — imported-PMD immutability is one of the external-records-import
// PMD-side invariants: a PMD ingested via import MUST be tamper-proof on the
// import surface. PATCH/PUT/DELETE /dental/pmd/imported/:id → 405
// IMPORTED_PMD_IMMUTABLE (the negative-path assertions below). Checksum
// (CHECKSUM_MISMATCH 422), sourceDescription provenance (422), and the pmd.import
// audit are pinned in importPMD.* tests; the immutability 405 is the headline
// negative path and is asserted here.
describe('V-XRI-004 / BR-022 / AC-PMD-002 — imported PMD immutable (real app routes)', () => {
  test('PATCH /dental/pmd/imported/:id → 405 IMPORTED_PMD_IMMUTABLE', async () => {
    const res = await app.request(`/dental/pmd/imported/${FAKE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMPORTED_PMD_IMMUTABLE');
  });

  test('PUT /dental/pmd/imported/:id → 405 IMPORTED_PMD_IMMUTABLE', async () => {
    const res = await app.request(`/dental/pmd/imported/${FAKE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'tamper' }),
    });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMPORTED_PMD_IMMUTABLE');
  });

  test('DELETE /dental/pmd/imported/:id → 405 IMPORTED_PMD_IMMUTABLE', async () => {
    const res = await app.request(`/dental/pmd/imported/${FAKE_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMPORTED_PMD_IMMUTABLE');
  });

  test('DELETE with a different ID also returns 405 [route param independence]', async () => {
    const res = await app.request(`/dental/pmd/imported/${OTHER_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    const body = (await res.json()) as any;
    expect(body.code).toBe('IMPORTED_PMD_IMMUTABLE');
  });
});
