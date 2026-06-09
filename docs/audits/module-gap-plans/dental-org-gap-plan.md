# dental-org — Proposed Fix Plan

**Module:** dental-org · **Date:** 2026-06-09 · **Status:** plan only (no fixes implemented)
**Source audit:** `docs/audits/workflow-verification/runs/dental-org/AUDIT_GAP_REPORT.md`
**Standards:** Vertical TDD (tests RED → impl GREEN), `docs/development/VERTICAL_TDD.md`. Every fix below lists its required failing test first.

---

## 1. Audit Decision

**PARTIAL PASS.** The Organization → Branch → Membership core (CRUD, PIN auth + lockout, dashboard summary, RBAC via `assertBranchRole`/`assertBranchAccess`) is solid and well-tested. But three P1 gaps are **configuration surfaces that have no effect** — each shows a success/"saved" state while changing nothing downstream (working hours, fee schedule, permission grid). These are actively misleading and must be resolved before the module is considered production-ready. Several P2 backends are fully built but unwired to the FE.

---

## 2. Gaps by Severity

### P0 — blocks safe V1
_None._ (No open door: the coarse role gate still protects every endpoint; the P1s are false-precision/false-affordance, not authz bypass.)

### P1 — fix before production
| ID | Gap | Evidence | Decision needed |
|----|-----|----------|-----------------|
| **G1** | ✅ **FIXED 2026-06-09 (Batch 4, decision §6 = backend `{enabled,open,close}` canonical).** Working Hours UI now reads/writes the dedicated `PUT/GET /dental/branches/:id/working-hours` (enforced column) via new `use-working-hours.ts`, not the settings blob. Shape reconciled by `working-hours.logic.ts` (`toCanonical`/`fromCanonical`, 10 unit tests) — the editor `{open,start,end}` ↔ enforced `{enabled,open,close}`. **G1-shape root TypeSpec drift also fixed**: `DentalWorkingHoursDay` was declared `{open,close,isOpen}` map-direct while the handler returns the `{enabled,open?,close?}` envelope `{branchId,workingHours}` — reconciled the spec to the handler (regen) so SDK matches reality. Seed now populates the column (Mon–Fri 09–17, Sat 09–13, Sun closed). Backend enforcement already proven (`dental-scheduling.working-hours.test.ts` 16/0 incl. walk-in bypass); contract round-trip added (`dental-org.hurl` GET-after-PUT). | Live `v2_2_working_hours.png` ("Save Working Hours" success → no enforcement). | (resolved) |
| **G2** | ✅ **FIXED 2026-06-09 (Batch 4, decision §5 = DRIVE pricing; dedicated endpoints canonical).** The dedicated `getFeeSchedule`/`updateFeeScheduleEntry` endpoints are now the canonical fee store and the FE writes there (new `use-fee-schedule.ts`; `fee-schedule.tsx` rebuilt catalog-driven, saving per-CDT via `PATCH /dental/fee-schedule/:cdt` — the inert `settings.feeSchedule` blob save via `useUpdateBranchSettings` is retired). `priceCents` is now **optional** on `CreateDentalTreatmentRequest` (spec→regen); when omitted, `createDentalTreatment` defaults it from the fee schedule via the shared `resolveFeeCents` helper (per-branch override ?? global catalog default ?? 0) — **closes AC-ORG-002**. The global CDT catalog (`dental_procedure_code`) was never seeded (so the endpoints were inert) — now seeded idempotently on boot (`seed-procedure-catalog.ts`, 24 codes). Tests: `fee-resolution.test.ts` (5 unit), `dental-treatment.fee-default.test.ts` (3 integration: override/default/explicit-wins), `dental-visit.hurl §8a/8b/8c` (set fee→price-less treatment defaults), `fee-schedule.test.tsx` (3 FE interaction: catalog prefill + Save PATCHes the dedicated endpoint for the changed row only), `fee-schedule.spec.ts` (E2E set-in-UI→persists via canonical store). ~~drives no pricing~~ | Live `v2_5_fee_saved.png`. | (resolved → DRIVE) |
| **G3** | ✅ **FIXED 2026-06-09 (Batch 4, decision §4 = REMOVE).** The unenforced Permissions tab is removed from `settings.tsx` (tab + render + import + `Tab` type), and the orphaned `permission-grid.tsx` / `permission-grid.test.ts` / `use-permissions.ts` deleted. The coarse `assertBranchRole` (109 files) remains the gate. No FE route existed (tab-only), so no orphan-route guard needed; the backend `getPermissionGrid`/`updatePermissions` endpoints are left as harmless unwired orphans (FE-only removal per the matrix). ~~Granular permission grid editable but unenforced.~~ | Repo-wide grep. | (resolved) |

