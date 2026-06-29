/**
 * Server-binding guard for the closed-visit (read-only) SoT — FR1.16 immutability.
 *
 * The FE gates editing (perio overlay, workspace strip, next-step, route guard) on
 * "is this visit completed|locked?". The server enforces the same set: a completed or
 * locked visit's clinical record is immutable. This test reads the actual server guard
 * in createDentalTreatment and fails the build if the FE `CLOSED_VISIT_STATUSES` and the
 * server's immutability check ever diverge — so a read-only screen can never silently
 * disagree with what the server will accept (the billable.ts drift-proofing, applied to
 * visit immutability).
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CLOSED_VISIT_STATUSES } from './visit-status';

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

describe('closed-visit SoT is bound to the server (FR1.16 immutability)', () => {
  test('FE CLOSED_VISIT_STATUSES equals the server createDentalTreatment immutability guard', () => {
    const handler = join(
      findRepoRoot(),
      'services/api-ts/src/handlers/dental-visit/treatments/createDentalTreatment.ts',
    );
    const src = readFileSync(handler, 'utf8');

    // Match the FR1.16 guard: `visit.status === 'X' || visit.status === 'Y'`.
    // Tolerant of arbitrary whitespace; pulls every quoted status literal in it.
    const m = src.match(
      /visit\.status\s*===\s*'[a-z_]+'(?:\s*\|\|\s*visit\.status\s*===\s*'[a-z_]+')+/,
    );
    expect(
      m,
      "Could not find the `visit.status === 'completed' || visit.status === 'locked'` " +
        'immutability guard in createDentalTreatment.ts — the server guard moved/renamed; ' +
        'update this binding test (and the FE SoT if the rule actually changed).',
    ).not.toBeNull();

    const serverStatuses = new Set(
      [...m![0].matchAll(/'([a-z_]+)'/g)].map((mm) => mm[1]),
    );
    expect(serverStatuses.size, 'server immutability guard yielded no status literals').toBeGreaterThan(0);

    expect(
      [...serverStatuses].sort(),
      'FE visit-status.ts CLOSED_VISIT_STATUSES drifted from the server immutability guard ' +
        '(FR1.16). Make them equal — do not patch one side.',
    ).toEqual([...CLOSED_VISIT_STATUSES].sort());
  });
});
