/**
 * Backend coherence oracle — the server-side twin of the frontend oracle
 * `assertTotalExplainedByRows` (apps/dentalemon/src/test-utils.ts).
 *
 * BUG CLASS IT GUARDS (the EM-BIL-002 incident)
 * ---------------------------------------------
 * An endpoint returns an aggregate TOTAL computed from a DIFFERENT source/scope
 * than the itemised rows it also returns in the same response. The canonical
 * incident: a financial-report summary was summed across ALL tenants/branches
 * while the itemised rows were correctly branch-scoped — so the practice-wide
 * total silently leaked other orgs' money/PHI even though every row looked
 * clean. The two figures drifted because they were computed from two scopes.
 *
 * THE INVARIANT
 * -------------
 * The expected total is derived FROM THE ENDPOINT'S OWN RETURNED ROWS — never
 * from a fixture constant — so a total that reads a wider (or narrower) scope
 * than the rows it ships fails even when the fixture happens to agree with one
 * of the two sources. Concretely:
 *
 *     endpoint.total === Σ over the endpoint's own returned rowAmounts
 *
 * plus the degenerate guard: a non-zero total is never returned with zero rows
 * to explain it (the "all-tenant sum, no rows" shape of the leak).
 *
 * Mirrors the FE oracle's contract exactly: pure (dependency-free), compares in
 * integer minor units to dodge float drift, and THROWS (fails the test) on
 * mismatch. Coerce Drizzle numeric columns with Number() before passing — they
 * come back as STRINGS.
 */

/**
 * Assert an endpoint's aggregate total equals the sum of the amounts in the
 * rows that SAME endpoint response returned, and that a non-zero total is never
 * returned with zero rows to explain it.
 *
 * Pass `total` and `rowAmounts` parsed from the response body (NOT from the
 * fixture / repo directly) so the assertion catches a total computed from a
 * different source/scope than the rows.
 *
 * @throws on mismatch, or when `total !== 0` with an empty `rowAmounts`.
 */
export function assertEndpointTotalEqualsRepoSum(opts: {
  total: number;
  rowAmounts: number[];
  label?: string;
}): void {
  const { total, rowAmounts, label = 'endpoint total' } = opts;
  const sum = rowAmounts.reduce((a, b) => a + b, 0);
  // Compare in integer minor units to avoid float drift.
  if (Math.round(total * 100) !== Math.round(sum * 100)) {
    throw new Error(
      `${label} reads ${total} but the ${rowAmounts.length} returned row(s) sum to ${sum}`,
    );
  }
  if (total !== 0 && rowAmounts.length === 0) {
    throw new Error(`${label} is ${total} but no rows are returned to explain it`);
  }
}