### P2 — recommended before prod
| ID | Gap | Evidence |
|----|-----|----------|
| **G4** | **Staff invitation / `invited` state divergence.** Actual = direct PIN-staff creation (`staff-create-modal.tsx:158`); PRD WF-004/AC-ORG-003/§8 describe email-invite → set-password → `invited→active`; tsp `MemberStatus` omits `invited`. | **[NEEDS CONFIRMATION]** intent. |
| **G5** | **No post-creation staff edit.** Staff screen subtitle "Manage your team and assign roles" but only a Deactivate action; `updateMember` has 0 FE consumers. Role can't be changed; provider license/NPI/credentialType (claims, CLAIM-BR-001) can't be entered in the UI. | Live `/staff`: 0 edit affordances. |
| **G6** | **Consent-template management has no UI.** Backend CRUD complete (ORG-S4 = P1); 0 FE consumers. PRD §9 lists consent templates as a Branch-Settings purpose. | grep. |
| **G7** | **No multi-branch create / switcher in FE.** `CreateBranchRequest` + `getBranchesByUser` exist (WF-070 = P0); `getBranchesByUser` 0 FE consumers; onboarding provisions only the default branch. | grep. |

### P3 — polish / deferred
| ID | Gap |
|----|-----|
| **G8** | PIN self-recovery (`setSecurityQuestion`/`recoverPin`) has no UI; only owner-reset is wired. |
| **G9** | org-context (`lib/load-org-context.ts:24`) + verify-pin (`pin-entry.$memberId.tsx:261`) use raw `fetch`, bypassing the generated SDK + no-raw-fetch rule. |
| **G10** | Audit-viewer query param drift (camelCase + limit/offset vs spec snake_case + page) — already tracked as EM-AUD-013. |
| — | Terminology: `invited` documented but absent from contract/FSM; `revoked` flagged legacy/unused (confirm removed or document as dead). |

---

## 3. Recommended Fix Order

Ordered by safety + value. Security-relevant honesty first, then the two other false-affordances, then wiring built backends, then polish.

1. **G3 (decide first).** Either remove/disable the Permissions tab (small, honest) or wire `assertPermission` into handlers (large, risky). Decision gates the rest because "enforce" is a cross-cutting change.
2. **G1 — working hours enforcement.** Point the UI at the dedicated `updateWorkingHours` endpoint (or mirror blob→column in `branchSettings`), seed the column, and prove enforcement with an out-of-hours booking E2E.
3. **G2 — fee schedule.** Per decision: consume `settings.feeSchedule` for treatment/invoice price defaults (close AC-ORG-002) **or** relabel as a non-binding reference list.
4. **G5 — staff edit modal** (role change + license/NPI/credential capture) — wire `updateMember`.
5. **G6 — consent-template settings panel** — wire the CRUD.
6. **G7 — branch management / switcher** — wire `getBranchesByUser` + `CreateBranchRequest`.
7. **G4 — terminology/state reconcile** (doc-only if PIN-staff is intended; otherwise build invite flow).
8. **G8 → G9 → G10** polish.

---

## 4. Dependencies on Other Modules

| Fix | Depends on / touches | Note |
|-----|----------------------|------|
| **G1** | **dental-scheduling** (`createAppointment.ts`, `org-scheduling.facade.ts`) + **seed** | Enforcement seam lives in scheduling; the fix is in dental-org's FE/settings but its proof is a scheduling E2E. Coordinate so the column is the single source of truth. |
| **G2** | **dental-visit/treatments** (`createDentalTreatment`) and/or **dental-billing** (invoice line creation) | "Drive pricing" changes treatment/invoice entry — cross-module. "Reference-only" is dental-org-local. |
| **G3 (enforce path)** | **All clinical/billing/scheduling handlers** (~100 via `assertBranchRole`) + `handlers/shared/assert-permission.ts` | Cross-cutting; needs a per-feature→handler mapping. High blast radius. |
| **G3 (remove path)** | dental-org FE only | Self-contained. |
| **G4 (invite path)** | **Better-Auth** (invitation email, set-password), **email** module, **notifs** (DE-022) | Significant integration. |
| **G5** | **person** (provider records), claims readiness in **dental-patient/insurance** consume license/NPI | Credential fields feed claims. |
| **G6** | **dental-patient** consent capture reads templates | Template library feeds patient consent. |
| **G7** | **person** + onboarding | Branch scoping ripples to every downstream module's `assertBranchAccess`. |

