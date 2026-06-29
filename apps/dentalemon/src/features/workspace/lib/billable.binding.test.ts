/**
 * Server-binding guard for the billable SoT (BR-009).
 *
 * The all-planned "Create Invoice & Pay → 422" bug recurred because the FE billable
 * rule drifted from the server and a confident COMMENT certified the wrong invariant.
 * The fix is one predicate (`billable.ts`) — but a predicate is only trustworthy if
 * it is provably tied to the authority. This test reads the actual server filter in
 * createDentalInvoice and fails the build if the FE `BILLABLE_STATUSES` set and the
 * server's invoice filter ever diverge. Changing one side without the other breaks
 * here, so neither can silently drift again.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BILLABLE_STATUSES } from './billable';

/** Walk up from this file until we find the repo root (the dir holding services/api-ts). */
function findRepoRoot(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'services/api-ts'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate repo root (no services/api-ts found walking up).');
}

describe('billable SoT is bound to the server (BR-009)', () => {
  test('FE BILLABLE_STATUSES equals the server createDentalInvoice filter', () => {
    const handler = join(
      findRepoRoot(),
      'services/api-ts/src/handlers/dental-billing/createDentalInvoice.ts',
    );
    const src = readFileSync(handler, 'utf8');

    // Scope to the `const billable = treatments.filter(...)` statement, then pull the
    // quoted status literals out of it. Tolerant of `t =>` and `(t) =>` arrow forms.
    const m = src.match(/const billable\s*=\s*treatments\.filter\(([\s\S]*?)\)\s*;/);
    expect(
      m,
      'Could not find `const billable = treatments.filter(...)` in createDentalInvoice.ts — ' +
        'the server filter moved/renamed; update this binding test (and the FE SoT if the rule changed).',
    ).not.toBeNull();

    const serverStatuses = new Set(
      [...m![1].matchAll(/'([a-z_]+)'/g)].map((mm) => mm[1]),
    );
    expect(serverStatuses.size, 'server billable filter yielded no status literals').toBeGreaterThan(0);

    expect(
      [...serverStatuses].sort(),
      'FE billable.ts BILLABLE_STATUSES drifted from the server invoice filter (BR-009). ' +
        'Make them equal — do not patch one side.',
    ).toEqual([...BILLABLE_STATUSES].sort());
  });
});
