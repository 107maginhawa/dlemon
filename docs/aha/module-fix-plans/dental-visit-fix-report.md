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

---

# AHA Fix Report: Dental Visit & Charting — Batch B (FIX-002 carry-over affordance)

**Executed:** 2026-06-12 · **Prompt:** `04-module-or-group-fix-tdd.md` (via `outputs/EXECUTION-TODO.md` Track 2) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Commit:** `57b96bef` · **Superpowers:** Yes (Vertical TDD + verification-before-completion). Type: FE-only (backend untouched).

## §15 pre-flight (mandatory)
Verified the CURRENT generated SDK before wiring (not trusting the Batch A report): `CarryOverTreatmentsResponse = { carriedOver: DentalTreatment[], restoredDismissed: DentalTreatment[], message }`, request `{ sourceVisitId?, restoreDismissedIds? }`, `DentalTreatment` carries `carriedOver` + `sourceVisitId`. Hook = `carryOverTreatmentsMutation` from `@monobase/sdk-ts/generated/react-query`. Contract pin already present (dental-visit.hurl §carry-over, from Batch A). Shape verified-correct → no TypeSpec/SDK change.

## The blocker the fix-ready plan missed (mechanism deviation)
The plan assumed carry-over = "auto-discover the prior visit's diagnosed/planned treatments." But the **visit-completion gate** (`updateDentalVisit.ts:136`, `VISIT_HAS_OPEN_TREATMENTS`) **forbids completing a visit that still has diagnosed/planned treatments**. Consequences (all verified in source + live):
- A returning patient's prior visits are all *completed* (one-open-visit rule) → they retain **no** diagnosed/planned work → auto-discovery carries nothing, and a candidate-gate on the treatment-plan's diagnosed/planned is always false.
- This defeats even the **demo seed**: `seed-demo.ts:completeVisit` resolves planned→performed before completing, so Ana Reyes's (P5, "carry-over case") V2 completes with the cleaning at **performed**, and her V3 auto-discovery carry-over (`{}` body) carries **0**. The seed comment ("D1110 left at planned") is stale.
- The functional, FR1.11-aligned path is **dismiss-to-defer → restore-next-visit** (the **Maria** seed pattern, lines 838-888): a *dismissed* treatment survives the gate and is restored into the next visit via `restoreDismissedIds`.

**Resolution (product-confirmed 2026-06-12):** redesign the affordance to **restore-dismissed**, FE-only, prioritising long-term stability.

## Real bug found + fixed (treatment-table coherence)
Wiring carry-over exposed a latent double-count: a carried row lives in BOTH the current visit's `treatments` (carriedOver=true once restored) AND the plan-derived `carriedOverItems`, so it rendered twice and the **Grand Total double-counted it**. Fixed by excluding `carriedOver` rows from the main list + `thisVisitTotal` (`nativeTreatments`) → each carried row is displayed and totalled once (carried section). RED→GREEN; valid independent of the carry-over mechanism. (The existing coherence fixtures only used disjoint props, so the overlap state was uncovered.)

## Shipped
| Unit | What |
| --- | --- |
| `CarryOverPrompt` + test | New-visit-entry-point prompt; when the previous visit has DEFERRED (dismissed) treatments, offers to restore them into the just-created visit via the canonical endpoint (`restoreDismissedIds`). Self-gates on candidates. SDK (no raw fetch). |
| `useCarryOverTreatments` + test | Mutation; on success invalidates the destination visit's treatment list + the patient treatment-plan aggregate (carried rows + chart amber rings); BE-authored success toast. |
| `usePreviousVisitDeferred` + test | Reads the previous visit's treatments → dismissed ids (getTreatmentPlan excludes dismissed). FE-only candidate source. |
| `treatment-table.tsx` coherence fix + test | `nativeTreatments` dedup (above). |
| `_workspace/$patientId.tsx` | Opens the prompt after a new visit is created; passes `deferredIds`. |
| `returning-patient-carryover-ui.spec.ts` | E2E: dismiss-to-defer on Visit A → New Visit → prompt → restore → restored row renders once. |

