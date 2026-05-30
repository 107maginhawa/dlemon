# TR-P1-08 — Item-level Treatment-Plan Completion (TP-BR-005) + CR-05 Approval Record

**Status:** DESIGN — awaiting decision before any migration/code.
**Author:** oli (cycle-4 deferred-item design pass) · 2026-05-30
**Branch:** `oli/cycle-4-audit-fix`

---

## 1. Why this is a design pass, not a build

The audit (TRACE 5f) flagged WF-048/049/050 treatment-plan completion as **partial**:
plan-level FSM only, **no item-level completion (TP-BR-005)**, and **CR-05 approval
record deferred**. Closing it touches the data model, so per the chosen path we scope
it first.

> **TP-BR-005** — *"Completing one item must not automatically complete the whole plan
> unless all items are completed."* (IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md:432)

---

## 2. Current state — there are THREE parallel "plan" concepts

| # | Artifact | Where | What it is | Item-level? | Completion? |
|---|----------|-------|-----------|-------------|-------------|
| 1 | `dental_treatment_plan` (header) | `dental-patient/repos/treatment-plan.schema.ts` | A header row with its **own** FSM `draft→presented→approved→partially_completed→completed→cancelled`, `providerId`, `totalEstimateCents`, `presentedAt`, `approvedAt`. | **No** — no FK to any treatment; no items. | `partially_completed`/`completed` are set **manually** via `PATCH /treatment-plans/:planId` and are **never derived** from anything. |
| 2 | Virtual aggregated plan | `getTreatmentPlan.ts` (`GET /dental/patients/:id/treatment-plan`) | Computed on the fly: aggregates `dental_treatment` rows with status `diagnosed`/`planned`(/`declined`) across the patient's visits, grouped by tooth. | **The real items are `dental_treatment` rows.** | No completion concept — it only lists *pending* work. |
| 3 | `treatment_plan_version` (snapshot) | `dental-visit/repos/treatment-plan-version.schema.ts` | Append-only immutable snapshot of the virtual plan at acceptance time (`POST .../treatment-plan/accept`). Can link a `consentFormId` via `consentForms.acceptedPlanVersionId`. | Snapshots items as JSONB. | Captures acceptance, not per-item completion. |

**Core problem:** the header (#1) and the real clinical work (#2, `dental_treatment`) are
**disconnected**. The header FSM's completion states are decorative — nothing drives them
from the actual treatments. TP-BR-005 presumes item-level state the header doesn't have.

**CR-05 gap:** the only approval evidence today is `dental_treatment_plan.approvedAt`
(bare timestamp) + an optional consent-form link on a *version*. There is **no
first-class record of who approved, how, and against which plan/version**.

---

## 3. The one decision that drives everything: what is a "plan item"?

### Option A — Items = `dental_treatment` rows (RECOMMENDED)
Link treatments to a plan and **derive** plan completion from treatment statuses.

- Add nullable `treatment_plan_id` FK on `dental_treatment` (a treatment belongs to ≤1 plan).
- Derivation rule (TP-BR-005):
  - plan `completed`  ⇢ **every** linked treatment is terminal-done (`performed`/`verified`) — and there is ≥1.
  - plan `partially_completed` ⇢ **some** linked treatments are terminal-done, but not all.
  - else stays `approved`.
  - `dismissed`/`declined` treatments are excluded from the "all done" denominator (a fully-declined plan does not auto-complete; it stays `approved` or is `cancelled` manually).
- Recompute trigger: in `updateDentalTreatment` (already the choke point for status
  changes), after a status transition, recompute the parent plan's derived status.
  Alternatively a `POST /treatment-plans/:planId/recompute` for an explicit pull.

**Pros:** single source of truth (the clinical record), no duplicate item model, no sync
hazard, TP-BR-005 becomes a pure derivation. **Cons:** treatments live on *visits* while
plans live on *patients* — the FK crosses that boundary (acceptable; both are patient-scoped).

### Option B — New `dental_treatment_plan_item` table
First-class plan items (cdtCode, tooth, price, status) independent of `dental_treatment`.

**Pros:** plan is self-contained. **Cons:** duplicates clinical data, creates a
two-way sync problem with `dental_treatment` (the real record of what was done), and two
places to enforce immutability/billing. **Not recommended.**

> **Recommendation: Option A.**

---

## 4. CR-05 — approval record

Add `dental_treatment_plan_approval` (append-only):

| Field | Notes |
|-------|-------|
| `id`, `created_at`, `created_by` | base |
| `treatment_plan_id` FK | the approved plan |
| `plan_version_id` FK (nullable) | the `treatment_plan_version` snapshot accepted, if any |
| `approved_by_person_id` | patient or guardian who approved |
| `method` enum | `signature` \| `verbal` \| `portal` |
| `consent_form_id` FK (nullable) | links the signed consent (reuses existing `consentForms`) |
| `signature_data` (nullable) | base64 signature when `method='signature'` |
| `approved_at` | timestamp |

On approval: write this record **and** set `dental_treatment_plan.status='approved'` +
`approvedAt`. Keeps the bare timestamp for back-compat; the record is the auditable artifact.

This largely **reuses** the existing accept-plan + consent-form linkage (concept #3) —
the approval record is the missing first-class row, not a new acceptance flow.

---

## 5. Proposed vertical TDD slice (after this design is approved)

1. **Migration:** `dental_treatment.treatment_plan_id` (nullable FK, indexed); new
   `dental_treatment_plan_approval` table + `method` enum.
2. **Repo + derivation:** `TreatmentPlanRepository.recomputeStatus(planId)` implementing §3A.
   Backend tests first (RED): all-done→completed, some-done→partially_completed,
   none→approved, all-declined→stays approved, single-item completion does NOT complete a
   multi-item plan (TP-BR-005 explicit).
3. **Wire trigger:** `updateDentalTreatment` recomputes parent plan after status change.
4. **Approval endpoint:** `POST /treatment-plans/:planId/approval` → writes record + sets
   header approved. Tests for record shape + consent linkage.
5. **Contract + FE:** treatment-plan tab shows per-item completion + plan progress; an
   "Approve plan" action captures CR-05. (Scope FE in a follow-up sub-slice.)
6. **TypeSpec:** add the approval endpoint + `treatmentPlanId` field via TypeSpec → codegen
   (never hand-edit generated files).

**Est.:** ~1 migration + 1 enum, ~3 handlers, ~2 schema changes, backend + contract +
FE tests. A genuine vertical slice (½–1 day).

---

## 6. Open decisions for sign-off

1. **Option A vs B** for plan items. (Recommend **A**.)
2. **Completion trigger:** auto-recompute inside `updateDentalTreatment` (reactive) vs an
   explicit `recompute` endpoint (pull). (Recommend **reactive**, with the endpoint as a
   manual backstop.)
3. **Backfill:** existing `dental_treatment` rows have no `treatment_plan_id`. Leave NULL
   (unlinked treatments simply aren't part of any plan's completion math) — no backfill
   needed. Confirm acceptable.
4. **CR-05 record vs extend version:** new `dental_treatment_plan_approval` table
   (recommended) vs adding approver fields to `treatment_plan_version`.
