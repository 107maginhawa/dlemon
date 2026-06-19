/**
 * check-kg-freshness.test.ts — TDD for the understand-anything KG freshness radar.
 *
 * Run from repo root:  bun test ./scripts/check-kg-freshness.test.ts
 *
 * The class this closes (UA_KG_UPGRADE U2 / issue #133): a knowledge graph that
 * silently rots. The old KG was 420 commits / 11 days stale and nothing flagged
 * it at the point it mattered. This radar reads each committed graph's
 * `project.gitCommitHash`, measures how far it has drifted from HEAD, and emits a
 * VISIBLE warning past a threshold — or when a graph has no recorded commit / a
 * commit not in history. It is ADVISORY (never a blocking gate, per the plan's
 * scope guardrail), so `assessFreshness` only classifies; the CLI never exits
 * non-zero on drift.
 *
 * The git distance is INJECTED so these tests are deterministic and offline.
 */

import { describe, expect, test } from 'bun:test';
import { assessFreshness, type GraphFreshness } from './check-kg-freshness';

const g = (
  name: string,
  gitCommitHash: string | null,
  commitsBehind: number | null,
): GraphFreshness => ({ name, gitCommitHash, commitsBehind });

describe('assessFreshness — drift classification', () => {
  test('a graph at HEAD (0 commits behind) produces no finding', () => {
    expect(assessFreshness([g('frontend', 'e75d4864', 0)], 50)).toEqual([]);
  });

  test('a graph within the drift threshold produces no finding', () => {
    expect(assessFreshness([g('frontend', 'abc1234', 10)], 50)).toEqual([]);
  });

  test('a graph past the drift threshold is flagged STALE with its distance', () => {
    const found = assessFreshness([g('domain', 'old1234', 120)], 50);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('stale');
    expect(found[0]!.name).toBe('domain');
    expect(found[0]!.commitsBehind).toBe(120);
    expect(found[0]!.message).toContain('120');
  });

  test('drift exactly AT the threshold is still fresh (boundary)', () => {
    expect(assessFreshness([g('frontend', 'abc', 50)], 50)).toEqual([]);
  });

  test('a graph with no recorded gitCommitHash is flagged MISSING', () => {
    const found = assessFreshness([g('frontend', null, null)], 50);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('missing');
  });

  test('an empty-string gitCommitHash is treated as MISSING', () => {
    const found = assessFreshness([g('frontend', '', null)], 50);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('missing');
  });

  test('a recorded commit not resolvable in history is flagged UNKNOWN-COMMIT', () => {
    // hash present, but `git rev-list` could not compute a distance (rebased away, shallow clone)
    const found = assessFreshness([g('frontend', 'deadbeef', null)], 50);
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('unknown-commit');
  });

  test('mixed roster: only the non-fresh graphs are reported', () => {
    const found = assessFreshness(
      [
        g('frontend', 'head', 0), // fresh
        g('backend', 'old', 300), // stale
        g('domain', null, null), // missing
      ],
      75,
    );
    expect(found.map((f) => f.name).sort()).toEqual(['backend', 'domain']);
    expect(found.find((f) => f.name === 'backend')!.severity).toBe('stale');
    expect(found.find((f) => f.name === 'domain')!.severity).toBe('missing');
  });
});