Spec-first reminder: G1/G2/G4 changes that alter request/response shapes must go **TypeSpec → regen → handler → SDK → FE** (never hand-edit generated files), then re-gate full typecheck + contract suite (8-file MinIO/Mailpit infra baseline is expected-fail).

---

## 5. Tests Required Before "Fixed"

A gap is not closed until its named test goes RED-before / GREEN-after and the full gate stays green (`bun test` + api-ts `bunx tsc` + contract + FE unit + lint/boundaries).

| Gap | Required tests (write failing first) |
|-----|--------------------------------------|
| **G1** | (a) **E2E**: owner sets working hours in Settings → a non-walk-in appointment outside those hours is rejected (`OUTSIDE_WORKING_HOURS`); a walk-in bypasses. (b) **FE unit**: Working Hours save calls the dedicated working-hours mutation (not the settings-blob mutation). (c) **Backend/contract**: `updateWorkingHours` persists to `dental_branch.working_hours`; `getBranchSchedulingConfig` reads it back. (d) **Seed test**: demo branch has working hours populated. |
| **G2 (drive)** | (a) **Integration/E2E**: configure CDT price → new treatment/invoice line defaults to it (AC-ORG-002). (b) **Unit**: price-resolution helper falls back to catalog default when no override. |
| **G2 (reference)** | (a) **FE unit**: screen copy no longer claims it sets invoice prices; (b) snapshot/coherence test that the list is read-only-reference labeled. |
| **G3 (enforce)** | (a) **Integration**: an override denying a (role,feature) makes the corresponding handler return 403; allowing it returns 200. (b) **Unit**: `resolvePermission` precedence (override > default). (c) Permission tests per affected handler. |
| **G3 (remove)** | (a) **FE unit**: Permissions tab not rendered / disabled. (b) Guard test that no orphan route exposes it. |
| **G4 (reconcile)** | Doc-only; add a contract test asserting `MemberStatus` enum = {active,inactive} matches FSM (lock the decision). |
| **G4 (invite)** | E2E: invite → email → set password → membership `invited→active`; expired-invite resend. |
| **G5** | (a) **FE unit**: staff row Edit opens modal; role change persists via `updateMember`; license/NPI validation (NPI `^\d{10}$`). (b) **Contract**: `updateMember` role/credential round-trip; owner-only guard (403 for non-owner). |
| **G6** | (a) **FE unit**: consent-template list/create/edit/deactivate. (b) **Contract**: CRUD + owner-only write. |
| **G7** | (a) **FE unit**: branch list + create + switch updates org-context branchId. (b) **Contract**: `getBranchesByUser` returns the caller's active memberships; `createBranch` owner-only. |
| **G8** | FE unit: security-question setup + recover-pin flow; lockout (429) path. |
| **G9** | Lint passes with no-raw-fetch enabled for these two files; SDK-call unit. |
| **G10** | Contract: audit viewer accepts the normalized params. |

Regression guard: extend `apps/dentalemon/tests/smoke/dental-org_smoke.py` so a future pass cannot re-introduce a "saved-but-no-effect" surface (assert downstream effect, not just the success toast).

---

## 6. Open `[NEEDS CONFIRMATION]` Items (block the relevant fixes)

1. **G3 — enforce vs remove the permission grid.** Are granular per-(role,feature) overrides a product requirement, or is the coarse role model sufficient? *(Enforce = ~100-handler change; Remove = small.)*
2. **G2 — drive-pricing vs reference-only.** Should configuring a fee auto-default invoice/treatment line prices (close AC-ORG-002), or stay a non-binding reference list?
3. **G4 — staff model.** Is direct PIN-staff creation the intended (local-first) model — reconcile PRD/spec — or should the PRD's email-invitation workflow (WF-004, `invited` state) be built?
4. **`revoked` enum value** — confirm it is dead and should be removed, or document its intended use.
5. **Scope of this pass** — P1 only (G1–G3) / P1+P2 (G1–G7) / everything (G1–G10).

---

## 7. Evidence Index
- Audit: `docs/audits/workflow-verification/runs/dental-org/AUDIT_GAP_REPORT.md`
- Live screenshots: `outputs/dental-org-audit/screenshots/` (`v2_2_working_hours.png`, `v2_5_fee_saved.png`)
- Drivers: `outputs/dental-org-audit/drive2.cjs`

---

# 8. Test Coverage Review (added 2026-06-09)

> Test-first review pass. **Does not alter §1–§6 audit findings.** §5 above is the per-gap
> "tests required before fixed" summary; this section is the detailed coverage map that §5
> compresses — it inventories what already exists, names the precise missing tests by layer,
> and re-sequences the fixes around their test dependencies. New finding **G1-shape** below.

