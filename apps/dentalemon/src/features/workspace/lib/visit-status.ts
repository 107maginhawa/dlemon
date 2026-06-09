/**
 * visit-status — visit-lifecycle helpers for the workspace.
 *
 * Centralizes the "is there an OPEN visit?" decision the New Visit affordance and
 * the one-active-visit rule both depend on, so the FE gates the affordance on the
 * same condition the backend enforces (see createDentalVisit.ts ACTIVE_VISIT_EXISTS).
 */

/** A visit is "open" while it is active or draft (in-progress); the backend forbids a second. */
export type VisitLike = { id: string; status: string };

/** The patient's open (active/draft) visit, if any. Completed/locked/discarded are not open. */
export function findOpenVisit<T extends VisitLike>(visits: readonly T[]): T | undefined {
  return visits.find((v) => v.status === 'active' || v.status === 'draft');
}

/** Whether a new visit may be started — only when no open visit exists. */
export function canStartNewVisit(visits: readonly VisitLike[]): boolean {
  return !findOpenVisit(visits);
}

/** User-facing reason shown on the disabled New Visit affordance. */
export const NEW_VISIT_DISABLED_HINT =
  'Finish or discard the open visit to start a new one.';
