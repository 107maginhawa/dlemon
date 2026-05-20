# Workspace Clinical Workflow Compliance & Gap Audit — 2026-05-19

> **⚠ SUPERSEDED — 2026-05-19**
> This audit predates Phase 1 clinical-workflow completion. The P0/P1/P2 items
> it lists as OPEN are resolved in commits 8bb37fc / f6b00b9 (P1.1),
> e65b4d0 (P1.2), 804330b (P1.3), 361d938 (P1.4) on feat/v1.4-clinical-imaging.
> CONFIDENCE_RECONCILED.md (same date) already corrected the P0-001/P0-004
> CRITICAL false-positives. See .planning/STATE.md for current status.
> Phase 2 gaps (J03 perio, J06 plan phasing) are accepted deferred scope.

**Status:** IN PROGRESS. Audited against
[`dental-workspace-audit-reference.md`](./dental-workspace-audit-reference.md)
(gold-standard, standards-validated). Method: hybrid (code/contract-trace all 10
journeys + Playwright live-walk high-risk). Findings-only — no production code
changes pending user approval of the fix plan (end of report).

Severity model per reference §7, with documented promotions.

---

## Executive summary

> **The workspace is NOT clinically deployable today.**
>
> Three P0 defects, eleven P1 gaps, and sixteen P2 gaps were identified across all
> ten canonical journeys. The core revenue path (chart→plan→perform→bill→pay) cannot
> be completed through the UI. Clinical notes are silently lost on navigation.
> Informed consent is never server-enforced. Eight of ten journeys are **Broken**
> or **Partial**; none are fully **Complete**.

### Journey verdict summary

