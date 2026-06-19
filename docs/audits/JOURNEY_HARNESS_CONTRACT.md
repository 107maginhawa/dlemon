# Journey Harness Contract

> **Status:** the binding contract for the clinical journey suite
> (`apps/dentalemon/tests/e2e/journeys/`). Every journey spec cites this file
> (`Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §<id>`). The runner is
> `apps/dentalemon/scripts/run-journey-harness.ts`; shared fixtures live in
> `apps/dentalemon/tests/e2e/journeys/_journey-helpers.ts`.

The journeys answer one question: **can a real clinician complete the critical
workflows end-to-end through the rendered DOM?** They are the real-stack functional
proof the computed/structural gates cannot give. The "New Visit broke while CI was
green" incident (see `docs/testing/VERIFICATION_HARDENING.md`) is the reason this
contract exists and why it is now enforced per-PR by the
`journey-verification` workflow.

---

## Definition of Done for a user journey (the 4 clauses)

Every critical journey MUST assert all four. This is the grading rubric — a journey
that omits one is incomplete, regardless of whether it is green.

1. **No silent error surface.** No unexpected error toast
   (`[data-sonner-toast][data-type="error"]`), `console.error`, `pageerror`, or
   unhandled `/dental/*`·`/auth/*` 4xx/5xx during a success-path flow. **Enforced
   automatically** by the `errorSurface` auto-fixture (P2-A) in `_journey-helpers.ts`:
   it is wired into every journey and fails the test in teardown if any non-allowed
   surface fired. A legitimately-negative journey declares its expected error
   explicitly — `errorSurface.allowStatus(code, urlRe?)`, `.allow(textRe)`,
   `.allowUrl(urlRe)` — never by loosening the default.
2. **Goal state, not existence.** Assert the clinically meaningful END state (e.g. a
   visit is `active`/chartable; a treatment is `performed`; a presentation decision is
   `accepted`), never merely "a row exists". A flow whose first step succeeds but whose
   goal step strands the entity (e.g. a visit left at `draft`) MUST fail.
3. **Every step succeeded.** In a multi-step / client-orchestrated flow, assert that
   *each* network call in the flow window returned success (2xx) — not just the first.
   The New-Visit flow is `POST (draft) → PATCH (active)`; asserting only the POST is
   exactly the blind spot that let the incident through.
4. **Independent read confirms the goal.** The post-UI verification reads durable
   persistence via a SEPARATE API session (`apiReader`), not the UI it just drove.

The reference implementation of all four is **J21** (`21-new-visit-create.journey.spec.ts`).

---

## Anti-Cheating Rules

1. **DOM-only drive.** Every journey STEP is performed through the rendered DOM. No
   `apiReader`/`page.evaluate` is used to perform a step. (Pre-journey *seeding* —
   creating patients/visits before the browser opens — and post-UI *reads* are the
   only allowed non-DOM API calls. Creating an entity for which no UI exists, e.g. the
   J04 invoice, is allowed and documented in that spec; it is not a shortcut for a UI
   step that exists.)
2. **Independent read.** Goal state is asserted via a separate API GET executed AFTER
   the UI flow, reading durable persistence — never the in-memory UI state.
3. **No shortcut.** A journey the UI cannot complete is BROKEN. Prove the break with an
   independent read; never patch state to make the spec green.

---

## Verdict semantics

`actualVerdict` is read from each journey's per-record JSON (written via
`recordJourneyPass` / `recordJourneyError` / `recordJourneySkipped`), NOT from
Playwright pass/fail.

| Verdict | Meaning |
|---------|---------|
| `PASS` | All UI steps + the 4 clauses held. |
| `BROKEN` | A real-stack break confirmed by an independent read. |
| `ERROR` | The spec threw before reaching a verdict (a genuine failure, fails the gate). |
| `SKIPPED` | An ENVIRONMENT precondition was absent (e.g. no MinIO ⇒ no seeded ceph image). Tolerated ONLY for `skipAllowed` journeys (the ceph B01–B04). A SKIP on any core journey is verdict drift and fails the gate. |

A missing FEATURE or an unfinishable UI step must **throw** (ERROR), never `SKIP`.

---

## Roster (Set A core · Set B environment-gated)

The authoritative roster + `skipAllowed` flags live in `EXPECTED` in
`apps/dentalemon/scripts/run-journey-harness.ts`. Set A (J01–J10, J16–J21) is the
must-never-break core run by the per-PR `journey-verification` gate; Set B
(B01–B04 ceph, J15 sync) is environment-gated. Each journey's rubric ids map to
`docs/product/WORKFLOW_MAP.md` (e.g. J21 → `WF-045`).