## Verification (fresh)
| Layer | Result |
| --- | --- |
| treatment-table coherence | RED→GREEN (19/19) |
| CarryOverPrompt / usePreviousVisitDeferred | RED→GREEN (5/5 + 2/2; prompt asserts `restoreDismissedIds` in the body) |
| Full FE unit suite | **2336 / 0** (211 files) |
| Returning-patient restore-dismissed **E2E** (chromium, real API) | **1 passed** |
| Root typecheck (FE + api-ts) + eslint | exit 0 / 0 errors (2 pre-existing warnings) |
| Backend / contract | unchanged (Batch A already pinned carry-over; no wire change) |

## Follow-up surfaced (roadmap)
The carry-over **auto-discovery** path and the demo seed's **Ana/Elena "planned-on-completed"** carry-over scenarios are **dead under the completion gate** (Ana's demo carry-over visibly carries 0). Recommend a product/seed reconcile: either (a) update the demo to the dismiss-to-defer pattern for all carry-over personas, and/or (b) decide whether auto-discovery should be removed or the completion gate relaxed. Tracked in EXECUTION-TODO Track 2.

## Not implemented (still per plan §9–§11)
Batch C (FIX-005 rbac + FIX-006 docs), Batch D (FIX-004 lock cron), Batch E (FIX-003 viewer wiring — waits on case-presentation). No FSM/handler/scheduler changes.

---

# AHA Fix Report: Dental Visit & Charting — GAP-2 Templates (decision #13, WIRE FE)