## 8.0 New finding promoted from this review — G1-shape (raises G1 to "two-part fix")

The split-brain in G1 is **not only a wrong-endpoint problem; it is a shape-incompatibility problem.**

- FE `working-hours.tsx` (`DaySchedule`, lines 9–12) serializes `{ open: boolean, start: "HH:mm", end: "HH:mm" }` into `settings.workingHours`.
- The scheduler's `parseWorkingHours` (consumed by `createAppointment.ts:60-66`) and the dedicated `updateWorkingHours` endpoint expect `{ enabled: boolean, open: "HH:mm", close: "HH:mm" }` (see `dental-scheduling.working-hours.test.ts:166-174`).
- `open` means **boolean "is the day open"** in the FE shape but **"opening time string"** in the column shape — a field-name collision that would silently mis-parse.

**Consequence for the fix plan:** simply pointing the Working Hours UI at `updateWorkingHours` (or mirroring blob→column) **without reconciling the shape** would still produce a silently-ignored config (every day parsed as closed/unset). A **schema-conformance test is therefore a P0 gate on G1** — it must exist and pass before any G1 wiring change is trusted. Mark the chosen canonical shape `[NEEDS CONFIRMATION]` (recommend the backend `{enabled, open, close}` shape, since the enforcement seam already speaks it).

## 8.1 Existing Tests Found

**Backend (strong — handlers/primitives are well covered):**
- `permissions.test.ts` — grid read/write, owner-only write (403), unknown-feature (400), anti-lockout (400), **and the `assertPermission`/`resolvePermission` primitive** incl. override-deny enforcement + catalog-default fallback + non-member→null. *The primitive is proven; no production handler calls it (G3).*
- `dental-scheduling.working-hours.test.ts` — **exhaustive column→enforcement**: GET/PUT round-trip, validation (400), 401/403 guards, and `createAppointment` blocked outside-hours/closed-day/timezone-aware/exact-boundary + `walkIn` bypass (BR-SCH-002). *Proves the column is enforced — but only when the column is populated with the backend shape.*
- `updateMember.test.ts` — PATCH role change, no-valid-fields (400), invalid role (400), 404, 401, success. *G5 backend covered; FE unwired.*
- `getBranchesByUser.test.ts` — G7 backend covered; FE unwired.
- `dental-org.fee-schedule.test.ts` + `fee-schedule-route-registration.test.ts` — fee-schedule **round-trip** covered; *no consumer test (G2).*
- `dental-org.clinic-settings.test.ts`, `dental-org.dashboard-summary-extended.test.ts`, `verifyPin.test.ts`, `dental-org.pin-recovery.test.ts`, `resetMemberPin.test.ts`, `memberTierLimits.test.ts`, `em-org-ownership.test.ts`, `dental-org-auth-p0.test.ts`, `auth-security-hardening.test.ts`, `*-route-registration.test.ts`, repos `branch/membership/organization/dental-staff/org-scheduling.facade` — core CRUD/PIN/lockout/audit/RBAC solid.

**Contract (`specs/api/tests/contract/dental-org.hurl`):** org→branch→membership lifecycle, owner-bootstrap nuance, set-pin/verify-pin, branch-settings round-trip, **working-hours round-trip** (note: uses backend `{enabled, open, close}` shape). *No coverage of: permission-override enforcement on a real endpoint, fee→invoice, `updateMember` credential round-trip, consent templates, `getBranchesByUser`.*

**Frontend (shallow — pure helpers ONLY; no wiring/effect assertions):**
- `working-hours.test.ts`, `fee-schedule.test.ts`, `permission-grid.test.ts` (indexCells/diffOverrides), `staff-list.test.ts` (formatRole/badge/canDeactivate), `clinic-settings.test.ts`, `locale-settings.test.ts`, `notification-settings.test.ts`, `use-branch-settings.test.ts`, `staff-create-modal.test.ts`, `use-staff-members.test.ts`, `use-dashboard-summary.test.ts`, `morning-briefing.test.ts`.
- **None assert that "Save" invokes the correct mutation, nor any downstream effect.** This is precisely why the prior pass missed G1–G3.

**E2E:** `add-staff.spec.ts` (page loads, add-modal, 6-digit PIN validation, create-adds-to-list, FR8.13 non-owner denied), `auth-pin.spec.ts` (PIN flow, wrong-PIN, role-based landing, FR9.7 "Forgot PIN?" after 3 fails), `auth-gates.spec.ts` (route auth), `role-gates-scheduling.spec.ts` (**coarse** `staff_scheduling` 403 on clinical/void — the existing role-gate proof, *not* permission-override), `dental-onboarding.spec.ts` + `journeys/18-org-onboarding.journey.spec.ts`. *No E2E asserts UI-config → downstream consumption for hours/fees/permissions; no staff-edit E2E; no consent-template / branch-switcher E2E.*

