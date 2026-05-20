# Journey Harness Contract

**Date:** 2026-05-19
**Branch:** `feat/v1.4-clinical-imaging`
**Phase:** 2 of the verification harness program (Phase 1 = E2E bypass audit; this = the executable spec; Phase 3 = Playwright implementation)

## Purpose

This document is the **single source of truth** for what constitutes a "pass" for each
clinical journey. Phase 3 Playwright specs MUST satisfy this contract verbatim. It exists
because the repo carries a false 9/10 confidence score: every existing test layer
(handler unit tests with `buildTestApp()`, contract Hurl, frontend unit, current E2E)
bypasses the **UI→API seam where the bugs actually live**. A concurrent clinical audit
(`docs/audits/2026-05-19-workspace-clinical-workflow-audit.md`) proved the workspace is
**NOT clinically deployable** — 3 confirmed P0 bugs. This harness drives ONLY a real
browser against a real API and asserts goal state via an **independent read**, so a
journey blocked by a P0 *must* surface as BROKEN instead of green.

Set A is derived from `docs/audits/dental-workspace-audit-reference.md` (10 journeys ×
40-question bank; P0 = Q17–Q19, Q36–Q38, Q40, Gaps #1–#6). Set B is derived from
`docs/modules/dental-imaging/MODULE_SPEC.md` (CIMG-001..008) and the verified golden
coordinates in `packages/ceph-math/src/ceph-math.test.ts`.

---

## Anti-Cheating Rules (applies to ALL specs — no exceptions)

Every journey spec MUST obey these three rules. A spec that violates any of them is
invalid and does not count as coverage.

1. **DOM-only drive.** Drive the journey only via the rendered DOM (real clicks, real
   typing, real navigation). **FORBIDDEN:** the Playwright `request.` fixture, any
   `page.evaluate` that injects/mutates app state, direct API calls to set up the
   goal state, and hand-driven PATCH/POST sequences that simulate what a UI button
   "would have" done. Seeding preconditions via DB/API *before* the browser opens is
   allowed (and required); shortcutting *the journey itself* is not.

2. **Independent-read goal assertion.** Assert the journey succeeded via a **separate
   API GET or direct DB query executed AFTER the UI flow completes** — reading the
   durable record, not the screen. **FORBIDDEN as proof of success:** "a toast
   appeared", "the button text changed", "the UI now shows X", any assertion against
   in-memory React/TanStack-Query state. The read must hit the same persistence the
   next clinician/session would see.

3. **No shortcut to force a pass.** A journey that cannot be completed end-to-end
   through the UI gets verdict **BROKEN**. Do NOT add an API call, a `page.evaluate`,
   or a hand-built request sequence to make the spec go green. The spec must *prove
   the break* (independent read shows the goal state was never reached) and stop.

---

## Personas (via real PIN auth)

All journeys authenticate through the real PIN flow:
`/auth/pin-select` → tap member card → `/auth/pin-entry/$memberId` → 6-digit keypad →
server `POST /dental/organizations/:orgId/branches/:branchId/members/:memberId/verify-pin`.
Never bypass with `page.evaluate(pinSession.startSession)` or cookie injection.

| Persona | Seed role | Scope |
|---|---|---|
| **dentist** | `dentist_owner` | Clinical write: chart, diagnose, plan, complete, sign, prescribe, trigger billing |
| **associate** | `dentist_associate` | Clinical write within own scope; own imaging only |
| **front-desk** | `staff_scheduling` | Read-mostly chart; present plan; capture acceptance/financial; schedule; billing-present — NO clinical mutation |
| **assistant** | `staff_full` | Chart existing during exam; imaging links; draft notes — NO sign/finalize/bill |

---

## Set A — Workspace Revenue & Clinical Journeys (10)

> Entry route for all workspace journeys: `/_workspace/$patientId`
> (source: `apps/dentalemon/src/routes/_workspace/$patientId.tsx`).
> Preconditions are seeded via `bun run db:reseed` (10 demo patients, mixed dentition,
> imaging present) plus per-journey API/DB setup *before* the browser opens.

---

### J01: New-patient comprehensive oral evaluation + chart existing conditions

**Rubric:** J1; Q6, Q7, Q8, Q9, Q10 (Gap #1 status-collapse, #2 Existing-Other)
**Persona:** dentist
**Entry route:** `/_workspace/:patientId` (fresh patient, no prior visits)
**Preconditions:** patient exists with DOB → dentition mode resolvable; an active visit
open for the patient (or J01 opens one via the carousel "New Visit" control).

**UI Steps (DOM-only):**
1. PIN-auth as dentist; navigate to `/_workspace/:patientId`.
2. If no active visit, click the carousel "New Visit" affordance (`TimelineCarousel`
   `onNewVisit`); wait for the new visit to become current.
3. Click a tooth in the carousel to open `ToothSlideout` (`onSelectTooth` → `selectTooth`).
4. In the slideout, record a **pre-existing restoration** with status Existing and a
   surface set (e.g. tooth 14, MOD, composite, Existing). Save.
5. Open a second tooth; record an **Existing-Other** item (work done elsewhere). Save.
6. Open Notes (`WorkspaceTopBar` → `onNotes` → `SoapNotesSheet`); author the
   comprehensive exam note (D0150) text. Attempt to sign/lock the note.

**Goal-state assertion (independent read):**
- `GET /dental/visit/:visitId` (or visit detail endpoint) returns the tooth records
  with **distinct `status` values** — one `existing`, one `existing_other` — NOT a
  single boolean "done" and NOT both collapsed to the same status.
- The exam note row exists in the DB with `signed`/`locked` state and is associated
  with the visit and a provider-of-record.

**Negative-rule assertions:**
- Recording an Existing restoration must NOT create a fee/claim/ledger event
  (independent read of billing/invoice table for this visit returns nothing).
- D0150 cannot reach Completed without an authored exam note: attempt to mark the
  exam complete with no note → UI guard blocks AND independent read shows the exam
  procedure is not `completed`.

**Persistence checkpoint:**
- After step 4, navigate to `/patients/:patientId` and back to the workspace. Assert
  the Existing restoration (tooth + surface set + status) still renders AND an
  independent `GET` still returns it.

**Known verdict:** BROKEN — clinical audit shows status is collapsed (Gap #1); no
Existing-Other status; clinical notes are local React state with no DB column
(**P0-004**), so the note will not survive the persistence checkpoint.
**P0 ref:** P0-004 (note persistence), Gap #1, Gap #2.

---

### J02: Periodic recall exam (D0120) — diff since last visit

**Rubric:** J2; Q9, Q10, Q25
**Persona:** dentist
**Entry route:** `/_workspace/:patientId` (patient with ≥1 prior completed visit + baseline conditions)
**Preconditions:** seed a patient with a prior visit containing charted conditions
(at least one "watch" condition) and a prior treatment plan.

**UI Steps (DOM-only):**
1. PIN-auth as dentist; open the workspace; confirm prior baseline is visible (year
   filter / carousel shows the prior visit).
2. Open a new recall visit via the carousel.
3. Open the previously "watch"-flagged tooth; progress it (watch → diagnosed).
4. Open Notes; author the D0120 recall note; sign/lock.

**Goal-state assertion (independent read):**
- Independent `GET` of the patient's tooth/condition log shows the watched tooth's
  status changed to `diagnosed` and the change is attributed to the new visit (not
  silently rewriting the prior visit's record).
- The D0120 note row exists, signed, on the new visit.

**Negative-rule assertions:**
- The prior visit's original "watch" record must remain visible/unaltered in history
  (independent read of the prior visit still shows the original status with its
  original timestamp).

**Persistence checkpoint:**
- Navigate away and back; the diff (watch→diagnosed on the new visit) survives via
  independent read.

**Known verdict:** BROKEN — note persistence (**P0-004**) breaks the D0120 note;
status-collapse (Gap #1) prevents a true watch→diagnosed transition distinct from the
prior record.
**P0 ref:** P0-004, Gap #1.

---

### J03: Periodontal charting linked to odontogram

**Rubric:** J3; Q11, Q12, Q13, Q14, Q16 (I2 invariant)
**Persona:** dentist (or hygienist if a hygienist persona exists in seed; default dentist)
**Entry route:** `/_workspace/:patientId` (patient with at least one tooth charted missing)
**Preconditions:** seed a patient where tooth #19 is charted **missing/extracted**, and
a multi-rooted molar + a single-rooted tooth are present.

**UI Steps (DOM-only):**
1. PIN-auth; open workspace; open the perio entry surface for the patient.
2. Attempt to record probing depths on tooth #19 (charted missing).
3. Record 6-site PD + BOP on a present multi-rooted molar; enter furcation.
4. Attempt to enter furcation on the single-rooted tooth.
5. Save the perio chart.

**Goal-state assertion (independent read):**
- Independent `GET` of the perio record returns 6 sites for the charted molar with PD
  + BOP + recession persisted, and CAL derivable (CAL = PD + recession).

**Negative-rule assertions:**
- Tooth #19 (missing) MUST be suppressed/locked in the perio grid AND the server must
  reject perio sites for a missing tooth (independent read shows no perio rows for
  #19). A perio row existing for a missing tooth = data-integrity failure (invariant I2).
- Furcation on the single-rooted tooth must be blocked client-side AND rejected
  server-side (independent read shows no furcation value for that tooth).

**Persistence checkpoint:**
- Reload; the molar's 6-site perio data survives via independent read.

**Known verdict:** BROKEN (provisional) — no dedicated perio capture surface confirmed
in the workspace route; if the perio entry surface does not exist in the rendered DOM,
the journey cannot complete → BROKEN per Anti-Cheating Rule 3. Phase 3 must record the
exact missing surface.
**P0 ref:** Gap #7 (perio decoupled / probing missing teeth).

---

### J04: Diagnosis → plan → present → accept → schedule → deliver → COMPLETE → BILL (the revenue chain)

**Rubric:** J4; **Q17, Q18, Q19** (all P0), Q20, Q22, Q23 (Gap #4 billing-not-gated, #11 consent)
**Persona:** dentist for clinical steps; front-desk for present/accept/financial
**Entry route:** `/_workspace/:patientId`
**Preconditions:** patient with an active visit; a diagnosable finding on a tooth.

**UI Steps (DOM-only):**
1. PIN-auth as dentist; open workspace; open a tooth; record a diagnosis (finding).
2. Open Treatment Plan (`WorkspaceTopBar` → `onTreatmentPlan` → `TreatmentPlanTab`);
   add a treatment-planned procedure (CDT code, tooth, surfaces, fee). Status = TP.
3. Open Consent (`WorkspaceTopBar` → `onConsent` → `ConsentSheet`); attempt to record
   informed consent for the planned procedure.
4. Mark the planned treatment delivered: in `TreatmentTable`, drive the treatment
   through the **full** status machine via the UI — `diagnosed → planned → performed`
   (two distinct UI steps; a single jump to `performed` is the bug).
5. Author + sign the completion note (provider, date, surfaces treated).
6. Footer → "Continue to Payment" (`continue-to-payment-btn`) →
   `WorkspacePaymentModal`; generate the invoice/claim.

**Goal-state assertion (independent read):**
- Independent `GET` of the treatment row shows `status: 'performed'` (reached via the
  two-step transition, not skipped).
- Independent `GET` of the invoice/claim endpoint returns an invoice containing the
  treatment as a line item with the planned fee, dated, attributed to the provider.

**Negative-rule assertions:**
- Billing gate (Q17 / B1): before the treatment is `performed`, attempting to
  generate the invoice must be blocked in the UI **and** the server must reject the
  claim — independent read shows no invoice/ledger row for a non-`performed` treatment.
- Consent gate (Q19 / C1, **P0-003**): if consent for the procedure is not recorded,
  delivery must be blocked server-side. The current UI offers a "Complete anyway"
  bypass — assert that even when the UI bypass is used, the **server rejects**
  delivery of a non-consented procedure (independent read shows treatment NOT
  `performed`). If the server permits it, that is the proof of the P0-003 break.
- Completion requires note + provider + date (Q18 / B2): independent read of the
  completed treatment shows a linked authored note, provider-of-record, and
  completion date.

**Persistence checkpoint:**
- After step 4, navigate away and back; the treatment's `performed` status and the
  consent linkage survive via independent read.

**Known verdict:** **BROKEN** — `useMarkTreatmentDone` sends a single PATCH
`diagnosed → performed` which the server rejects with 422 (state machine requires
`diagnosed → planned → performed`). No treatment ever reaches `performed` through the
UI ⇒ no invoice is possible ⇒ the revenue chain is dead end-to-end. Consent is
advisory-only client-side with a "Complete anyway" bypass and is never server-enforced.
This is the flagship BROKEN journey.
**P0 ref:** **P0-001** (revenue chain dead), **P0-003** (consent not server-enforced).

---

### J05: Existing / Existing-Other / TP / Completed status integrity on the odontogram

**Rubric:** J5; Q8, Q24, Q25 (Gap #1, I1 invariant)
**Persona:** dentist
**Entry route:** `/_workspace/:patientId`
**Preconditions:** a patient/visit able to carry one tooth in each of: Existing,
Existing-Other, TP, Completed, Condition.

**UI Steps (DOM-only):**
1. PIN-auth; open workspace.
2. Via the tooth slideout, create one entry of each status (Existing, Existing-Other,
   TP, Condition) on distinct teeth; and (if the revenue chain is reachable) one
   Completed.
3. Observe the odontogram legend + colors.

**Goal-state assertion (independent read):**
- Independent `GET` of the procedure/condition log returns **distinct enumerated
  `status` values per record** (not a shared boolean, not all-same). At minimum
  Existing ≠ Existing-Other ≠ TP ≠ Condition as separate persisted statuses.
- The odontogram render must match the log (force one status change via UI; reload;
  independent read and rendered legend agree — invariant I1, no divergence).

**Negative-rule assertions:**
- A TP item must NOT be billable (independent read: no ledger event for a TP-status row).
- Condition items must NOT be billable as procedures.

**Persistence checkpoint:**
- Reload; all four+ statuses persist distinctly via independent read.

**Known verdict:** BROKEN — status-collapse (Gap #1) is a confirmed audit finding; no
Existing-Other status exists; Completed is unreachable through the UI (depends on
P0-001).
**P0 ref:** Gap #1, Gap #2, P0-001 (Completed unreachable).

---

### J06: Multi-visit / phased treatment plan sequencing

**Rubric:** J6; Q26, Q27, Q28
**Persona:** dentist plans; front-desk schedules
**Entry route:** `/_workspace/:patientId` → `TreatmentPlanTab`
**Preconditions:** patient with ≥3 plannable procedures forming a dependency chain
(e.g. extract → graft → implant → crown).

**UI Steps (DOM-only):**
1. PIN-auth as dentist; open Treatment Plan.
2. Add ≥3 TP procedures; assign each to a phase/visit with ordering + priority.
3. Attempt to complete a later-phase item before its prerequisite (out-of-order).

**Goal-state assertion (independent read):**
- Independent `GET` of the treatment plan returns the procedures with persisted
  `phase`/sequence + priority fields (not a flat unordered list).

**Negative-rule assertions:**
- Out-of-order completion (e.g. crown before its RCT/implant) must at minimum produce
  a warning in the UI; *silence is the bug* (Q27/Q28). Assert the warning surfaces.
  (Block vs warn is policy; the test asserts non-silence.)

**Persistence checkpoint:**
- Reload; phase/sequence assignments survive via independent read.

**Known verdict:** BROKEN (provisional) — phasing/sequence fields and dependency
warnings not confirmed present; J04 dependency means Completed is unreachable. Phase 3
records exact gap.
**P0 ref:** Gap #14 (no sequencing awareness).

---

### J07: Charting granularity & dentition (surface/tooth/quadrant + mixed dentition)

**Rubric:** J7; Q29, Q30, Q31, Q32, Q33 (invariants D2, D4)
**Persona:** dentist
**Entry route:** `/_workspace/:patientId`
**Preconditions:** a mixed-dentition pediatric patient (seed default mode is 'mixed';
primary + permanent present) and an adult patient.

**UI Steps (DOM-only):**
1. PIN-auth; open the mixed-dentition patient's workspace.
2. Open an incisor; attempt to record an **occlusal** surface restoration.
3. Open a posterior tooth; record an MOD restoration (valid).
4. Attempt to record a restoration with **no surface** selected.
5. Confirm both primary and permanent teeth render for the same patient.

**Goal-state assertion (independent read):**
- Independent `GET` returns the posterior MOD restoration with its surface set
  persisted; primary-tooth ids distinct from permanent-tooth ids in the chart record.

**Negative-rule assertions:**
- Occlusal on an incisor must be rejected (incisors take incisal) — UI guard AND
  server rejection (independent read shows no such record).
- Restoration with zero surfaces must be rejected — UI guard AND server rejection.

**Persistence checkpoint:**
- Reload; the valid MOD restoration + mixed-dentition layout survive via independent read.

**Known verdict:** PASS (provisional) — mixed dentition is a shipped seed default
(memory: demo seed complete, 'mixed' mode default). Surface-validity guards
unconfirmed; if absent, the negative-rule assertions flip the verdict to BROKEN.
**P0 ref:** Gap #9 (surface/code validation) — P2, not P0.

---

### J08: Informed refusal — declined treatment is persisted with reason

**Rubric:** J4 decision point; Q20 (C4)
**Persona:** front-desk presents; dentist documents
**Entry route:** `/_workspace/:patientId` → `TreatmentPlanTab`
**Preconditions:** patient with a presented treatment plan containing ≥1 TP item.

**UI Steps (DOM-only):**
1. PIN-auth; open Treatment Plan; present the plan.
2. Mark one item **declined**; enter a refusal reason.
3. Save.

**Goal-state assertion (independent read):**
- Independent `GET` of the treatment plan returns the item with a persisted
  `declined` status AND the refusal reason text stored on the record.

**Negative-rule assertions:**
- A declined item must NOT be billable and must NOT be schedulable (independent read:
  no ledger/appointment link).

**Persistence checkpoint:**
- Reload; the declined status + reason survive via independent read.

**Known verdict:** BROKEN (provisional) — informed-refusal capture not confirmed in
the plan UI; legally critical (C4). Phase 3 confirms.
**P0 ref:** Gap #11 (no informed-refusal capture).

---

### J09: Treatment-plan versioning — accepted version is frozen

**Rubric:** J9; Q34, Q35 (C3, Gap #6)
**Persona:** dentist edits; front-desk captures acceptance
**Entry route:** `/_workspace/:patientId` → `TreatmentPlanTab`
**Preconditions:** patient with a treatment plan that has been presented + accepted.

**UI Steps (DOM-only):**
1. PIN-auth; open Treatment Plan; capture acceptance (signature/date) of version N.
2. Edit the plan (add an item / change a fee).
3. Inspect plan version history.

**Goal-state assertion (independent read):**
- Independent `GET` returns the accepted version N as an **unchanged immutable
  snapshot** AND a new version N+1 containing the edit, with reason/date/author on
  N+1. Exactly one active plan.

**Negative-rule assertions:**
- Editing after acceptance must NOT rewrite the accepted snapshot (independent read of
  version N is byte-identical to what was accepted).

**Persistence checkpoint:**
- Reload; both versions retrievable; accepted version frozen via independent read.

**Known verdict:** BROKEN (provisional) — plan versioning/immutable-snapshot model not
confirmed; Gap #6 is a listed highest-risk gap. Phase 3 confirms.
**P0 ref:** Gap #6 (no treatment-plan versioning).

---

### J10: Void / amend a signed entry — no hard delete, audit preserved

**Rubric:** J10; **Q36, Q37, Q38**, Q39 (P0), C2, Gap #3, #5
**Persona:** dentist
**Entry route:** `/_workspace/:patientId`
**Preconditions:** a patient with a **signed/locked** clinical note and a charted entry
on a tooth.

**UI Steps (DOM-only):**
1. PIN-auth; open workspace; open the signed note in `SoapNotesSheet`.
2. Attempt to **edit** the signed note text directly.
3. Attempt to **hard-delete** the signed note / a completed entry.
4. Add an **amendment/addendum** with reason; save.
5. Open the audit trail view for the entry.

**Goal-state assertion (independent read):**
- Independent `GET` of the note shows the original text **preserved** and an addendum
  row appended (current date + author + reason), original NOT overwritten.
- Independent `GET` of the audit trail returns before→after, who, when for the
  amendment (Q38), and it is exportable.

**Negative-rule assertions:**
- Direct edit of a signed note must be blocked (Q37): UI disallows AND server rejects
  a content mutation on a locked note (independent read: original text unchanged).
- Hard delete of a signed/completed entry must be blocked (Q36): server returns
  rejection AND independent read still shows the entry (only void+reason is allowed).

**Persistence checkpoint:**
- Reload; original + addendum + audit entries all survive via independent read.

**Known verdict:** BROKEN — clinical notes are local React state with no DB column
(**P0-004**): there is no signed/locked persistence, no addendum model, and no audit
trail for note mutations. The journey cannot complete through the UI.
**P0 ref:** **P0-004**, Gap #3 (hard delete), Gap #5 (editable signed notes).

---

## Set B — Ceph Clinical Journeys (4)

> Entry: imaging is opened from the workspace (`imaging-tab-btn` →
> `data-testid="imaging-overlay"` → select a cephalometric image → `ImagingWorkspace`).
> Report print route: `/imaging-ceph-report/$imageId?version=N`
> (source: `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx`).
> Numeric expectations are anchored to the **verified golden coordinates** in
> `packages/ceph-math/src/ceph-math.test.ts` (hand-calculated, asserted with
> `toBeCloseTo(_, 1)`). Phase 3 MUST seed exactly these landmark pixel coordinates
> for a cephalometric image so the computed angles are deterministic:
>
> | Landmark | x | y |  | Landmark | x | y |
> |---|---|---|---|---|---|---|
> | S | 100 | 200 | | Go | 220 | 310 |
> | N | 300 | 200 | | U1T | 300 | 240 |
> | A | 290 | 271 | | U1A | 296 | 265 |
> | B | 288 | 268 | | L1T | 298 | 265 |
> | Pog | 285 | 280 | | L1A | 293 | 285 |
> | Me | 282 | 310 | | | | |
>
> Expected derived measurements for this set: **SNA ≈ 82.0°**, **SNB ≈ 80.0°**,
> **ANB ≈ 2.0°**, `convexity_napog > 0` (all `toBeCloseTo(_, 1)`).

---

### B01: Free-tier ceph gate (CIMG-001 / CIMG-002 / CIMG-007)

**Spec ref:** CIMG-001 (free tier → 403), CIMG-002 (null tier = free → 403), CIMG-007
(non-member → 404)
**Persona:** dentist whose `dental_membership.imagingTier` is free/null
**Entry route:** workspace → `imaging-tab-btn` → select a cephalometric image
**Preconditions:** seed a member with `imagingTier = 'free'` (and a parallel case with
`imagingTier = null`); a cephalometric image exists.

**UI Steps (DOM-only):**
1. PIN-auth as the free-tier dentist; open imaging overlay; select the ceph image.
2. Attempt to enter the ceph landmark/analysis workspace through the UI.

**Goal-state assertion (independent read):**
- Independent `GET /dental/imaging/images/:imageId/ceph/analysis` for the free-tier
  member returns **HTTP 403**; the null-tier member also returns **403**; a
  non-member returns **404**.
- The UI must surface the gate (no silent empty state that looks like "no data").

**Negative-rule assertions:**
- No ceph landmark/report rows are created for a gated member (independent read: zero rows).

**Persistence checkpoint:** n/a (read-gate journey).

**Known verdict:** PASS (provisional) — CIMG-001/002/007 marked implemented in
MODULE_SPEC. The UI-surfacing of the 403 is the unverified part; if the UI swallows
the 403 into a generic empty state the journey is DONE_WITH_CONCERNS for Phase 3 to
resolve.
**P0 ref:** none (tier gate, not a clinical-legal P0).

---

### B02: Landmark placement → confirm → SNA/SNB computed (numeric)

**Spec ref:** CIMG-003 (placed→confirmed→locked forward-only), ceph-math golden values
**Persona:** dentist with paid `imagingTier`
**Entry route:** workspace → ceph image → `ImagingWorkspace`
**Preconditions:** paid-tier member; cephalometric image with `pixelSpacingMm` set
(calibrated); NO landmarks yet.

**UI Steps (DOM-only):**
1. PIN-auth (paid tier); open the ceph image workspace.
2. Place all 16 landmarks at the golden coordinates above by clicking the canvas at
   each (x,y). (At minimum S, N, A, B, Go, Po for the gated metrics + report gate.)
3. Transition S, N, A, B from `placed` → `confirmed` via the UI.
4. Trigger analysis recompute via the UI control.

**Goal-state assertion (independent read — NUMERIC):**
- Independent `GET /dental/imaging/images/:imageId/ceph/analysis` returns
  `measurements.sna ≈ 82.0` (±0.1), `measurements.snb ≈ 80.0` (±0.1),
  `measurements.anb ≈ 2.0` (±0.1), `measurements.convexity_napog > 0`.
  Asserting "a measurement row exists" is INSUFFICIENT — the numbers must match the
  golden expectations.
- Independent `GET /dental/imaging/images/:imageId/ceph/landmarks` shows S/N/A/B with
  `status: 'confirmed'`.

**Negative-rule assertions:**
- A backward transition (e.g. `confirmed → placed`) attempted via the UI must be
  rejected by the server with **422 INVALID_STATUS_TRANSITION** (independent read:
  status unchanged).

**Persistence checkpoint:**
- Reload the ceph workspace; landmarks + confirmed states + computed angles survive
  via independent read (numbers identical).

**Known verdict:** PASS (provisional) — CIMG-003 + ceph-math marked implemented and
golden-tested at the unit layer; this journey verifies the **UI→API→math** seam
produces the same numbers. If the canvas-click→landmark-coordinate mapping is lossy,
SNA/SNB will drift from 82/80 and the journey is BROKEN.
**P0 ref:** none.

---

### B03: Locked landmark immutability (CIMG-004)

**Spec ref:** CIMG-004 (locked landmark → PATCH/DELETE 422 LANDMARK_LOCKED)
**Persona:** dentist (paid tier)
**Entry route:** ceph workspace (continues from B02 state or seeded)
**Preconditions:** an image with at least one landmark in `locked` status.

**UI Steps (DOM-only):**
1. PIN-auth; open the ceph workspace for the image with a locked landmark.
2. Attempt to drag/move (PATCH) the locked landmark via the UI.
3. Attempt to delete the locked landmark via the UI.

**Goal-state assertion (independent read):**
- Independent `GET .../ceph/landmarks` shows the locked landmark's `x`, `y`, and
  `status: 'locked'` **unchanged** after both attempts.
- Server rejects both with **422 LANDMARK_LOCKED**.

**Negative-rule assertions:**
- The UI must visibly prevent (or clearly reject) the edit — not silently appear to
  move it while the server rejects (that would be a divergence bug).

**Persistence checkpoint:**
- Reload; locked landmark unchanged via independent read.

**Known verdict:** PASS (provisional) — CIMG-004 marked implemented; UI prevention vs
silent-divergence is the verification target.
**P0 ref:** none.

---

### B04: Report gate + immutable versioned snapshot (CIMG-006 / CIMG-008)

**Spec ref:** CIMG-006 (A, B, Go, Po must be `confirmed` before report creation),
CIMG-008 (reports append-only versioned snapshots — no update/delete)
**Persona:** dentist (paid tier)
**Entry route:** ceph workspace → report; print route `/imaging-ceph-report/$imageId`
**Preconditions:** image with landmarks at golden coordinates; A/B/Go/Po NOT yet all confirmed.

**UI Steps (DOM-only):**
1. PIN-auth; open ceph workspace.
2. With at least one of A/B/Go/Po still `placed` (not confirmed), attempt to generate
   a report via the UI.
3. Confirm all four gate landmarks; generate the report.
4. Navigate to `/imaging-ceph-report/$imageId` (latest) and confirm it renders.
5. Re-edit a non-locked landmark, regenerate the report.
6. Open `/imaging-ceph-report/$imageId?version=1` and `?version=2`.

**Goal-state assertion (independent read — NUMERIC):**
- Step 2: independent `GET .../ceph/reports` shows **no report created** (gate held)
  and the create request returned a gate error.
- After step 3: `GET .../ceph/reports/1` returns a snapshot whose embedded
  measurements match the golden values (SNA ≈ 82.0, SNB ≈ 80.0) — frozen at
  generation time.
- After step 5: version 1 snapshot is **byte-identical** to before (independent read),
  and version 2 exists separately with the new landmark's effect. No update/delete
  endpoint mutates version 1 (CIMG-008).

**Negative-rule assertions:**
- Report creation with A/B/Go/Po not all confirmed must be rejected server-side
  (independent read: no new report row).
- Any attempt to delete/update an existing report version must fail (append-only).

**Persistence checkpoint:**
- `?version=1` always returns the original frozen snapshot regardless of later edits.

**Known verdict:** PASS (provisional) — CIMG-006/008 marked implemented; the
report-snapshot freeze + the report's numeric content are the verification targets.
**P0 ref:** none.

---

## Journey → File Mapping

Spec files live in (Phase 3) `apps/dentalemon/tests/journey/`. Naming:
`NN-<slug>.journey.spec.ts`.

| Journey | Spec file | Set | Expected verdict |
|---|---|---|---|
| J01 | `01-new-patient-exam.journey.spec.ts` | A | BROKEN |
| J02 | `02-periodic-recall.journey.spec.ts` | A | BROKEN |
| J03 | `03-perio-charting.journey.spec.ts` | A | BROKEN (provisional) |
| J04 | `04-revenue-chain.journey.spec.ts` | A | **BROKEN** (flagship) |
| J05 | `05-status-integrity.journey.spec.ts` | A | BROKEN |
| J06 | `06-phased-plan-sequencing.journey.spec.ts` | A | BROKEN (provisional) |
| J07 | `07-granularity-dentition.journey.spec.ts` | A | PASS (provisional) |
| J08 | `08-informed-refusal.journey.spec.ts` | A | BROKEN (provisional) |
| J09 | `09-plan-versioning.journey.spec.ts` | A | BROKEN (provisional) |
| J10 | `10-void-amend-audit.journey.spec.ts` | A | BROKEN |
| B01 | `11-ceph-tier-gate.journey.spec.ts` | B | PASS (provisional) |
| B02 | `12-ceph-landmarks-numeric.journey.spec.ts` | B | PASS (provisional) |
| B03 | `13-ceph-locked-landmark.journey.spec.ts` | B | PASS (provisional) |
| B04 | `14-ceph-report-snapshot.journey.spec.ts` | B | PASS (provisional) |

"Provisional" verdicts must be resolved to a hard PASS/BROKEN by Phase 3 against the
real rendered DOM; a journey whose required UI surface does not exist is BROKEN per
Anti-Cheating Rule 3 (no shortcut to force a pass).

---

## Verdict Rubric (for Phase 4 auditor)

- **PASS** — every UI step completes through the rendered DOM, every goal-state
  independent read matches, every negative-rule both UI-guards and server-rejects,
  the persistence checkpoint survives.
- **BROKEN** — any UI step is impossible, OR the independent read shows the goal state
  was never reached, OR a negative rule is only client-side (server permits the bad
  state), OR the persistence checkpoint loses data.
- A journey touching a P0 (P0-001, P0-003, P0-004, or any Gap #1–#6 / Q17–19 / Q36–38
  / Q40) that comes back PASS is itself a finding — the harness or the spec is
  cheating; re-audit against the Anti-Cheating Rules.
