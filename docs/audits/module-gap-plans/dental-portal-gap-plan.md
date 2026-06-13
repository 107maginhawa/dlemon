# dental-portal — Module Gap Plan

**Module:** dental-portal (Patient Self-Service Portal, E4 Phase 1 — read-only foundation)
**Audited:** 2026-06-09 (live + code, single-module scope)
**Standard:** `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` §3.2 / §3.14 / §12
**Audit decision:** **PARTIAL PASS**

> One-line verdict: The backend logic, IDOR/RBAC trust boundary, and patient-appropriate
> projections are genuinely solid and well-unit-tested — but the module is an **island**:
> no real patient can authenticate-and-be-linked, there is no seed account, no nav entry,
> no login redirect, and no E2E. The happy path (a patient seeing their own data) is
> **structurally unreachable in production today**; it only "works" in the backend unit
> suite that hand-inserts a `patients` row with `person === userId`.

---

## 1. What was audited (implementation map)

**Backend** (`services/api-ts/src/handlers/dental-portal/`)
- `listMyAppointments.ts` → `GET /me/appointments`
- `listMyInvoices.ts` → `GET /me/invoices`
- `getMyBalance.ts` → `GET /me/balance`
- Trust boundary: `services/api-ts/src/handlers/shared/assert-self-patient.ts`
  (`resolveSelfPatientId`, `resolveSelfPatientIdOrThrow`, `assertSelfPatient`)
- Facades (Phase-10 boundary-safe): `dental-scheduling/repos/appointment-portal.facade.ts`,
  `dental-billing/repos/billing-dental-patient.facade.ts`
- Routes registered behind `authMiddleware({ roles: ['user'] })` (`generated/openapi/routes.ts`)
- Spec: `specs/api/src/modules/dental-portal.tsp`

**Frontend** (`apps/dentalemon/src/features/portal/` + `src/routes/_portal*`)
- `_portal.tsx` (mobile shell, bottom tab bar, `requireAuth` only — no PIN/membership)
- `portal.index.tsx` (→ redirect to appointments), `portal.appointments.tsx`, `portal.bills.tsx`
- `MyAppointmentsView`, `MyInvoicesView` (read-only, honest empty/error/loading states)
- `use-my-portal.ts` (`useMyAppointments` / `useMyInvoices` / `useMyBalance` via SDK)

**Tests found**
- Backend unit: `dental-portal.test.ts` (real Postgres; 2 patients + empty patient + staff-only;
  proves 200-own, isolation both directions, 401, 403, voided/uncollectible hidden, projection)
- Contract: `specs/api/tests/contract/dental-portal.hurl` (401 + 403/NOT_A_SELF_PATIENT + 2-user
  isolation only — **no 200 happy path**, by explicit admission)
- FE unit: `my-appointments-view.test.tsx` (9), `my-invoices-view.test.tsx` (8)
- E2E: **none**

---

## 2. Gap matrix