**Smoke:** `apps/dentalemon/tests/smoke/dental-org_smoke.py` — save→reload round-trip + role-deny only (the exact blind spot: never asserts downstream effect).

## 8.2 Missing Backend Tests

| Gap | Missing backend (bun) test | Priority |
|-----|----------------------------|----------|
| **G1-shape** | Unit: the canonical working-hours serializer/parser accepts the FE-authored payload and yields the `{enabled, open, close}` shape `parseWorkingHours` consumes (or assert a single shared shape end-to-end). RED before any reconcile. | **P0** |
| **G1** | If fix = "branchSettings mirrors blob→column": handler test that `PUT /branches/:id/settings` with `workingHours` **also writes `dental_branch.working_hours`** in the enforced shape; `getBranchSchedulingConfig` reads it back. | P1 |
| **G2 (drive)** | Unit: price-resolution helper returns `settings.feeSchedule[cdt]` when set, falls back to catalog `defaultFee` otherwise. Handler: `createDentalTreatment` defaults `priceCents` from fee schedule when body omits it. | P1 |
| **G3 (enforce)** | Per affected handler: with an override denying `(role,feature)` the handler returns 403; allowing returns 200. (Primitive already covered in `permissions.test.ts`; the **call-site** is not.) | P1 |
| **G5** | Already covered by `updateMember.test.ts` for role; **add** license/NPI/credentialType round-trip + owner-only write (403 non-owner) if those columns are added. | P2 |
| **G6** | `consentTemplates` CRUD handler tests incl. owner-only write + branch scoping (verify whether already covered; if not, add). | P2 |
| **G8** | `setSecurityQuestion`/`recoverPin` happy-path + lockout(429) handler tests (partly in `dental-org.pin-recovery.test.ts` — confirm recover path). | P3 |

## 8.3 Missing Frontend Tests

| Gap | Missing FE (bun/RTL) test | Priority |
|-----|---------------------------|----------|
| **G1** | Working Hours "Save" calls the **dedicated working-hours mutation** (post-fix), not `useUpdateBranchSettings`; serialized payload matches the canonical shape. | P1 |
| **G2** | (drive) treatment/invoice price field **pre-fills** from configured fee schedule; (reference) screen copy no longer claims it sets prices and renders a read-only-reference label. | P1 |
| **G3** | (remove path) Permissions tab is not rendered / disabled; (enforce path) grid still saves overrides via `use-permissions`. | P1 |
| **G5** | Staff row exposes an **Edit** affordance that opens a modal; role change persists via `updateMember`; NPI validation (`^\d{10}$`); non-owner sees no Edit. | P2 |
| **G6** | Consent-template list/create/edit/deactivate panel renders and mutates. | P2 |
| **G7** | Branch list + create + switch updates org-context `branchId` (Zustand store). | P2 |
| **G8** | Security-question setup + recover-PIN flow renders and submits. | P3 |
| **G9** | (after SDK migration) unit asserting org-context + verify-pin call the SDK client, not raw `fetch`. | P3 |

> **Cross-cutting FE-test upgrade (P1):** the current pure-helper FE tests must be supplemented with **interaction tests that assert the mutation call** (mock the SDK hook, assert it was invoked with the expected args). Without this, a future regression can again ship a "saved" toast wired to nothing and stay green.

## 8.4 Missing Integration / API (contract) Tests

| Gap | Missing contract/integration test | Priority |
|-----|-----------------------------------|----------|
| **G3** | Hurl: owner sets an override denying a `(role,feature)` → a request to the real guarded endpoint as that role returns 403; flipping the override → 200. (Proves the override reaches enforcement end-to-end.) | P1 |
| **G2 (drive)** | Hurl/integration: configure CDT fee → create treatment/invoice line **without** explicit price → line defaults to the configured fee (AC-ORG-002). | P1 |
| **G1** | Hurl: write hours via the **UI path** → `GET working-hours` reflects them in the enforced shape (closes the split-brain at contract level). | P1 |
| **G5** | Hurl: `PATCH /dental/org/members/:id` role + credential round-trip; owner-only (403 for non-owner). | P2 |
| **G6** | Hurl: consent-template CRUD + owner-only write. | P2 |
| **G7** | Hurl: `getBranchesByUser` returns caller's active memberships; `createBranch` owner-only. | P2 |
| **G10** | Hurl: audit viewer accepts normalized params (snake_case + page). | P3 |