| Journey | Verdict | Blocker |
|---------|---------|---------|
| J1 New-patient exam | **Partial** | Clinical notes lost (P0-004); medical history optional |
| J2 Periodic recall | **Broken** | Carry-over never wired (J2-001); no diff-since-last |
| J3 Perio / odontogram | **Partial** | Perio not implemented; missing-tooth bypass |
| J4 Full revenue chain | **Broken** | P0-001 (UI treatment status-drop) |
| J5 Status model | **Partial** | Prior-visit "Existing" category missing (J5-001/2) |
| J6 Multi-visit phasing | **Partial** | No phase/sequence model; carry-over manual |
| J7 Granularity / dentition | **Partial** | Mixed dentition not supported; backend no primary validation |
| J8 Clinical dependencies | **Not built** | Zero dependency rules |
| J9 Plan versioning | **Broken** | No plan-version table (Gap #6) |
| J10 Void/amend/audit | **Partial** | Amendment UI not wired; SOAP notes no lock |

### P0 findings (3 confirmed)

- **P0-001**: UI treatment-status drop + Mark-Done 422 → revenue chain dead end-to-end
- **P0-003**: Completion gate advisory; informed consent never server-enforced (C1)
- **P0-004**: All clinical notes (tooth slideout + treatment table) local-only React state; `dental_treatment` has no `clinical_notes` column; notes lost on navigation (§4.4 malpractice documentation)

**40-question coverage:** 8 full ✓ / 19 partial / 13 ✗ not built

Confirmed P0s: **P0-001**, **P0-003**, **P0-004**. Full ranked list at §Ranked findings.

---

## Step 1 — Triage gate results

### P0-001 — Core revenue path dead through the UI (CONFIRMED)

**Dimension:** journey completeness + state-machine correctness. **Journey:** J4.
**Severity:** P0 (deployment-blocking; reference Gap-adjacent, Q17/Q18 family).
**Reclassification:** the backend API is *sound in isolation*; the defect is the
**UI integration**. Not a handler bug.

Root-cause chain (each link verified):
1. `status` is **not an accepted input** on the create-treatment contract —
   `specs/api/src/modules/dental-visit.tsp` `CreateDentalTreatmentRequest` (≈L146-155)
   has no `status`; generated `CreateDentalTreatmentRequestSchema`
   (`services/api-ts/src/generated/openapi/validators.ts` ≈L755-764) strips it.
   `services/api-ts/src/handlers/dental-visit/createDentalTreatment.ts:58-68` builds
   `repo.createOne({...})` with no `status` → Drizzle default `'diagnosed'`
   (`repos/treatment.schema.ts:30`).
2. Client `apps/dentalemon/src/features/workspace/hooks/use-save-treatment.ts:22`
   declares & sends `status:'planned'` — silently discarded in transit.
3. The only "Mark Done" affordance,
   `apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts:26`,
   issues a **single** `PATCH {status:'performed'}` on a `diagnosed` treatment.
4. `TREATMENT_TRANSITIONS` (`repos/treatment.schema.ts:64`) only allows
   `diagnosed→planned→performed`; the single-step PATCH is rejected **422**.
5. No UI anywhere promotes `diagnosed→planned` (Treatment Plan tab is display-only;
   confirmed in earlier inventory). Therefore no treatment ever reaches `performed`,
   and `createDentalInvoice.ts` ("only performed/verified billable", ≈L33-38) can
   never produce an invoice from the UI flow.

**Reproducing artifact:**
`services/api-ts/src/handlers/dental-visit/AUDIT-P0-001-ui-revenue-path.test.ts`
— 3 tests, all green, proving: (a) create-time status discarded → `diagnosed`;
(b) single-step Mark-Done → 422; (c) two-step API path works (no UI drives it).

**Recommended fix (for fix plan):** either make Mark-Done perform both transitions
(`diagnosed→planned` then `→performed`), or add a UI affordance to promote to
`planned`, or accept `status` at create for the diagnosed/planned case. Decision
deferred to fix-plan section.

### P0-002 (folded into P0-001) — Billing dead-end (REFUTED as independent)

`createDentalInvoice.ts` correctly gates billing on `performed`/`verified`
(reference B1 — this is *correct* behavior, not a defect). The "dead-end" is purely
a symptom of P0-001 (nothing reaches `performed` via UI). Not a separate finding;
tracked under P0-001. Backend billing gate is sound.

### P0-003 — Informed consent never server-enforced; completion gate advisory-only (CONFIRMED)

**Dimension:** business-rule integrity + compliance. **Journey:** J4 / completion.
**Severity:** P0 (reference C1, Gap #11, Q19 — clinical-legal liability).

- `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx`
  (≈L222-230) renders a **"Complete anyway"** button when checks fail
  (`hasWarns`), calling `updateDentalVisit({status:'completed'})` with zero gating.
  Bypasses all 4 client checks (consent signed, no incomplete tx, SOAP notes, open
  lab orders).
- Backend does **not** re-enforce:
  `services/api-ts/src/handlers/dental-visit/updateDentalVisit.ts` (≈L34-90)
  enforces only `VISIT_TRANSITIONS` + lock immutability — no consent/lab/note/tx
  precondition on `→completed`.
- No consent gate on treatment delivery at all: `grep -ri consent` across
  `dental-visit/` and `dental-billing/` = 0 hits. Consent
  (`dental-clinical/createConsentForm.ts`, `signConsentForm.ts`) is standalone CRUD
  never referenced by the visit/treatment/invoice flow. Informed consent is
  advisory, client-side, bypassable, never server-enforced.

**Reproducing artifact:** to be added (Hurl: complete a visit with unsigned consent
→ expect 200, demonstrating no gate) — tracked in fix-plan/specs task.

### Baseline-coverage proof (why "suite is green" is untrustworthy here)

- `specs/api/tests/contract/dental-billing.hurl:142-186` **hand-drives the two-step
  transition** (PATCH→`planned` ×2, then PATCH→`performed` ×2) before billing. The
  contract suite passes green precisely because the test does what the UI never
  does. This single fact masks P0-001 from the entire contract gate.
- `dental-visit/dental-treatment.test.ts` "returns 201 … on valid input" (≈L197-221)
  asserts `body.status==='diagnosed'` but **never sends `status`** — does not cover
  the client-status drop. No create-with-status test existed before this audit.
- `dental-billing/dental-billing.test.ts` invoice happy-path seeds via
  `treatmentRepo.createOne({status:'performed'})` **directly through the repo**,
  bypassing the create handler + transition machine — would never catch P0-001.
- No handler/Hurl test asserts `visit→completed` is blocked by missing consent;
  `clinical-consent-lab.test.ts` tests consent CRUD in isolation, not enforcement.
- **Conclusion:** none of the currently-passing suites would have caught P0-001 or
  P0-003.

### Gate decision

P0-001 confirmed → the UI cannot organically produce `planned`/`performed`/billable
state. Therefore **J4/J5/J6/J8/J9/J10 live walks require the DB-seed fixture
fallback** (Task #3). Downstream journey items that depend on post-`diagnosed`
state are flagged **blocked-by-P0-001** and scored on trace + fixture-fallback walk,
never silently passed.

---

## Pre-resolved architectural findings

These are single cross-cutting findings stated up front; they are not re-emitted
as per-journey noise.

---

### ARCH-001 — Role-agnostic guards on clinical write operations (P1)

**Dimension:** access control / record integrity. **Reference:** Q1–Q5, Gap #13.
**Severity:** P1 (licensed-provider ops performable by any active staff member).

Four member roles: `dentist_owner`, `dentist_associate`, `staff_full`,
`staff_scheduling` (`membership.schema.ts:10-15`).

Clinical write handlers split into two guard tiers — **inconsistently**:

| Handler | Guard used | Roles allowed |
|---------|-----------|---------------|
| `createDentalTreatment.ts:33` | `assertBranchRole` | dentist_owner, dentist_associate |
| `createDentalVisit.ts:25` | `assertBranchAccess` | **any active member** |
| `updateDentalTreatment.ts:36` | `assertBranchAccess` | **any active member** |
| `upsertDentalChart.ts:32` | `assertBranchAccess` | **any active member** |
| `upsertVisitNotes.ts:33` | `assertBranchAccess` | **any active member** |
| `createDentalVisit.ts:25` | `assertBranchAccess` | **any active member** |
| `updateDentalVisit.ts:32` | `assertBranchRole` | dentist_owner, dentist_associate |
| `createPrescription.ts:33` | `assertBranchRole` | dentist_owner, dentist_associate |
| `issueDentalInvoice.ts:28` | `assertBranchRole` | dentist_owner, dentist_associate |
| `voidDentalInvoice.ts:29` | `assertBranchRole` | dentist_owner only |

`assertBranchAccess` (`handlers/shared/assert-branch-access.ts:15-33`) checks only
active membership — **no role gate**. A `staff_scheduling` member can update
treatments, overwrite the dental chart, and author SOAP notes.

No hygienist / dental-assistant / front-office clinical role. The schema has
`staff_full` and `staff_scheduling` but no mechanism to restrict them from clinical
record writes that should require a licensed provider.

`dentistMemberId` on `dental_visit` captures the assigned provider, but there is no
enforcement that only that member (or another dentist) may modify the visit's
clinical records.

**No reproducing artifact needed** — the inconsistency is directly readable from the
handler imports. An integration test asserting `staff_scheduling` is rejected on
`updateDentalTreatment` would fail (it would return 200).

**Recommended fix:** Promote `updateDentalTreatment`, `upsertDentalChart`,
`upsertVisitNotes`, `createDentalVisit` to `assertBranchRole(['dentist_owner',
'dentist_associate'])`. Alternatively, define an explicit "clinical staff" role if
hygienists/assistants need chart write access.

---

### ARCH-002 — No diagnosis entity; status-collapse is deliberate (P1)

**Dimension:** clinical data model. **Reference:** Gap #1, Q6–Q8.
**Severity:** P1 (limits interoperability + clinical traceability; no immediate
operational block).

There is no diagnosis table, diagnosis handler, or diagnosis endpoint. The string
`'diagnosed'` is `dentalTreatmentStatusEnum[0]` and the schema default for every
new treatment (`treatment.schema.ts:30`). The act of creating a treatment IS the
diagnosis act.

Consequences:
- No ICD-10/SNODENT diagnosis codes — only CDT procedure codes on treatments.
- No chief-complaint → specific-diagnosis linkage beyond free-text
  `chiefComplaint` on `dental_visit`.
- No multi-diagnosis-per-tooth model; diagnosis and planned procedure are the same
  entity at `status='diagnosed'`.
- Treatment-plan "versioning" is not storable — `getTreatmentPlan.ts` synthesizes
  plans at request time from current status values; no snapshot table exists.
  (Reference Gap #6 — see also J9 finding.)
- HL7/FHIR export (future) would require diagnosis codes not currently captured.

This appears deliberate for a solo/small-practice PMS. The reference flags it as
Gap #1. Severity is P1 rather than P0 because the current status-collapse is
internally consistent (the revenue chain works once P0-001 is fixed); it is a
clinical completeness gap, not a broken-operation blocker.

**No code artifact needed** — confirmed by absence of any `diagnosis` table in
`services/api-ts/src/handlers/dental-visit/repos/` and zero `diagnosis` handler
files in `dental-visit/` or `dental-clinical/`.

---

### ARCH-003 — All treatment-row and tooth-slideout clinical notes are lost on navigation (P0)

**Dimension:** record integrity / malpractice documentation. **Reference:** §4.4,
Gap #9. **Severity:** P0 — clinical notes written during a visit are silently
discarded when the user navigates away.

Two UI note-entry surfaces both use local-only state with no persistence path:

1. **Tooth slideout** (`components/tooth-slideout.tsx:34-67`):
   The `clinicalNotes` field is `useState('')`; the source comment reads:
   > "Captured in UI but not persisted to backend. Deferred: dental_treatment
   > schema has no notes column."
   It renders in the overview panel (`line 364-367`) during the session, then
   is gone on unmount.

2. **Treatment-table row notes** (`components/treatment-table.tsx:79-80`):
   `localNotes: Record<string, string>` — component-local state; no API call on
   change or blur; comment `TXTBL-04: notes sub-row — local-only expand/collapse`
   is explicit.

The `dental_treatment` table has no `clinical_notes` (or equivalent) column;
the `visit_notes` table (SOAP notes) persists visit-level notes but has no
signed/locked/status column (no cosignature workflow — reference C2 finding).

A dentist documenting "apply topical anesthetic, patient tolerated well" or
"noted buccal furcation involvement" loses those notes on page navigation.
This is a malpractice-documentation defect (reference §4.4, ADA R7b).

**Reproducing artifact:** open any workspace visit, type notes in the tooth
slideout or treatment row, navigate to another tab, return — notes are gone.
No server-side assertion needed; the client code proves it.

**Recommended fix:**
- Add `clinicalNotes text` column to `dental_treatment` via TypeSpec +
  migration.
- Wire `tooth-slideout`'s `clinicalNotes` + treatment-table's `localNotes`
  to `PATCH /dental/visits/:visitId/treatments/:treatmentId`.
- Add `signedAt`, `signedBy` columns to `visit_notes` if cosignature/locking
  is required (C2 fix, separate from this P0).

---

## Per-journey verdicts

---

### J1 — New-patient comprehensive exam (D0150) + chart existing — **PARTIAL**

**Blocked by:** none. **Method:** trace.

**Passing steps:**
- Patient creation with demographics (firstName, lastName, DOB, gender) — `createDentalPatient.ts`
- Visit creation (draft) + activation → active, chief complaint captured on visit — `createDentalVisit.ts`, `updateDentalVisit.ts`
- Odontogram with all 9 ADA tooth states (healthy/caries/fractured/filled/crown/missing/implant/extracted/watchlist) — `dental-chart.schema.ts:12-22`
- Treatment recording with free-text CDT code; D0150 accepted — `createDentalTreatment.ts`
- SOAP notes persisted — `upsertVisitNotes.ts`
- Medical history capture (condition/medication/allergy/procedure) linked to patient — `createMedicalHistoryEntry.ts`
- Dentition type (permanent/primary/mixed) computed from DOB in `initializeDentition.ts`
- Audit trail on all entities (createdBy/updatedBy/createdAt/updatedAt) — `baseEntityFields`

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J1-001 | P1 | Medical history not enforced as precondition to visit creation or completion; entirely optional | No enforcement in `createDentalVisit` or `updateDentalVisit` |
| J1-002 | P2 | Consent form not auto-created on visit start; must be manually created, no template pre-population | `createConsentForm.ts` — standalone; no hook from `createDentalVisit` |
| J1-003 | P2 | Dentition type computed from DOB but NOT stored on patient record — re-derived each time | `initializeDentition.ts:83-103`; `patient.schema.ts` has no dentitionType column |
| J1-004 | P2 | Medical history entries linked to patient only, not per-visit — no snapshot of allergies/meds at time of exam | `medical-history.schema.ts:22` — `patientId` FK only, no `visitId` |

**Reference questions:**
- Q1: All demographics captured ✓ (firstName, lastName, DOB, gender)
- Q2: Chief complaint per-visit ✓ (`visit.schema.ts:29`)
- Q3: CDT free-text, D0150 accepted ✓; no validation against ADA list ✗
- Q4: All 9 ADA tooth states ✓ (`dental-chart.schema.ts:12-22`)
- Q5: Dentition derived from DOB ✓; not stored on patient ✗
- Q9: Medical history captured ✓; not enforced in J1 workflow ✗

---

### J2 — Periodic exam / recall (D0120) + diff-since-last — **BROKEN**

**Blocked by:** P0-004 (carry-over never called from UI). **Method:** trace.

**Passing steps:**
- Patient lookup and visit history — `listDentalVisits.ts`, timeline carousel
- Prior chart readable via `getDentalChart(visitId)` from timeline
- Per-tooth history across completed visits — `getToothHistory.ts`
- `carryOverTreatments` handler exists with full logic including restore-dismissed support

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J2-001 | **P0** | `carryOverTreatments` backend handler is NEVER called from the frontend — no hook, no UI button, zero integration | No reference to `carryOverTreatments` anywhere in `apps/dentalemon/` |
| J2-002 | **P0** | "Diff since last visit" not built — no side-by-side chart comparison, no delta overlay | No diff component; timeline shows prior charts read-only with no delta calculation |
| J2-003 | P1 | `getToothHistory` filters only `status='completed'|'locked'` visits — active/in-progress visits excluded from history | `getToothHistory.ts:42` |
| J2-004 | P1 | Prior SOAP notes not accessible during recall — no UI to reference prior visit's subjective/objective during new exam | No `getPriorVisitNotes` surfaced in recall flow |
| J2-005 | P2 | Treatment-table "carried-over" badge and row styling exist in UI but are never populated (carry-over never triggered) | `treatment-table.tsx:350-400` — aspirational styling |
| J2-006 | P2 | `carryOverTreatments.restoreDismissedIds` param supported but inaccessible (UI never calls the endpoint) | `carryOverTreatments.ts:103-130` |

**Reference questions:**
- Q10: Prior chart viewable (timeline carousel) ✓; diff overlay ✗
- Q11: Carry-over exists in backend ✓; NOT wired in UI ✗ (P0-004)
- Q12: Diff-since-last-visit NOT visible ✗

---

### J3 — Perio charting ↔ odontogram integrity (missing-tooth lockout, I2) — **PARTIAL**

**Method:** trace.

**Passing steps:**
- Extracted-tooth lockout enforced server-side: `createDentalTreatment.ts:43-56` checks `state==='extracted'` and throws 422 (`TOOTH_EXTRACTED`) ✓
- Auto-dismiss: `updateTooth` triggers `treatment.repo.autoDismissByTooth` — all open treatments on the tooth get dismissed with reason "Tooth extracted" ✓
- Per-tooth history via `getToothHistory.ts` across completed/locked visits ✓
- Individual tooth updates (not full-chart replacement) via `updateTooth.ts` + `dental-chart.repo.ts:65-95` ✓
- All 9 tooth states in schema, legend rendered in `dental-chart.tsx:102-130` ✓

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J3-001 | P2 | `'missing'` tooth state NOT blocked from new treatments — only `'extracted'` is checked | `createDentalTreatment.ts:49` — `state === 'extracted'` only |
| J3-002 | P1 | UI does not prevent opening tooth-slideout for extracted teeth; `readOnly` mode exists but no pre-open guard | `tooth-slideout.tsx` — no extracted-state guard |
| J3-003 | P2 | Perio measurements defined in OpenAPI (`HealthcareAncillaryPeriodontalPerioSiteSchema` in `validators.ts`) but no backend repo, schema, or handler — perio charting not implemented | No perio handler or schema file in `dental-visit/` or `dental-clinical/` |
| J3-004 | P2 | Chart initialization sets all teeth healthy — no prior-history restoration on new chart creation | `initializeDentalChart` rebuilds from scratch; prior states not imported |

**Reference questions:**
- Q13: Missing-tooth lockout server-side for `extracted` ✓; `missing` state bypass ✗ (J3-001)
- Q14: Perio measurements defined in spec but NOT implemented ✗ (J3-003)
- Q15: Tooth state changes propagate correctly across system ✓ (auto-dismiss, history)

---

### J5 — Existing/Existing-Other/Planned/Completed status model + legend — **PARTIAL**

**Blocked by:** P0-001 (treatments cannot organically reach 'performed'/'verified' via UI). **Method:** trace + fixture-fallback.

**Passing steps:**
- 5-state lifecycle enforced with valid transitions — `treatment.schema.ts:64`
- Status badge with colors (diagnosed=amber, planned=blue, performed=green, verified=teal, dismissed=gray) — `treatment-table.tsx:43-62`
- `carryOverTreatments` copies pending treatments from prior visit, flagged `carriedOver=true` ✓ (backend only — not triggered in UI, J2-001)
- Visit immutability: treatments cannot be added to completed/locked visits — `createDentalTreatment.ts:35-40`
- `getTreatmentPlan` aggregates pending treatments across visits

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J5-001 | P1 | "Existing" (prior-visit verified) treatments NOT shown in current-visit workspace; dentist must navigate away | `listDentalTreatments.ts:30` — returns current visitId only |
| J5-002 | P1 | "Existing-Other" (tooth restorations from chart state, e.g., crown, implant) not surfaced as ledger items | No handler maps chart tooth state → treatment record; restorations are chart-only |
| J5-003 | P1 | Odontogram ↔ treatment ledger consistency not enforced — chart state can diverge from treatment records (e.g., tooth marked 'crown' with active caries treatment) | No reconciliation step; `updateTooth` and `updateDentalTreatment` are independent |
| J5-004 | P2 | `getTreatmentPlan` queries all visits without temporal filtering — pending treatments from any prior visit mixed without date context | `getTreatmentPlan.ts:36` — no `visitId` or date filter |
| J5-005 | P2 | `TreatmentPlanTab` shows only diagnosed/planned; completed current-visit treatments hidden behind toggle | `treatment-plan-tab.tsx:152-153` |

**Reference questions:**
- Q20: Planned vs existing display distinct ✓ (colors); prior-visit "Existing" category missing ✗
- Q21: Status legend present ✓ (`treatment-table.tsx:43-62`)
- Q22: Prior-visit completed treatments NOT visible in current workspace ✗ (J5-001)
- Q23: Chart state ↔ treatment record consistency not enforced ✗ (J5-003)
- Q25: Odontogram ↔ ledger agree on current visit ✓; prior-visit divergence not detected ✗

---

---

### J4 — Dx→plan→accept→deliver→complete→bill — **BROKEN (blocked by P0-001)**

**Method:** trace + fixture-fallback (organic UI walk impossible).

**Passing steps (backend, proven by `dental-billing.hurl:142-186`):**
- Treatment creation at 'diagnosed' ✓
- Two-step PATCH (diagnosed→planned then →performed) ✓ via direct API
- `updateDentalVisit` → 'completed' ✓ (transition enforced)
- `createDentalInvoice` gates on performed/verified ✓ (correct behavior)
- `issueDentalInvoice` → draft→issued ✓
- `recordDentalPayment` with overpayment guard ✓
- `createDentalPaymentPlan` with installment auto-generation ✓
- `applyDentalDiscount` percentage-based with tax recalc ✓

**Findings (new — P0-001 is already recorded):**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J4-001 | P1 | No formal "plan presented/patient accepted" state — `getTreatmentPlan` synthesizes pending treatments at request time; no snapshot, no acceptance timestamp | `getTreatmentPlan.ts:36` — live query, no versioning |
| J4-002 | P1 | Consent never enforced on treatment delivery — `updateDentalTreatment` enforces only `TREATMENT_TRANSITIONS`; no consent check on `→performed` | `updateDentalTreatment.ts:18-74` |

**Reference questions:**
- Q16: No formal "plan accepted" state ✗ (J4-001)
- Q17: diagnosed→planned via UI — NO ✗ (P0-001)
- Q18: Billing chain complete in isolation ✓ (invoice→issue→payment→receipt); unreachable from UI ✗ due to P0-001
- Q19: Consent required server-side before delivery — NO ✗ (P0-003)

---

### J6 — Multi-visit phased plans & sequencing — **PARTIAL**

**Method:** trace.

**Passing steps:**
- `carryOverTreatments.ts` copies pending (diagnosed/planned) treatments from prior visit; sets `carriedOver=true`, preserves `sourceVisitId` ✓
- Restore-dismissed param supported in handler ✓
- `getTreatmentPlan` aggregates ALL pending treatments across all visits ✓

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J6-001 | P1 | No phase/sequence/visitOrder field on treatments — multi-visit sequencing not formally modeled | `treatment.schema.ts:12-31` — no such column |
| J6-002 | P1 | No appointment↔treatment linking — no FK from treatment to appointment; no auto-scheduling from plan | No `appointmentId` on `dental_treatment` |
| J6-003 | P2 | `carryOverTreatments` must be manually triggered (POST endpoint); not auto-invoked on visit creation or completion | `carryOverTreatments.ts` — standalone endpoint; no hooks from visit lifecycle |
| J6-004 | P2 | `getTreatmentPlan` returns all pending without per-visit breakdown — dentist cannot see "visit 1 plan vs visit 2 plan" | `getTreatmentPlan.ts:36` — no `visitId` grouping or sequence label |

**Reference questions:**
- Q26: Sequencing across visits — partial (carry-over exists, no formal phase model) ✗
- Q27: Carry-over mechanism — backend ✓, not auto-triggered ✗ (J6-003)
- Q28: Whole-plan across visits — aggregated ✓, no visit-by-visit breakdown ✗

---

### J7 — Surface/tooth/quadrant granularity + dentition — **PARTIAL**

**Method:** trace.

**Passing steps:**
- `surfaces: string[]` captured on `dental_treatment` ✓
- Five-surface-selector correctly distinguishes anterior (incisal) vs posterior (occlusal) ✓
- FDI numbering: 11-48 permanent, 51-85 primary defined in `dental-chart.helpers.ts` ✓
- Odontogram renders 4 quadrants with upper/lower split ✓
- `toothNumber = null` accepted as "general" (arch-level workaround) ✓

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J7-001 | P1 | Primary dentition (51-85) defined in frontend helper but NOT validated or surfaced in backend — `dental_treatment.toothNumber` is an unvalidated integer | `dental-chart.helpers.ts` — `PEDIATRIC_TOOTH_NUMBERS`; no backend enforcement |
| J7-002 | P1 | Mixed dentition not supported — no `dentitionType` on patient; system cannot represent a child having both primary and permanent teeth simultaneously | `patient.schema.ts` — no dentitionType column |
| J7-003 | P2 | Arch/quadrant-level treatment not formally modeled — `toothNumber = null` is an implicit workaround, not a typed field | `getTreatmentPlan.ts` — `toothNumber ?? 'general'` string fallback |
| J7-004 | P2 | Surface names not validated at API (incisal on molar, occlusal on incisor accepted) — frontend-only constraint | `createDentalTreatment.ts` — surfaces passed through as-is |

**Reference questions:**
- Q29: Surfaces captured ✓; not API-validated ✗ (J7-004)
- Q30: Primary dentition — frontend defined ✓; backend not enforced ✗ (J7-001)
- Q31: Quadrant/arch-level — implicit workaround only ✗ (J7-003)
- Q32: FDI numbering consistent ✓

---

### J8 — Clinical dependency sequencing (warn/block) — **NOT BUILT**

**Method:** trace.

**Passing steps:**
- Extracted-tooth block ✓ (already enforced — `createDentalTreatment.ts:43-56`)

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J8-001 | P2 | No dependency schema — `dental_treatment` has no `dependsOn`, `prerequisiteId`, or `conflicts` field | `treatment.schema.ts:12-31` |
| J8-002 | P2 | No CDT-code dependency rules — no library or ruleset (e.g., build-up before crown, RCT before crown) | `createDentalTreatment.ts` — no CDT logic beyond extracted-tooth |
| J8-003 | P2 | No conflict detection on same-tooth treatments — crown + active-caries, extract + crown both silently accepted | `createDentalTreatment.ts:17-71` |
| J8-004 | P2 | No UI warning system for conflicting/sequencing violations | `treatment-table.tsx`, `treatment-plan-tab.tsx` — no warning component |

**Reference questions:**
- Q33: Clinical dependency rules enforced — NO ✗ (J8-001/2/3)
- Q34: Warning system for conflicts — NO ✗ (J8-004)

_Note: Severity is P2 (significant gap, not deployment-blocking). Licensed dentists are professionally responsible for sequencing; industry tools (Open Dental, Dentrix) warn but do not hard-block._

---

### J9 — Treatment-plan versioning & re-planning — **BROKEN**

**Method:** trace (confirmed trace-only; no plan-version table exists).

**Passing steps:**
- `getTreatmentPlan.ts` aggregates pending (diagnosed/planned) treatments by tooth ✓
- `dismissReason: text` stored on treatment record ✓
- `TREATMENT_TRANSITIONS` enforces forward-only status changes ✓

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J9-001 | P1 | No `treatment_plan_version` table — plan synthesized live at request time; prior versions unrecoverable | `getTreatmentPlan.ts:36` — live query only; no snapshot or version table in `handlers/dental-visit/repos/` |
| J9-002 | P1 | No "patient accepted" timestamp on plan — consent schema has `signedAt` (signature) but no `acceptedPlanVersionId` linking acceptance to a specific plan | `consent-form.schema.ts` — fields: `signedAt, signatureData, signed`; no plan-version FK |
| J9-003 | P2 | Plan revision not tracked — when treatments are swapped, no record of prior plan state | No plan snapshot on treatment dismissal or addition |

**Reference questions:**
- Q35: Prior plan versions retrievable — NO ✗ (J9-001)
- Q36: "Patient accepted" timestamp on plan — NO (consent signed but not linked to plan) ✗ (J9-002)
- Q37: Dismissed treatments with reasons tracked ✓ (`dismissReason`); but linked audit trail per plan change ✗

---

### J10 — Void/correct/amend + immutable audit trail — **PARTIAL**

**Method:** trace.

**Passing steps:**
- `createAmendment` handler exists — additive-only, no update/delete method on amendment repo ✓
- Audit log: `AuditRepository.logEvent()` insert-only with per-entry integrity hash ✓
- Visit lock: `updateDentalVisit` throws `VISIT_LOCKED`; `createDentalTreatment` blocked on completed/locked visits ✓
- Consent form: `signConsentForm` enforces single-write (`if (existing.signed) → ValidationError`) ✓
- PMD (`generatePMD`, `exportPMD`) exists for patient record export ✓

**Findings:**

| ID | Sev | Description | File:line |
|----|-----|-------------|-----------|
| J10-001 | P1 | Amendment UI not implemented — `createAmendment` backend exists but no frontend form wired; users cannot create amendments in practice | No amendment invocation in `apps/dentalemon/` workspace |
| J10-002 | P1 | Locked-visit amendment enforcement missing — `createAmendment.ts` checks branch access only; no `visit.status === 'locked'` guard — amendments can be added to locked visits (correct) but also to any visit without constraint | `createAmendment.ts` — only `assertBranchAccess` |
| J10-003 | P2 | Visit notes (SOAP) have no signed/locked status — `visit_notes` table has no `signedAt`, `lockedAt`, or `status` column; notes editable indefinitely | `treatment.schema.ts:42-57` (visitNotes table) |
| J10-004 | P2 | Audit integrity hash not cryptographically chained — each entry has its own hash; no inclusion of prior-entry hash (no chain-of-custody) | `audit.repo.ts` — per-entry `integrityData` hash only |
| J10-005 | P3 | Consent signature stored as plaintext `signatureData: text` — no cryptographic verification; tamper relies on audit logs alone | `consent-form.schema.ts` |

**Reference questions:**
- Q38: Errors in locked visit correctable via amendment (not deletion) — backend ✓; no UI ✗ (J10-001)
- Q39: Immutable audit trail — append-only ✓; not chain-hashed ✗ (J10-004)
- Q40: Consent signature tamper-evident — single-write enforced ✓; not cryptographically verifiable ✗ (J10-005)

## 40-question coverage matrix

Answers compiled from J1–J10 journey traces. References §6 of
`dental-workspace-audit-reference.md`.

| Q# | Question | Answer | Evidence / Finding |
|----|----------|--------|--------------------|
| Q1 | Can all required patient demographics be captured? | ✓ YES | `createDentalPatient.ts` — firstName, lastName, DOB, gender |
| Q2 | Is chief complaint stored per visit? | ✓ YES | `visit.schema.ts:29` — `chiefComplaint text` on dentalVisits |
| Q3 | Are CDT codes validated against ADA list? | ✗ NO | `treatment.schema.ts:27` — `cdtCode text` free-text, no enum validation |
| Q4 | Does the odontogram capture all ADA tooth states? | ✓ YES | `dental-chart.schema.ts:12-22` — 9 states: healthy/caries/fractured/filled/crown/missing/implant/extracted/watchlist |
| Q5 | Is dentition type stored per patient? | ✗ NO | Computed from DOB in `initializeDentition.ts`; no `dentitionType` column on `patient` |
| Q6 | Is there a separate diagnosis entity with codes? | ✗ NO | ARCH-002: 'diagnosed' is treatment status default; no ICD/SNODENT codes |
| Q7 | Is chief complaint→specific diagnosis traceability captured? | ✗ NO | Free-text only; no structured diagnosis-to-treatment linkage |
| Q8 | Is the diagnosis lifecycle formally separate from the treatment lifecycle? | ✗ NO | ARCH-002: single status-field collapse (Gap #1) |
| Q9 | Is medical history linked to visit (not just patient)? | ✗ NO | J1-004: `medical_history.patientId` only; no visit snapshot |
| Q10 | Can prior visit charts be viewed without starting a new visit? | ✓ YES | Timeline carousel reads prior `getDentalChart(visitId)` read-only |
| Q11 | Is there a carry-over mechanism for unresolved treatments? | ✗ PARTIAL | `carryOverTreatments.ts` exists in backend; J2-001: **never called from UI** |
| Q12 | Is a "diff since last visit" visible to the dentist? | ✗ NO | J2-002: Not built; no delta overlay |
| Q13 | Is missing/extracted-tooth lockout enforced server-side? | ✓ PARTIAL | Extracted ✓ (`createDentalTreatment.ts:43-56`); Missing state ✗ (J3-001) |
| Q14 | Are perio measurements (pocket depth, BOP) captured? | ✗ NO | J3-003: Defined in OpenAPI validators; no backend repo/handler |
| Q15 | Do tooth state changes propagate correctly (auto-dismiss)? | ✓ YES | `treatment.repo.autoDismissByTooth` fires on extraction |
| Q16 | Is there a formal "plan presented / patient accepted" state? | ✗ NO | J4-001: No `treatment_plan_version` or acceptance timestamp |
| Q17 | Can treatments be moved from diagnosed→planned via the UI? | ✗ NO | P0-001: `CreateDentalTreatmentBody` has no `status` field; no UI affordance |
| Q18 | Is the billing chain complete (invoice→issue→payment→receipt)? | ✓ PARTIAL | Handlers complete; unreachable from UI due to P0-001 |
| Q19 | Is consent required server-side before treatment delivery? | ✗ NO | P0-003: `updateDentalTreatment` enforces only transitions; no consent check |
| Q20 | Do existing and planned treatments display distinctly? | ✓ PARTIAL | Status badge colors ✓; "Existing (prior-visit)" category missing ✗ (J5-001) |
| Q21 | Is there a visual legend showing treatment status colors? | ✓ YES | `treatment-table.tsx:43-62` — 5-status color legend |
| Q22 | Can dentist see prior-visit completed treatments in current workspace? | ✗ NO | J5-001: `listDentalTreatments` returns current visitId only |
| Q23 | Is chart state consistent with treatment record status? | ✗ NOT ENFORCED | J5-003: No reconciliation; divergence possible |
| Q24 | Is treatment pricing tracked (fee schedule)? | ✓ YES | `priceCents` on `dental_treatment`; discount + payment plan handlers exist |
| Q25 | Does odontogram↔treatment ledger agree? | ✓ PARTIAL | Agree on current visit ✓; prior-visit divergence not detected ✗ |
| Q26 | Can treatments be sequenced across multiple visits? | ✗ PARTIAL | Carry-over exists (backend only); no formal phase/sequence field (J6-001) |
| Q27 | Is there a mechanism to carry unresolved treatments to next visit? | ✓ PARTIAL | Backend ✓; J2-001: UI never triggers it |
| Q28 | Can dentist see whole plan across all planned visits? | ✗ PARTIAL | `getTreatmentPlan` aggregates ✓; no visit-by-visit breakdown (J6-004) |
| Q29 | Are tooth surfaces (MO, DO, MOD) captured and validated? | ✓ PARTIAL | Surfaces captured as `string[]` ✓; no API validation (J7-004) |
| Q30 | Is primary dentition supported in the odontogram? | ✗ PARTIAL | FDI 51-85 in frontend helpers ✓; backend does not enforce/validate (J7-001) |
| Q31 | Can treatments be applied at quadrant or arch level? | ✗ PARTIAL | `toothNumber = null` workaround ✓; not formally typed (J7-003) |
| Q32 | Is the tooth numbering system consistent? | ✓ YES | FDI (11-48 / 51-85) throughout |
| Q33 | Are clinical dependency rules enforced (crown before build-up, RCT before crown)? | ✗ NO | J8-001/2/3: No dependency schema, no CDT ruleset, no conflict detection |
| Q34 | Is there a warning system for conflicting treatments? | ✗ NO | J8-004: No warning component anywhere in treatment UI |
| Q35 | Are prior versions of the treatment plan retrievable? | ✗ NO | J9-001: Live synthesis only; no `treatment_plan_version` table |
| Q36 | Is there a "patient accepted" timestamp on the plan? | ✗ NO | J9-002: Consent has `signedAt` but no plan-version FK |
| Q37 | Are dismissed treatments with reasons tracked? | ✓ PARTIAL | `dismissReason text` ✓; audit trail per treatment ✓; plan-level audit ✗ |
| Q38 | Can errors in locked visits be corrected via amendment? | ✓ PARTIAL | Backend ✓ (additive only); J10-001: no UI ✗; lock check absent ✗ |
| Q39 | Is there an immutable audit trail of all clinical record changes? | ✓ PARTIAL | Insert-only `AuditRepository` ✓; not chain-hashed ✗ (J10-004) |
| Q40 | Is the consent signature tamper-evident? | ✓ PARTIAL | Single-write enforced ✓; plaintext `signatureData`, no crypto ✗ (J10-005) |

**Coverage summary:** 8 full ✓ / 19 partial ✓ / 13 ✗ (not built or not enforced)

---

## Ranked findings (P0→P3)

### P0 — Deployment-blocking

| ID | Journey | Dimension | Description | Artifact |
|----|---------|-----------|-------------|---------|
| **P0-001** | J4 | UI integration / state machine | Core revenue path dead: `CreateDentalTreatmentBody` omits `status`; treatments always created at 'diagnosed'; single-step Mark-Done PATCH (diagnosed→performed) rejected 422 by `TREATMENT_TRANSITIONS`; no UI promotes diagnosed→planned | `AUDIT-P0-001-ui-revenue-path.test.ts` (3 tests, green) |
| **P0-003** | J4/Completion | Business-rule integrity / compliance (C1) | Consent never server-enforced on treatment delivery or visit completion; `pre-completion-checklist.tsx` "Complete anyway" button bypasses all 4 checks; `updateDentalVisit.ts` enforces only `VISIT_TRANSITIONS` | Code trace (grep across dental-visit/dental-billing → 0 consent refs) |
| **P0-004** | J1/J4 | Record integrity / malpractice (§4.4, ADA R7b) | All clinical note entry points (tooth-slideout `clinicalNotes`, treatment-table `localNotes`) are local-only React state; `dental_treatment` has no `clinical_notes` column; notes lost on navigation | `tooth-slideout.tsx:34-67` comment + `treatment-table.tsx:79-80` |

### P1 — Critical quality gap

| ID | Journey | Dimension | Description | Evidence |
|----|---------|-----------|-------------|---------|
| **ARCH-001** | All | Access control (Q1–Q5, Gap #13) | `updateDentalTreatment`, `upsertDentalChart`, `upsertVisitNotes`, `createDentalVisit` use `assertBranchAccess` — any active staff member can modify clinical records | `assert-branch-access.ts` vs `assert-branch-role.ts` |
| **J2-001** | J2 | Journey completeness (Q11) | `carryOverTreatments` backend handler never called from frontend; no hook, no button; recall/periodic-exam treatment continuity broken | Zero references to `carryOverTreatments` in `apps/dentalemon/` |
| **J4-001** | J4 | Business-rule integrity (Q16) | No formal treatment plan acceptance/presentation state; `getTreatmentPlan` synthesizes live; no "patient accepted on date X" record | `getTreatmentPlan.ts:36` — live query, no snapshot |
| **J5-001** | J5 | Clinical data model (Q22) | Prior-visit completed (verified) treatments not visible in current-visit workspace; dentist must navigate away | `listDentalTreatments.ts:30` — current visitId filter only |
| **J5-002** | J5 | Clinical data model (Q20) | Existing restorations (tooth chart state: filled/crown/implant) not surfaced as ledger items; chart-only with no treatment record | No handler maps chart-state → treatment-record |
| **J5-003** | J5 | Data integrity (Q23/Q25) | Odontogram ↔ treatment ledger consistency not enforced; `updateTooth` and `updateDentalTreatment` are independent — divergence silently accepted | No reconciliation step or validation |
| **J6-001** | J6 | Journey completeness (Q26) | No phase/sequence field on treatments; multi-visit phased planning not formally modeled | `treatment.schema.ts:12-31` — no phase column |
| **J9-001** | J9 | Record integrity (Q35, Gap #6) | No `treatment_plan_version` table; plan synthesized live at request time; prior versions unrecoverable | `getTreatmentPlan.ts:36` — no version table in repos/ |
| **J9-002** | J9 | Compliance (Q36) | No "patient accepted" timestamp linked to a plan version; consent `signedAt` exists but not bound to a specific plan state | `consent-form.schema.ts` — no `acceptedPlanVersionId` |
| **J10-001** | J10 | Record integrity (Q38) | Amendment UI not wired; `createAmendment` backend exists but no frontend form — corrections are user-inaccessible | Zero amendment invocation in `apps/dentalemon/` workspace |
| **J10-003** | J10 | Record integrity (C2, Q38) | Visit notes (SOAP) have no signed/locked/status column; editable indefinitely after completion | `visitNotes` table — no `signedAt`, `lockedAt`, `status` |

### P2 — Significant gap

| ID | Journey | Description | Evidence |
|----|---------|-------------|---------|
| ARCH-002 | All | No diagnosis entity; status-collapse (Gap #1) limits ICD/SNODENT codes and interoperability | `treatment.schema.ts:30` — `status default 'diagnosed'` |
| J1-004 | J1 | Medical history patient-scoped only — no per-visit snapshot (allergies may change) | `medical-history.schema.ts:22` — `patientId` FK only |
| J2-002 | J2 | "Diff since last visit" not built — no delta overlay for recall | Timeline carousel, no diff component |
| J2-004 | J2 | Prior SOAP notes not accessible during recall exam | No prior-visit notes surfaced in new exam UI |
| J3-001 | J3 | `'missing'` tooth state not blocked from new treatments (only `'extracted'` is) | `createDentalTreatment.ts:49` |
| J3-003 | J3 | Perio measurements defined in OpenAPI validators but not implemented in backend | No perio handler/schema in dental-visit/ or dental-clinical/ |
| J6-002 | J6 | No appointment↔treatment linking | No `appointmentId` on `dental_treatment` |
| J6-003 | J6 | carryOverTreatments must be manually triggered, not auto-invoked | Standalone POST endpoint; no visit lifecycle hook |
| J7-001 | J7 | Primary dentition (FDI 51-85) not enforced in backend; `toothNumber` is unvalidated integer | `dental-chart.helpers.ts` — frontend only |
| J7-002 | J7 | Mixed dentition not supported — no `dentitionType` on patient | `patient.schema.ts` — no column |
| J7-003 | J7 | Arch/quadrant-level treatment not formally typed | `getTreatmentPlan.ts` — `toothNumber ?? 'general'` workaround |
| J8-001..4 | J8 | Clinical dependency sequencing entirely absent — no dependency schema, no CDT rules, no conflict detection, no UI warnings | `treatment.schema.ts`, `createDentalTreatment.ts`, `treatment-table.tsx` |
| J9-003 | J9 | Plan revision not tracked — dismissed/added treatments leave no plan snapshot | No snapshot on treatment mutation |
| J10-002 | J10 | Locked-visit amendment enforcement absent — `createAmendment.ts` has no lock-state check | `createAmendment.ts` — only `assertBranchAccess` |
| J10-004 | J10 | Audit integrity hash not chain-linked — tamper detection per-entry only | `audit.repo.ts` — per-entry hash, no previous-entry inclusion |

### P3 — Minor gap

| ID | Journey | Description |
|----|---------|-------------|
| J1-001 | J1 | Medical history not enforced as visit precondition |
| J1-002 | J1 | Consent form not auto-created on visit start; no template pre-population |
| J1-003 | J1 | Dentition type not stored on patient record (re-derived from DOB each time) |
| J2-003 | J2 | `getToothHistory` excludes active (non-completed) visits from history |
| J2-005 | J2 | `carryOverTreatments.restoreDismissedIds` param exists but is UI-inaccessible |
| J3-002 | J3 | Tooth slideout opens for extracted teeth — no UI guard (only server-side block) |
| J3-004 | J3 | Chart initialization does not restore prior tooth states from history |
| J5-004 | J5 | `getTreatmentPlan` no temporal filtering — pending treatments from any prior visit mixed |
| J6-004 | J6 | No per-visit breakdown in treatment plan view |
| J7-004 | J7 | Surface names not API-validated (incisal on molar, occlusal on incisor silently accepted) |
| J10-005 | J10 | Consent signature stored as plaintext `signatureData` — no cryptographic verification |

## Prioritized fix plan

**For user approval before any code changes are executed.**

Dependency order: P0-001 unblocks P0-003 gate enforcement testing, and unblocks J2
carry-over validation (you need treatments at performed to test the full chain). Fix
P0-001 first.

---

### FIX-01 — P0-001: Add UI path for diagnosed→planned (unblocks entire revenue chain)

**Priority:** P0. **Effort:** S (1-2 days frontend + 2 tests).
**Blocks:** FIX-03, FIX-04, FIX-07.

Three viable options (choose one):

**Option A (recommended) — Two-step Mark-Done:**
Make `use-mark-treatment-done.ts` issue two sequential PATCHes:
1. `PATCH {status:'planned'}` (diagnosed→planned)
2. `PATCH {status:'performed'}` (planned→performed)

Files: `apps/dentalemon/src/features/workspace/hooks/use-mark-treatment-done.ts:26`

**Option B — Add "Move to Plan" button:**
Add a discrete "Add to Plan" UI step in the treatment table / tooth slideout that
issues `PATCH {status:'planned'}` only. Mark-Done then operates on planned→performed
(single step, valid).

**Option C — Accept `status` at create time:**
Update TypeSpec `CreateDentalTreatmentRequest` to include an optional `status` field
accepting `'diagnosed'|'planned'`. Regenerate validators.

Files: `specs/api/src/modules/dental-visit.tsp` ≈L146-155;
regenerate `services/api-ts/src/generated/openapi/validators.ts`;
update `createDentalTreatment.ts:58-68` to pass `status` through.

**Tests to add:**
- `AUDIT-P0-001-ui-revenue-path.test.ts` test 2 already acts as regression (Mark-Done
  422 → after fix, expect 200 two-step)
- Add Playwright spec: `apps/dentalemon/tests/e2e/audit/p0-001-revenue-chain.spec.ts`
  — add treatment → mark done → invoice visible

---

### FIX-02 — P0-004: Persist clinical notes (tooth slideout + treatment-table row)

**Priority:** P0. **Effort:** M (2-3 days: TypeSpec → migration → handler → UI wiring).
**Depends on:** none.

1. Add `clinicalNotes text` to TypeSpec `CreateDentalTreatmentRequest` and
   `UpdateDentalTreatmentRequest` in `dental-visit.tsp`.
2. Regenerate validators; add column to `dentalTreatments` schema:
   `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts`
3. Generate and apply migration: `bun run db:generate && bun run db:migrate`
4. Wire `clinicalNotes` from `tooth-slideout.tsx:67` + `localNotes` from
   `treatment-table.tsx:80` to `PATCH /dental/visits/:visitId/treatments/:treatmentId`
   via `use-update-treatment.ts`.
5. Populate `clinicalNotes` on load from `listDentalTreatments` response.

**Tests to add:**
- Unit: `PATCH treatment with clinicalNotes` → persisted and returned
- E2E: type notes in slideout → navigate away → return → notes present

---

### FIX-03 — P0-003: Server-side completion gate + consent enforcement

**Priority:** P0 (C1 / Gap #11). **Effort:** M (2 days backend + 2 days frontend).
**Depends on:** FIX-01 (treatment progression needed to test gate correctly).

1. **Backend:** Add precondition checks to `updateDentalVisit.ts` before allowing
   `→completed`:
   - No treatments in `diagnosed` or `planned` status for this visit
   - At least one signed consent form for this patient (via `signConsentForm.ts`)
   - A visit note exists (`visitNotes` row for this visit)
   Throw `ValidationError` with specific code if any check fails.

2. **Frontend:** Remove the "Complete anyway" button from
   `apps/dentalemon/src/features/workspace/components/pre-completion-checklist.tsx:222-230`
   (or gate it behind `dentist_owner` only with explicit override reason captured).

3. **Optional consent enforcement on treatment delivery:** Add consent check in
   `updateDentalTreatment.ts` before allowing `→performed` — check that a signed
   consent form exists for this patient/visit.

**Tests to add:**
- Hurl: `POST /dental/visits/:id` body `{status:'completed'}` with no consent →
  expect 422
- Unit: `updateDentalVisit` pre-condition matrix (consent/notes/tx checks)

---

### FIX-04 — J2-001: Wire carryOverTreatments in UI (recall exam flow)

**Priority:** P1. **Effort:** S (1 day frontend).
**Depends on:** FIX-01 (treatments need to be in performed/verified before a visit
completes, making carry-over meaningful).

1. Add a "Carry over pending treatments" action button in the visit header or
   empty-state of the treatment table when a prior visit has pending treatments.
2. Wire to `POST /dental/visits/:visitId/carry-over` via a new `useCarryOverTreatments`
   hook using the SDK.
3. Show carried-over treatments with the `carriedOver` flag visual (already styled in
   `treatment-table.tsx:350-400`).

**Tests to add:**
- Unit: POST carry-over → treatments duplicated with `carriedOver:true`
- E2E: complete visit with pending treatment → new visit → carry-over button → treatment appears

---

### FIX-05 — ARCH-001: Promote clinical write guards to assertBranchRole

**Priority:** P1. **Effort:** S (1 day backend).
**Depends on:** none.

Update these handlers to use `assertBranchRole(db, user.id, branchId, ['dentist_owner', 'dentist_associate'])`:
- `services/api-ts/src/handlers/dental-visit/updateDentalTreatment.ts:36`
- `services/api-ts/src/handlers/dental-visit/upsertDentalChart.ts:32`
- `services/api-ts/src/handlers/dental-visit/upsertVisitNotes.ts:33`
- `services/api-ts/src/handlers/dental-visit/createDentalVisit.ts:25`

(Consider whether `staff_full` should have read-only chart access — if so, add a
`staff_full` role to the allowed list only for chart reading, not writing.)

**Tests to add:**
- Unit: `staff_scheduling` role → `updateDentalTreatment` → expect 403

---

### FIX-06 — J10-001: Wire amendment UI

**Priority:** P1. **Effort:** M (2-3 days frontend).
**Depends on:** none.

1. The `amendment-form.tsx` component exists — verify it calls `POST /dental/visits/:visitId/amendments`.
2. Surface the amendment form from the visit header (or completed visit card) via a
   "Correct Record" button.
3. Show amendment history in the visit timeline via `listAmendments` endpoint.

**Tests to add:**
- E2E: complete a visit → open "Correct Record" → submit amendment → amendment appears in history

---

### FIX-07 — J4-001: Add treatment plan acceptance state

**Priority:** P1. **Effort:** M-L (3-5 days: TypeSpec + handler + UI).
**Depends on:** FIX-01 (need treatments at 'planned' before presenting a plan).

1. Add a `treatment_plan_version` table with `patientId, visitId, snapshotData jsonb,
   presentedAt, acceptedAt, acceptedBy, signatureData` fields.
2. Add `POST /dental/patients/:patientId/treatment-plan/accept` handler that snapshots
   current pending treatments + records `acceptedAt`.
3. Add "Patient accepts plan" button in `treatment-plan-tab.tsx`.
4. Link `createConsentForm` to the accepted plan version.

---

### FIX-08 — J5-001/J5-002: Show prior-visit and existing-restoration records

**Priority:** P1. **Effort:** M (2-3 days frontend + 1 day backend).
**Depends on:** FIX-01.

1. Modify `listDentalTreatments` (or add a new endpoint) to optionally return
   prior-visit verified treatments alongside current-visit treatments.
2. Add "Existing (Prior)" section to `treatment-table.tsx` showing verified treatments
   from completed visits with tooth reference.
3. Add "Existing Restorations" section derived from current chart tooth states (filled/
   crown/implant) as read-only ledger rows — not stored as treatment records, but
   synthesized client-side from the chart.

---

### FIX-09 — J10-003: Add SOAP note signed/locked lifecycle

**Priority:** P1. **Effort:** M (2-3 days: TypeSpec + migration + handler + UI).
**Depends on:** none.

1. Add `signedAt timestamp, signedBy uuid, lockedAt timestamp` to `visit_notes` table.
2. Add `POST /dental/visits/:visitId/notes/sign` handler.
3. Add "Sign Notes" button to SOAP notes sheet; after signing, switch to read-only mode
   with amendment-only edit path.

---

### FIX-10 — J9-001: Add treatment plan version table

**Priority:** P1. **Effort:** L (4-6 days). **Depends on:** FIX-07 (acceptance flow).

1. Create `treatment_plan_version` table (see FIX-07).
2. Snapshot plan on `acceptedAt`.
3. Add `GET /dental/patients/:patientId/treatment-plan/history` endpoint.
4. Show version history in treatment plan tab.

---

### Deferred P2/P3 (post-P0/P1 stabilization)

These are significant but not deployment-blocking after P0/P1 fixes:

| Fix | Description | Effort |
|-----|-------------|--------|
| J3-001 | Block 'missing' tooth same as 'extracted' | XS |
| J3-003 | Implement perio charting (pocket depth, BOP, mobility) | L |
| J2-002 | Build diff-since-last-visit overlay | M |
| J6-001 | Add phase/sequence field to treatments | M |
| J6-002 | Link treatments to appointments | M-L |
| J7-001/2 | Primary/mixed dentition backend support | M |
| J8-001..4 | Clinical dependency sequencing rules | L |
| J1-004 | Per-visit medical history snapshot | M |
| J10-004 | Chain-hash audit log entries | S |

---

### Dependency order (execution sequence)

```
FIX-01 (P0-001 revenue path)
  ├── FIX-03 (completion gate — now testable end-to-end)
  ├── FIX-04 (carry-over wiring — meaningful after treatments can complete)
  └── FIX-07 (plan acceptance — needs planned/performed treatments)
        └── FIX-10 (plan versioning — needs acceptance flow)

FIX-02 (clinical notes persistence) — independent, do in parallel with FIX-01
FIX-05 (RBAC guards) — independent, quick win
FIX-06 (amendment UI) — independent
FIX-08 (prior-visit records) — after FIX-01 (needs performed/verified treatments)
FIX-09 (SOAP note signing) — independent
```

**Minimum viable clinical release:** FIX-01 + FIX-02 + FIX-03 + FIX-05 (≈1 week).
This unblocks the revenue chain, persists clinical notes, enforces the completion
gate server-side, and closes the unauthorized-staff write gap. All other fixes can
follow in subsequent sprints.
