/**
 * Server-binding guard for the open-treatment completion gate (FR1.16).
 *
 * The pre-completion checklist warns "N treatments not done yet" using isOpenTreatment.
 * The server's updateDentalVisit refuses to complete a visit while any treatment is
 * still diagnosed|planned (throws VISIT_HAS_OPEN_TREATMENTS). If the FE warn-set drifts
 * from the server gate, the checklist could read all-clear while the server still 422s
 * (or warn about a status the server allows). This test reads the actual server guard
 * and fails the build if the FE `OPEN_TREATMENT_STATUSES` and it ever diverge — the
 * billable.ts drift-proofing applied to visit completion.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OPEN_TREATMENT_STATUSES } from './billable';

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

describe('open-treatment SoT is bound to the server completion gate (FR1.16)', () => {
  test('FE OPEN_TREATMENT_STATUSES equals the server updateDentalVisit completion guard', () => {
    const handler = join(
      findRepoRoot(),
      'services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts',
    );
    const src = readFileSync(handler, 'utf8');

    // Scope to the `treatments.some(...)` blocker immediately preceding the
    // VISIT_HAS_OPEN_TREATMENTS throw, then pull the quoted status literals out of it.
    const m = src.match(/treatments\.some\(([^)]*)\)[\s\S]{0,200}VISIT_HAS_OPEN_TREATMENTS/);
    expect(
      m,
      'Could not find the `treatments.some(...)` completion blocker preceding ' +
        'VISIT_HAS_OPEN_TREATMENTS in updateDentalVisit.ts — the server gate moved/renamed; ' +
        'update this binding test (and the FE SoT if the rule actually changed).',
    ).not.toBeNull();

    const serverStatuses = new Set(
      [...m![1].matchAll(/'([a-z_]+)'/g)].map((mm) => mm[1]),
    );
    expect(serverStatuses.size, 'server completion blocker yielded no status literals').toBeGreaterThan(0);

    expect(
      [...serverStatuses].sort(),
      'FE billable.ts OPEN_TREATMENT_STATUSES drifted from the server completion gate ' +
        '(updateDentalVisit / VISIT_HAS_OPEN_TREATMENTS). Make them equal — do not patch one side.',
    ).toEqual([...OPEN_TREATMENT_STATUSES].sort());
  });
});