## 8.5 Missing E2E / User-Journey Tests (the downstream-effect proofs)

| Gap | Missing E2E (the proof the audit says was never written) | Priority |
|-----|----------------------------------------------------------|----------|
| **G1** | Owner sets working hours **in Settings UI** → a non-walk-in appointment **outside** those hours is rejected (`OUTSIDE_WORKING_HOURS`); a walk-in at the same time succeeds. *This is the single most important missing test — it is the only one that catches the split-brain through the real UI.* | **P0 (before G1 sign-off)** |
| **G2 (drive)** | Owner sets D0120 fee in UI → new treatment/invoice line for D0120 defaults to that price (AC-ORG-002). | P1 |
| **G3 (enforce)** | Owner toggles a permission override in UI → the affected role is then denied/allowed the corresponding action in the real app. | P1 |
| **G5** | Owner edits a staff member's role/credentials and the change is reflected on reload. | P2 |
| **G7** | Owner creates a second branch and switches into it; branch-scoped data follows. | P2 |

## 8.6 Regression Tests Required Per Gap (lock the seam shut)

- **G1:** (a) E2E UI-hours→out-of-hours-booking-rejected (8.5); (b) shape-conformance unit (8.0/8.2); (c) extend `dental-org_smoke.py` to assert a booking is actually blocked, not just that the toast appears.
- **G2:** invoice/treatment-defaulting test (8.4) **or**, if reference-only, a copy/affordance test that the screen does not claim pricing effect.
- **G3:** override-changes-handler-decision test at both contract (8.4) and E2E (8.5); guard test that no orphan route re-exposes a removed Permissions tab (remove path).
- **G5/G6/G7:** the FE interaction + contract round-trip pairs above double as regression guards for "built backend, unwired FE".
- **Module-wide anti-regression (P1):** upgrade `dental-org_smoke.py` so every config surface asserts a **downstream effect** (booking blocked / price defaulted / permission enforced), never a success toast alone. This is the structural fix for the class of bug that produced G1–G3.

## 8.7 Updated Test-First (TDD) Fix Sequence

Per `docs/development/VERTICAL_TDD.md` — each step is RED (failing test) → smallest fix → GREEN + full gate.