**Executed:** 2026-06-13 · **Driver:** `outputs/EXECUTION-TODO.md` Track 3 (#13) · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Commits:** `ca6527c2` (Slice 0 contract) → `179f1d8a` (Slice 1 settings panel) → `298394ec` (Slice 2 apply + E2E/docs-close). **Superpowers:** Vertical TDD + verification-before-completion.

Decision #13 took the **deviation** path (product-decisions.md): WIRE the templates FE now (not park), **keep** the seeded templates. The fix-ready plan had this as a blocked item (§9, Q1).

## §15 — FIX-001 was INCOMPLETE (the load-bearing pre-work was real)

FIX-001 (Batch A, 2026-06-11) reconciled the template *body* shapes but left two residual drifts that block the FE wire:

1. **`listTreatmentTemplates` missing the required `branchId` query param.** The handler reads `ctx.req.query('branchId')` and throws when absent (`treatmentTemplates.ts:49`), but the op declared **no `@query`** → the generated SDK had `query?: never` (could not send it) and a missing param hit a bare `throw new Error` → **500**. This is the exact createMember-class drift FIX-001 fixed for `getTreatmentPlan` but did not apply here. **Fix:** `@query branchId: UUID` (+ `ApiBadRequestResponse`) → SDK sends it + the generated query validator returns a clean **400**. Wiring before this would have coded the list hook against a type that can't send the param.
2. **`applyTemplate` declared `ApiOkResponse` (200) but the handler returns 201** (it creates treatment rows) and the Hurl pin already asserts 201. **Fix:** moved to `ApiCreatedResponse`. SDK response type is unchanged (`ApplyTemplateResponse`); hey-api registers the `responseTransformer` unconditionally and runs it on any 2xx body, so `data.count` is still correct at 201.

Regen window verified safe — **0 FE consumers** of any template op (grepped). Also dropped the now-stale `treatments:'stub'` placeholder + lying comment from `seed-demo.ts` (the validator accepts `items[]` post-FIX-001). RED→GREEN contract pin: `GET /dental/treatment-templates` without `branchId` → 400 (was 500). Regen diff is template-scoped only (verified).

## Shipped

| Slice | Unit | What |
| --- | --- | --- |
| 0 | `dental-visit.tsp` + regen + `dental-visit.hurl` + seed | the §15 reconcile above |
| 1 | `features/settings/components/treatment-templates.tsx` + hook + registry | Settings → **Treatment Templates** panel (mirrors ConsentTemplates): owner-only create/edit/soft-delete with a dynamic items editor (CDT code + description + price). Price entered in pesos → `priceCents` on the wire (`Math.round(pesos*100)`) — **unit trap pinned** (1200→120000). Reads the `{ templates: [...] }` envelope via the reconciled `@query branchId`. |
| 2 | `features/workspace/components/apply-template-button.tsx` + `use-apply-template.ts` + `$patientId.tsx` mount | **Apply Template** affordance in `workspace-table-zone` ABOVE the table (fix-ready Q2 "treatment-table area"), gated on `currentVisitId && !isReadOnly` so it's reachable on an **empty** visit — the primary "populate this visit from a template" case (the table early-returns on empty, so a header-only control could not reach it). Owner/associate-only (parity with backend `assertBranchRole`); the role check sits in an outer gate component so non-clinical roles never fire the template fetch. On success invalidates the visit treatment list + the patient treatment-plan aggregate (same keys as carry-over) → new `planned` rows surface in the table + chart layers. SDK-only. Empty-templates → a "configure in Settings" nudge. |

## Affordance placement (Q2) — fork resolved inline

Tracing surfaced a genuine fork the fix-ready Q2 default ("treatment-table header action") could not satisfy: **TreatmentTable early-returns on an empty visit BEFORE its header** (`treatment-table.tsx:180`), and an empty visit is the primary apply-template target. Resolution that honours the Q2 intent ("treatment-table area, always discoverable mid-visit") without a product fork: mount the control in the `workspace-table-zone` directly above the table, so it renders for any active editable visit regardless of rows. No AskUserQuestion needed.

## Adversarial review (3 parallel reviewers) — both "MAJOR"s verified away

- **[INVALID] cancelled-visit write gap** (Lens B) — hallucinated a non-existent status. The enum is `draft|active|completed|locked|discarded` (`visit.schema.ts:64`); `applyTemplate`'s completed/locked guard **exactly matches** the canonical `createDentalTreatment.ts:51` treatment-write guard. No fold.
- **[INVALID] empty-items → wrong error shape** (Lens A) — `errors.ts:320/367` maps a thrown `ZodError` to a **400 ValidationError** envelope, so the handler's self-validation returns a proper 400, not a 500/shape-mismatch. No fold.
- **[FOLDED NIT]** split `ApplyTemplateButton` so the data hooks run only for owner/associate (non-clinical roles no longer fire a wasted template fetch).
- **[FOLDED NIT]** added an Edit-absent assertion to the non-owner panel test.

## Verification (fresh)

| Layer | Result |
| --- | --- |
| Contract (`CONTRACT_ONLY=dental-visit`, server restarted after regen) | **67/67** |
| Backend treatment-templates | **32/0** |
| FE: treatment-templates panel / apply-template-button | **8/0** / **4/0** |
| Full FE unit suite | **2455/0** (225 files) |
| Create→apply **E2E** (chromium, live API): Settings create → workspace apply → planned row renders | **1 passed** |
| Typecheck FE + api-ts + sdk-ts · lint | exit 0 · 0 errors |

## Residuals / roadmap (deferred — not in #13 scope)

| Item | Why deferred |
| --- | --- |
| Backend template create/update/delete gate only on branch membership (no owner role) | FE gate is intentionally stricter; backend owner-parity is a hardening gap (applyTemplate IS owner/associate-gated). |
| `deleteTreatmentTemplate` returns `{success:true}` vs TypeSpec `ApiOkResponse<{}>` | NIT, 0 consumers read the delete body. |
| create/update return the raw DB row superset (`createdBy`/`updatedBy`) vs the `TreatmentTemplate` model | harmless JSON superset; no consumer references the undeclared fields. |
| `getTreatmentPlan` `byTooth` items omit `carriedOver`/`toothNumber` | pre-existing FIX-001 Batch A residual (already logged). |
