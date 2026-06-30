/**
 * pre-completion-gate (G-09) — derive the visit-completion CTA state from the
 * pre-completion checks, honouring which checks the SERVER hard-blocks.
 *
 * The server (updateDentalVisit completion branch) returns 422 with NO override
 * for unsigned consent and open treatments — so those checks are `blocking`. SOAP
 * note content and open lab orders are not enforced server-side and remain soft
 * (overridable) warnings.
 *
 *  - 'ready'    → all checks pass; primary "Complete visit".
 *  - 'override' → only soft checks fail; "Complete anyway" (owner override).
 *  - 'blocked'  → a blocking check fails (or nothing loaded yet); completion is
 *                 disabled because the server would 422.
 */

export type CompletionGate = 'ready' | 'override' | 'blocked';

export function deriveCompletionGate(
  checks: ReadonlyArray<{ pass: boolean; blocking?: boolean }>,
): CompletionGate {
  if (checks.length === 0) return 'blocked';
  if (checks.some((c) => !c.pass && c.blocking)) return 'blocked';
  if (checks.some((c) => !c.pass)) return 'override';
  return 'ready';
}