1. **G3 decision gate (no code).** Resolve enforce-vs-remove (`[NEEDS CONFIRMATION]` #1). The decision picks the test set below.
2. **G1 — shape first, then wiring:**
   1. RED: shape-conformance unit (FE payload → enforced `{enabled,open,close}`).
   2. Fix: reconcile to one canonical shape.
   3. RED: contract "UI path → GET working-hours reflects enforced shape".
   4. Fix: point UI at dedicated endpoint **or** mirror blob→column; seed the column.
   5. RED→GREEN: E2E UI-hours → out-of-hours booking rejected + walk-in bypass.
   6. Regression: extend smoke to assert the block.
3. **G2 (per decision):** drive → RED price-resolution unit + contract fee→invoice default + E2E; reference → RED copy/affordance test.
4. **G3 (per decision):** enforce → RED per-handler 403-on-override + contract + E2E; remove → RED FE "tab absent" + orphan-route guard.
5. **G5:** RED FE Edit-modal/role-persist/NPI-validation + contract credential round-trip → wire `updateMember`.
6. **G6:** RED FE consent-template panel + contract CRUD → wire.
7. **G7:** RED FE branch-list/create/switch + contract `getBranchesByUser`/`createBranch` → wire.
8. **G4 → G8 → G9 → G10** as in §3.

## 8.8 Fix-Order Adjustments (vs §3)

- **No change to the top-level §3 priority order** (G3 decision → G1 → G2 → G5/G6/G7 → polish). The audit's ordering is sound.
- **One refinement inside G1:** insert the **shape-conformance test as a hard pre-step** before any G1 wiring change (8.0). The original §3/§5 implied "point the UI at the endpoint" is sufficient; this review shows the shape must be reconciled and pinned *first*, or the wiring change will silently no-op and re-create the exact gap with a green suite.
- **G3 elevation note:** the enforcement primitive is already fully unit-tested, so the *only* missing G3 work is the **call-site** test (contract + E2E). This makes the **remove path** strictly cheaper than §3 implied (one FE-absent test + one orphan-route guard) and the **enforce path** a per-handler test multiplication — reinforcing that the §6 `[NEEDS CONFIRMATION]` decision is the genuine gate.
- **Priority bumps from this review:** the **UI-hours→booking-rejected E2E (8.5)** and the **G1 shape-conformance unit (8.0)** are **P0 gates on G1 sign-off** (the audit listed G1 as P1 overall; these two *tests* are P0-blocking within it). Everything else tracks the §2 severities.

---

# 9. Knowledge Graph Validation (added 2026-06-09)

> KG-alignment pass. Validates §1–§8 findings against **actual code relationships** (handler→repo, UI→SDK→handler wiring, FE-consumer counts) without redoing the audit/TDD review. **Does not alter prior findings** — it confirms, sharpens, or flags them.

## 9.1 KG Validation Summary

**Method / staleness note.** The understand-anything knowledge graph (`.understand-anything/knowledge-graph.json`, baseline commit `1196799b`) is **405 source-files stale** vs HEAD `e49e411d` — that is `FULL_UPDATE` territory under the auto-update decision gate, which recommends `/understand --full` (≈12M tokens / 60–90 min, poor ROI) rather than an incremental patch. A full rebuild was therefore **not** run. Validation instead used the more accurate, dental-org-current sources:
1. **`.understand-anything/contract-spine.json`** (regenerated; `operationId → handler → SDK → FE-consumer` wiring; counts: 352 ops, 352 with-handler, 344 with-SDK, **130 with FE consumers**).
2. **Live reads** of the ~10 changed dental-org source files + their cross-module seams (scheduling, visit/treatments, settings FE).
3. Repo-wide grep for the enforcement primitives.

**Verdict: every P1/P2/P3 finding in §2 and §8 is CONFIRMED by code relationships.** No finding was overstated. Two findings were **sharpened** (G2, G6) and one new structural risk surfaced (R1, the dedicated fee endpoints). The recommended fix order (§3/§8.8) is unchanged.

## 9.2 Confirmed / Adjusted Findings

| Finding | Status | KG / code evidence | Action |
|---------|--------|--------------------|--------|
| **G1** split-brain working hours | **Confirmed** | `working-hours.tsx:118` → `useUpdateBranchSettings` writes `{workingHours: JSON.stringify(hours)}` to settings blob. `createAppointment.ts:60–64` reads `getBranchSchedulingConfig → branch.workingHours → parseWorkingHours` → throws `OUTSIDE_WORKING_HOURS`. Spine: `updateWorkingHours` & `getWorkingHours` = **ZERO FE consumers**. | No product decision — fix per §8.7. |
| **G1-shape** field collision | **Confirmed** | FE `DaySchedule` (working-hours.tsx:9–12) = `{open:boolean, start, end}`; backend/enforcement shape = `{enabled, open:"HH:mm", close}`. `open` is boolean in FE, time-string in column. | Shape-conformance unit is a P0 pre-step (8.0). |
| **G2** fee schedule drives no pricing | **Confirmed + sharpened** | `fee-schedule.tsx:66` → `update({feeSchedule})` writes settings blob; `createDentalTreatment.ts:69` = `priceCents: body.priceCents` (reads neither blob nor dedicated endpoint). **New:** dedicated `getFeeSchedule`/`updateFeeScheduleEntry` exist with **ZERO FE consumers** — a *third* orphan limb (see R1). | Decision #2 still gates; fix now must also reconcile/retire the dedicated fee endpoints. |
| **G3** permission grid unenforced | **Confirmed** | `assertPermission`/`resolvePermission` prod call-sites = **0**; `assertBranchRole` = **109 files**. Spine: `getPermissionGrid`=1 FE, `updatePermissions`=1 FE → grid **is** wired to read/save; only **enforcement** is missing. | Decision #1 is the genuine gate; blast radius confirmed (§9.4). |
| **G4** staff-state / enum divergence | **Confirmed** | `dental-org.tsp:85` `MemberStatus = {active, inactive}` — `invited` **absent**, `revoked` **absent** (effectively already removed from contract). Direct PIN-staff creation is the live model. | Doc-only reconcile; `revoked` confirmable as dead in the enum. |
| **G5** no post-creation staff edit | **Confirmed** | `updateMember` = **ZERO FE consumers** (spine + grep). Backend `updateMember.test.ts` covers role PATCH; FE unwired. | Wire `updateMember` (§8.7 step 5). |
| **G6** consent-template mgmt has no UI | **Confirmed + sharpened** | All 4 template ops (`create/list/update/delete ConsentTemplate`) = **ZERO FE consumers**. **New:** `consent-sheet.tsx` renders a template `<select>` but from a **hardcoded `CONSENT_TEMPLATES` const** (imports only `createConsentForm/signConsentForm/recordConsentRefusal`) — the picker bypasses the backend library. Gap is *worse* than "no UI": there is a UI that should consume `listConsentTemplates` and doesn't. | Wire `listConsentTemplates` into the consent picker as part of G6. |
| **G7** no multi-branch create/switcher | **Confirmed** | `getBranchesByUser`, `createBranch` (`DentalBranchManagement_create`), and the management list/get all = **ZERO FE consumers**. | Wire per §8.7 step 7. |
| **G9** raw-fetch bypass | **Confirmed (line drift)** | `load-org-context.ts:24` raw `fetch('/dental/org/context')`; `pin-entry.$memberId.tsx` has **two** raw fetches (`:240` members list + `:260` verify-pin) — plan cited only `:261`. | Migrate both fetch sites in pin-entry, not one. |

## 9.3 New KG-Discovered Risks

- **R1 — Fee schedule is a *triple* split-brain, structurally identical to G1.** Beyond the settings-blob write (G2), the module ships a **dedicated** `getFeeSchedule` + `updateFeeScheduleEntry` endpoint pair that **no FE file consumes**. So three independent representations exist (settings blob ← FE writes; dedicated fee table ← orphan; treatment body ← what pricing actually reads). The G2 "drive pricing" fix must explicitly choose the canonical store and **retire or wire the orphan endpoints**, exactly as G1 must reconcile blob-vs-column. Add a "which fee store is canonical" sub-decision under §6 #2.
- **R2 — `getWorkingHours` (read side) is also orphaned.** G1 names `updateWorkingHours`; the paired **read** endpoint `getWorkingHours` is likewise zero-consumer. Any G1 wiring that points the UI at the dedicated endpoints must wire **both** read and write, or the Settings panel will save-then-fail-to-reload.
- **R3 — `verifyPin` shows ZERO FE consumers in the spine, yet PIN entry works.** This is because `pin-entry.$memberId.tsx:260` calls it via **raw fetch** (G9), so the spine's SDK-based consumer detector cannot see it. This confirms G9's blast radius is not cosmetic: the raw-fetch sites create *false "orphan endpoint" signals* in the contract-spine. Worth a one-line note that G9 must be fixed before spine "zero-consumer" counts for auth endpoints can be trusted.

## 9.4 Cross-Module Dependencies / Blast Radius (KG-measured)

| Fix | Blast radius (measured) | Note |
|-----|-------------------------|------|
| **G1** | 2 modules: dental-org FE + dental-scheduling enforcement seam (`createAppointment.ts`, `org-scheduling.facade.ts`) + seed. | Low. Proof is a scheduling E2E; column is the single source of truth. |
| **G2** | dental-visit/treatments (`createDentalTreatment.ts:69`) and/or dental-billing line creation; **plus** retire/wire 2 orphan fee endpoints (R1). | Medium — wider than §4 implied due to R1. |
| **G3 (enforce)** | **109 files** call `assertBranchRole` (KG-confirmed). A per-feature→handler override map across ~100 handlers. | **High** — this is the single largest blast radius in the module; the §6 #1 decision is genuinely load-bearing. |
| **G3 (remove)** | dental-org FE only (Permissions tab + orphan-route guard). | Low — strictly cheaper, confirmed. |
| **G5/G6/G7** | Self-contained FE wiring onto already-built, already-tested backends (each backend endpoint confirmed present, zero-consumer). | Low each. |
| **G9** | 2 FE files; also unblocks accurate spine consumer-counting (R3). | Low, but unblocks observability. |

## 9.5 Fix Order Adjustments

- **No change to the §3 / §8.8 sequence** (G3 decision → G1 → G2 → G5/G6/G7 → polish). KG evidence reinforces it rather than reordering it.
- **G3 stays first** — the 109-file `assertBranchRole` footprint quantitatively confirms why the enforce-vs-remove decision must precede everything (it is the only high-blast-radius item).
- **G2 gains an internal sub-step** mirroring G1: *first* pick the canonical fee store and retire/reconcile the orphan `getFeeSchedule`/`updateFeeScheduleEntry` endpoints (R1), *then* wire pricing — otherwise the fix re-creates a green-but-dead surface.
- **G1 wiring must cover read + write** (R2): wire `getWorkingHours` alongside `updateWorkingHours`, or relabel the canonical store as the settings column on both sides.
- **Consider lifting G9 slightly** (still P3, but ahead of other polish): until the two raw-fetch sites use the SDK, the contract-spine reports false orphans for auth endpoints (R3), degrading every future KG-alignment pass.

*Uncertain items remain marked `[NEEDS CONFIRMATION]` in §2/§6; none were resolved by this KG pass — they are product decisions, not code-relationship questions.*
