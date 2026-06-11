# AHA Fix Report: Dental Visit & Charting — Batch A (FIX-001)

**Executed:** 2026-06-11 · **Prompt:** `docs/aha/prompts/04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed)
**Batch:** A (FIX-001 — GAP-6 contract reconcile: TypeSpec→handler reality + regen + Hurl pins) · **Type:** spec-only (handlers are ground truth, UNCHANGED).

## What shipped

Reconciled the drifted treatment-plan / template / carry-over TypeSpec models to the **real handler shapes** (handlers are ground truth and were not touched), regenerated routes/validators + SDK, and added contract pins that lock the real wire shapes. The regen window was provably safe (0 FE consumers of the drifted ops, as the plan predicted — confirmed by both typechecks staying green).

| Model / op | Reconciled to |
| --- | --- |
| `TreatmentPlanResponse` | `{ patientId, version, totalEstimateCents, treatmentCount?, toothCount, byTooth?: Record<TreatmentPlanItem[]>, treatments: TreatmentPlanItem[], completedToothNumbers? }` (new `TreatmentPlanItem` model) |
| `ApplyTemplateResponse` | `{ applied: DentalTreatment[], count }` (was `{ applied: int, visitId }`) |
| `CarryOverTreatmentsResponse` | `{ carriedOver[], restoredDismissed[], message }` (was `{ carried: int }`) |
| `CarryOverTreatmentsRequest` | `+ restoreDismissedIds?: UUID[]` |
| `TreatmentTemplate` + Create/Update | `treatments: string` → `items: TemplateTreatmentItem[]` + `branchId` + `active` (Update `+ active?`); new `TemplateTreatmentItem` model |
| `getTreatmentPlan` op | `+ @query branchId: UUID` (required by handler) |
| `listTreatmentTemplates` op | `ApiOkResponse<{ templates: TreatmentTemplate[] }>` (was bare array) |

## Real bugs fixed by the reconcile (not just cosmetic)

1. **create-template was broken (400).** The drifted `CreateTreatmentTemplateBody` validator required `treatments: string`, so `POST /dental/treatment-templates` with the real `{ items[] }` body returned `400 "treatments: expected string, received undefined"` — the endpoint was unusable via the generated validator (the handler's own self-validation never ran because the mounted zValidator rejected first). Reconciling Create/Update template requests to `items[]` restores it (proven by Hurl FIX-001-A: 201).
2. **`getTreatmentPlan` missing required `branchId` query param.** The handler requires `?branchId=` but the op declared only `@path patientId`, so the SDK could not send it → a future FE consumer would 400 (the recurring "createMember-class" drift). Added `@query branchId: UUID`.
3. **`listTreatmentTemplates` envelope drift.** Op declared a bare `TreatmentTemplate[]` but the handler returns `{ templates: [...] }` → SDK consumers would misparse. Reconciled + pinned.

`restoreDismissedIds` was already functional at runtime (the carry-over handler re-reads raw `ctx.req.json()`, bypassing the validator's strip), so this was contract-accuracy only — but now the SDK type carries it.

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Contract (`CONTRACT_ONLY=dental-visit`, server restarted after regen) | **66/66** |
| Typecheck root FE (`dentalemon` + `@monobase/api-ts`) | **exit 0** |
| Typecheck api-ts (`bunx tsc --noEmit`) | **exit 0** |
| Backend: treatment-templates / treatment / plan-versioning / cross-tenant-rbac | 32 / 39 / 8 / 7 pass, 0 fail |

The full contract suite has 8 environmental failures (storage/imaging need MinIO; auth-password-reset/verification 60s timeouts = Mailpit; billing-merchant = Stripe) — all on external-dependency endpoints, none touch the reconciled dental-visit models. Confirmed unrelated: both typechecks pass and the dental-visit slice is 66/66.

## Adversarial review (focused code-reviewer) — 3 findings, all fixed pre-commit

- **[FIXED P1]** `byTooth` grouped items omit `carriedOver` (and `toothNumber`) that the flat `treatments[]` includes → made `TreatmentPlanItem.carriedOver` optional so the shared item model is faithful to BOTH projections. (Handler-side `byTooth` inconsistency flagged below as a residual, not changed in this spec-only batch.)
- **[FIXED P2]** handler `updateTemplateSchema` accepts `active` but `UpdateTreatmentTemplateRequest` omitted it (reactivation was SDK-unreachable) → added `active?: boolean`.
- **[FIXED P3]** `listTreatmentTemplates` envelope drift (bare array vs `{ templates }`) → wrapper model + Hurl pin.

## Decision queue / residuals (surface to orchestrator)

| Item | Why | Recommendation |
| --- | --- | --- |
| **`getTreatmentPlan` `byTooth` items omit `carriedOver`/`toothNumber`** (handler) | The grouped view can't show carried-over badges; flat `treatments[]` has them. Spec-only Batch A kept handlers as ground truth, so the model marks `carriedOver` optional. | Small handler cleanup (add the 2 fields to the `byTooth` push) in a later visit batch; harmless today (0 FE consumers of the grouped view). |
| **Templates wire-or-park (Q1)** | The templates CRUD contract is now accurate, but the FE doesn't consume it and demo seeds templates the UI can't apply. | Unchanged — still a product decision. The reconcile does NOT wire the feature; it only makes the contract truthful regardless of the decision. |

## Not implemented (per plan §9–§11)

Batch B (FIX-002 carry-over FE affordance), Batch C (FIX-005 rbac wiring + FIX-006 orphan-op docs), Batch D (FIX-004 visit-lock cron), Batch E (FIX-003 accepted-plan viewer wiring — waits on case-presentation's shared viewer). No handler/FSM changes, no new scheduler, no duplicate viewer — all out of Batch A scope.