| Gap | Area | Severity | Why it matters | Recommended fix |
|---|---|---|---|---|
| **No patient onboarding / account-linking path.** `createDentalPatient` mints a brand-new `person` (no Better-Auth `user`), so staff-created patients have **no login**. Self sign-up creates a `user`+`person` but **no `dental_patient` row links to it**, so they get 403. No endpoint bridges the two. | Workflow / Identity | **P1** | The module's sole purpose — a patient viewing their own data — is unreachable by **100% of real users**. Ships UI + endpoints nobody can enter. | Add a provisioning path: either (a) "invite to portal" staff action that creates/links a Better-Auth `user` to an existing patient's `person`, or (b) self sign-up + a staff "claim/link patient" step. Gate behind a product decision (see [NEEDS CONFIRMATION]). |
| **No patient entry point.** A `user`-role sign-in flows through `requireNoPerson`/onboarding → `/dashboard` (staff flow); nothing routes a patient to `/portal`. No nav link anywhere outside the portal subtree. `/portal` is reachable only by manually typing the URL. | UX / Routing | **P1** | Even if a patient were linked, they'd land in the staff onboarding/dashboard, not their portal. The portal is an island. | Add a post-login branch: if the session is a linked patient (has `dental_patient`, no membership) → redirect to `/portal`. Keep staff on `/dashboard`. |
| **No seed patient-portal account.** `seed-demo.ts` creates staff + patients-as-bare-persons; none can log into the portal. | Testability / Demo | **P1** | The happy path cannot be demoed, manually QA'd, or E2E-tested. Every other module is demoable; this one is not. | Seed one patient whose `person.id === a Better-Auth user.id`, with appointments + a mix of invoices (paid/partial/overdue) so all three reads return real data. Unblocks the E2E below. |
| **No E2E journey.** Contract covers only 401/403; the 200 + isolation paths live only in the backend unit suite. | Test coverage | **P2** | IDEAL §9.2 expects E2E for critical journeys. No test proves login→see-appointments→see-bills from the UI. Gated by the seed account above. | Add `apps/dentalemon/tests/e2e/journeys/*portal*.spec.ts`: patient signs in → `/portal/appointments` shows their appts → `/portal/bills` shows balance + invoices → staff-only account hitting `/portal` gets honest denied/empty. |
| **`overdueAmountCents` trusts `status === 'overdue'`.** If invoices are not auto-flipped from `issued`→`overdue` at `dueDate`, the portal under-reports overdue. | Data correctness | **P2** | A patient could be shown 0 overdue while actually past due — a trust/accuracy gap on a money figure. | Confirm whether a job/handler flips status at `dueDate`. If lazy, compute overdue from `dueDate < now && balance > 0` (match the staff `getPatientBalance` definition exactly to avoid a second source of truth). |
| **Contract suite has no 200/own-data scenario.** Acknowledged because there's no Phase-1 seed link. | Test coverage | **P2** | Wire-level proof of the projection + isolation rests entirely on unit tests; the contract can't catch a serialization/route drift on the happy path. | Once a seed/link path exists, add a 200 own-data + projection assertion to `dental-portal.hurl`. |
| **Appointments list is unbounded** (facade returns ALL non-archived appts, no limit/pagination; UI renders a flat list with no upcoming/past split). | UX / Perf | **P3** | Fine for a small clinic V1; a long-tenured patient gets an ever-growing list and no "upcoming first" affordance. | Add a sensible cap + optional upcoming/past grouping when convenient. Not blocking. |
| **Balance load failure is silent.** `{balance && <BalanceSummary/>}` hides the summary with no error; only the invoices query surfaces an error banner. | UX | **P3** | If `/me/balance` fails but `/me/invoices` succeeds, the patient silently loses the headline number. | Surface a small inline error/placeholder for the balance card on `useMyBalance().error`. |
| **Phase 2 reads deferred** (`/me/visits`, `/me/treatment-plans`, `/me/imaging`) + **online payments**. `assertSelfPatient` is built+tested but unused, reserved for these. | Scope | **P3** | Documented deferral (§3.14). Not a defect. | Leave deferred; do not delete `assertSelfPatient` (it's the IDOR gate for patientId-bearing `/me/:id` routes). |

---

## 3. Broken / misleading journeys

- **"Patient logs in and sees their data"** — broken end-to-end. No provisioning path + no entry
  redirect ⇒ a real patient cannot reach the portal at all (P1 #1, #2).
- **"Demo / QA the portal"** — broken. No seed account (P1 #3).
- **Overdue amount** — potentially misleading if statuses aren't auto-flipped (P2).
- Everything the UI *does* render once data arrives is honest (good empty/loading/error states,
  no fake payability, projection hides staff fields). No misleading-affordance bugs found in the UI itself.

---

## 4. Unused / unwired implementation

- `assertSelfPatient` — intentionally unused (Phase-2 IDOR gate), fully tested, **keep**.
- `resolveSelfPatientId` (null-returning variant) — only the throwing variant is used in prod; keep.
- No orphan endpoints: all 3 `/me` ops are routed, SDK-generated, and consumed by `use-my-portal.ts`.
- The reverse orphan is the real story: the **UI + endpoints are wired to each other but not to any
  real user** (no door) — see P1 gaps, not dead code.

---

## 5. Test gaps (before/during fixes)

| Fix | Tests to add first / alongside |
|---|---|
| Provisioning/link path (P1) | Backend unit: linking a `user` to an existing patient's `person` makes `/me/*` return 200; an unlinked `user` still 403. Permission test: only an authorized staff role may invite/link. |
| Patient entry redirect (P1) | FE/route test: linked-patient session → redirected to `/portal`; staff session → `/dashboard`; patient cannot reach `/dashboard` staff routes. |
| Seed account (P1) | Seed-coherence assertion: the seeded portal patient returns ≥1 appointment and ≥1 invoice across statuses. |
| E2E (P2) | Playwright journey: sign in as seeded patient → appointments list non-empty → bills show balance + invoices → staff-only `/portal` = denied/empty. |
| Overdue (P2) | Backend unit: an `issued` invoice past `dueDate` is counted in `overdueAmountCents` (pins the chosen definition). |
| Contract 200 (P2) | `dental-portal.hurl`: authenticated linked patient → 200 with projection-only fields, no staff fields present. |

---

## 6. Knowledge graph findings (dependency / blast radius)

> Graph not regenerated (stale only on type-import edges per recent work; single-module scope).
> Wiring verified directly from code.

- **Upstream deps:** `dental-patient`/`patient`+`person` (identity & the missing provisioning),
  `auth`/Better-Auth (`user` role, `user.id === person.id` invariant), `dental-scheduling`
  (appointment facade), `dental-billing` (invoice facade).
- **Blast radius — narrow:** `appointment-portal.facade.ts` and `billing-dental-patient.facade.ts`
  are portal-only read facades (no writes, boundary-safe). `assert-self-patient.ts` is shared but
  currently only the portal consumes it. Changing portal internals does not ripple into staff flows.
- **Cross-boundary:** the fix for P1 #1/#2 touches identity/auth + routing, so it has wider blast
  radius than the rest of the module and should be planned with `dental-patient` + auth owners.

---

## 7. Recommended fix order

1. **[NEEDS CONFIRMATION] gate** — get the product decision on patient-account provisioning &
   PHI-read scope (invite vs self-claim). Everything else depends on it. *(No code; decision only.)*
2. **P1 — Provisioning/link path** (backend unit + permission tests first). The door.
3. **P1 — Seed portal patient** (seed-coherence assertion). Unblocks demo + E2E.
4. **P1 — Patient entry redirect** (route test first). Connect the island.
5. **P2 — Overdue definition** (unit pin first) — align with staff `getPatientBalance`.
6. **P2 — E2E journey** + **contract 200 scenario**.
7. **P3 — Balance-error surfacing, appointments cap/grouping** (polish).
8. **P3 — Leave Phase 2 reads + online payments deferred** (documented non-goal until vendor/scope).

---

## 8. Dependencies on other modules

- **dental-patient / patient / person** — provisioning + identity linkage (P1 #1).
- **auth / Better-Auth** — `user` provisioning, role, and the `user.id === person.id` invariant.
- **dental-scheduling** — `appointment-portal.facade` (read).
- **dental-billing** — `billing-dental-patient.facade` (read) + overdue definition parity with
  `getPatientBalance` (P2).
- **routing/guards** — post-login branch for patient vs staff (P1 #2).

---

## 9. Existing tests (inventory)

- `services/api-ts/src/handlers/dental-portal/dental-portal.test.ts` — backend unit (real PG):
  200-own, isolation ×2, 401, 403, voided+uncollectible hidden, projection. **Strong.**
- `specs/api/tests/contract/dental-portal.hurl` — 401 + 403 + 2-user isolation. **No 200.**
- `apps/dentalemon/src/features/portal/components/my-appointments-view.test.tsx` (9 tests)
- `apps/dentalemon/src/features/portal/components/my-invoices-view.test.tsx` (8 tests)

## 9b. Missing tests

- **Backend:** provisioning/link 200 + permission; overdue-by-dueDate pin.
- **Frontend:** patient-vs-staff post-login redirect; balance-error surfacing.
- **Integration/contract:** 200 own-data + projection in `dental-portal.hurl`.
- **E2E:** full patient portal journey (sign-in → appointments → bills → staff-only denied).

---

## 10. Items marked [NEEDS CONFIRMATION]

1. **Is patient-account provisioning in scope for this milestone, or still Phase-2 deferred?**
   The IDEAL standard lists "Phase 1 reads + `assertSelfPatient`" as *shipped* and online
   payments/Phase-2 reads as deferred — but it does **not** explicitly say how a patient gets a
   login linked to their record. As built, no real patient can reach the portal. Confirm whether
   "no door" is an accepted Phase-1 limitation or a P0 to fix now. *(Drives whether P1 #1–#3 are
   "fix now" or "documented deferral.")*
2. **Overdue semantics:** is invoice `status` auto-flipped `issued`→`overdue` at `dueDate`
   (by a job), or is it lazy/manual? Determines whether `overdueAmountCents` is correct as-is
   or under-reports (P2).
3. **PHI-read scope for Phase 2** (`/me/visits`, `/me/treatment-plans`, `/me/imaging`): product
   decision on what clinical data a patient may self-read — pre-req for un-deferring `assertSelfPatient`.
