# Appendix A — Visit lifecycle + FSMs

**Chunk A scope:** visit FSM (`draft/active/completed/locked/discarded`), treatment FSM
(`diagnosed/planned/performed/verified/dismissed/declined`), treatment-plan
phasing/versioning/carry-over/option-groups.
**Backend:** `services/api-ts/src/handlers/dental-visit/` (+ `dental-patient/treatment-plans/`).
**FE:** `apps/dentalemon/src/features/workspace/` + `routes/_workspace/$patientId.tsx`.

Sources of truth read: `treatment.schema.ts`, `visit.schema.ts`, `br-registry.json`
(BR-001/003/005/006/007/008, BR-VIS-009/010, TP-BR-005), `docs/product/modules/dental-visit/MODULE_SPEC.md`,
`MASTER-GAP-MATRIX.md`, `.understand-anything/contract-spine.json` (357 ops; consumer counts
cited inline). Executive summary intentionally omitted (synthesizer owns it).

Citations are `file:line` or doc-id. `[ASSUMPTION]` marks anything unverifiable.

---

## (2) Baseline inventory — IMPLEMENTED workflows + business rules

| Workflow / rule | FE entry (`file:line`) | Backend handler / endpoint | Governing ids | Test coverage |
|---|---|---|---|---|
| WF-007/045 Create visit (draft) | `use-create-visit.ts:34` (POST then PATCH→active) | `createDentalVisit.ts` `POST /dental/visits` | BR-001, V-VIS-002/003, E3 visitType, GAP-001 localId | backend `dental-visit.test.ts`; FE `use-create-visit.test.ts`; contract `dental-visit.hurl` |
| Visit draft→active (check-in/activate) | `use-create-visit.ts:38` (PATCH `{status:'active'}`) | `updateDentalVisit.ts:73-102` | BR-002, BR-001 re-guard, DE-001 audit | `dental-visit.treatment-status-transitions.test.ts`; `dental-visit-events.test.ts` |
| WF-012 Complete visit | `$patientId.tsx` complete action; `pre-completion-checklist.tsx` | `updateDentalVisit.ts:104-168` | BR-002/003/005/014, V-VIS-004, AUD-BR-004 fail-closed | `dental-visit.test.ts`; `pre-completion-checklist.test.ts` |
| WF-046 Lock completed visit | (none — no FE call) | `updateDentalVisit.ts:170-185` `repo.lock()` | BR-002, DE-003 | `repos/visit.test.ts`; **no job** (see SEQ-A gap O-A03) |
| Discard open visit (owner escape hatch) | `use-discard-visit.ts`; `$patientId.tsx:202-215` | `discardVisit.ts` `POST /dental/visits/{id}/discard` | V-VIS-DISCARD, BR-005-adjacent, fail-closed audit | `visits/discardVisit.test.ts`; `use-discard-visit.test.ts` |
| BR-005 Auto-discard empty visit (flag-gated) | — | `updateDentalVisit.ts:113-133` (`DENTAL_VISIT_AUTO_DISCARD`) | BR-005, V-VIS-004, ADR-010 | `dental-visit.test.ts` (flag on/off) |
| BR-001 No concurrent active visit | `visit-status.ts:canStartNewVisit`; `$patientId.tsx:119` | `createDentalVisit.ts:43-49`; `updateDentalVisit.ts:76-82`; partial unique idx `visit.schema.ts:50-52` | BR-001, V-VIS-003 | `business-rules.test.ts`; `dental-visit.cross-tenant-rbac.test.ts` |
| WF-009 Create treatment | `tooth-slideout.tsx`; `use-save-treatment.ts` | `createDentalTreatment.ts` `POST /visits/{id}/treatments` (cons=3) | BR-003, EC2 extracted-tooth, P1-18 phase/priority, dental-org G2 fee default, GAP-001 | `dental-treatment.test.ts`; `dental-treatment.fee-default.test.ts`; `dental-visit.hurl §8` |
| WF-010 Mark performed (two-step FIX-01) | `use-mark-treatment-done.ts` | `updateDentalTreatment.ts` `PATCH …/{tid}` (cons=3) | BR-006/007, P0-003 consent gate, DE-005 audit | `dental-visit.treatment-status-transitions.test.ts`; `treatment-fsm-http.test.ts`; `treatment.fsm.property.test.ts` |
| Treatment dismiss (clinician) | `treatment-row-popovers.tsx` | `updateDentalTreatment.ts:80-97` `repo.dismiss` | BR-006, V-VIS-006 audit, TR-P1-08 recompute | `dental-visit.treatment-status-transitions.test.ts` |
| Treatment decline (patient refusal) | `treatment-decline.test.ts`; `treatment-row-popovers.tsx` | `updateDentalTreatment.ts:100-121` `repo.decline` | BR-006, REFUSAL_REASON_REQUIRED, V-VIS-006 | `repos/treatment-decline.test.ts`; `treatment-decline.test.ts` (FE) |
| BR-007 Performed/verified field-immutable | enforced in FE read-only too | `updateDentalTreatment.ts:52-55` | BR-007, AC-VIS-003 | `dental-visit.treatment-status-transitions.test.ts` |
| BR-008 Carry-over treatments | (no FE trigger — **KNOWN G1**) | `carryOverTreatments.ts` `POST /visits/{id}/carry-over` (**cons=0**) | BR-008, FR1.11, EM-VIS-002 | `dental-visit.treatment-templates.test.ts`; `chart/chart-carryover.test.ts` |
| Treatment-plan presentation (live aggregate) | `treatment-plan-tab.tsx`; `use-treatment-plan.ts` | `getTreatmentPlan.ts` `GET /patients/{id}/treatment-plan` (cons=1) | FR1.22, P1-18 phasing, BR-VIS-010, CHART-XV completedToothNumbers | `__tests__/treatment-plan-tab.test.ts`; `use-treatment-plan.test.ts` |
| Treatment-plan accept (version snapshot) | `consent-sheet.tsx` (consentFormId link) | `acceptTreatmentPlan.ts` `POST …/treatment-plan/accept` (cons=1) | BR-VIS-010, append-only `treatment_plan_versions` | `dental-visit.treatment-plan-versioning.test.ts` |
| Accepted-plan version viewer | (none — **KNOWN G2**) | `getTreatmentPlanVersion.ts` (**cons=0**) | BR-VIS-010 | `dental-visit.treatment-plan-versioning.test.ts` |
| Treatment-plan header FSM (approve/derive) | (none — **KNOWN dental-patient G9**) | `approveTreatmentPlan.ts` (**cons=0**), `treatment-plan.repo.ts:82 recomputeStatus` | TP-BR-005, TR-P1-08, CR-05, P2-8 history | `approveTreatmentPlan.test.ts`; `treatment-plan-derivation.test.ts`; `treatment-plan-item-completion.test.ts` |
| Alternate option-group accept | `use-treatment-options.ts`; `listTreatmentOptionGroup` (cons=1) | `acceptTreatmentOption.ts` (cons=1); facade `visit-treatment-plan.facade.ts:96` | P1-19 | `dental-patient/treatment-option-group.test.ts` |
| Plan item → appointment link (P1-21) | (none — **KNOWN G9**) | `attachTreatmentAppointment.ts` / `detach…` (**cons=0**) | P1-21 | covered in treatment-plan repo tests |
| Treatment templates (apply) | (none — **KNOWN G3**) | `applyTemplate.ts` (**cons=0**) | BR-VIS-009 | `dental-visit.treatment-templates.test.ts`; `dental-visit.cross-tenant-rbac.test.ts` |
| GAP-001 idempotent localId (offline) | client localId on create | `createDentalVisit.ts:57`, `createDentalTreatment.ts:88` | GAP-001 | `gap-001-localid.test.ts` |

Deferred/interim markers in scope: **ADR-010** (auto-discard flag, default OFF),
**ADR-008** read-time-interim (chart layers, lives in Chunk B), **ADR-006** (no event
bus — DE-00x are audit-log markers only). MASTER-GAP-MATRIX known gaps in chunk:
dental-visit **G1/G2/G3/G4/G5/G6**, dental-patient **G9/G11**.

---

## (3) Per-family sequencing analysis + ordering-gap list

### Family 1 — Visit lifecycle FSM
```
[create POST draft] → [PATCH active] → … chart/treatments/notes/consent … → [PATCH completed] → [lock]
  pre: branch role (owner/assoc; +hygienist if hygiene)    pre: status=active, no open treatments,
  pre: no other active visit for patient (BR-001)               signed consent (BR-014), notes exist
  post: localId persisted (GAP-001)                         post: immutable (BR-003); invoice/PMD unlocked
                              ↘ [discard] (owner-only, no durable artifact) → dismisses open treatments
```
- **VISIT_TRANSITIONS** (`visit.schema.ts:64`): `draft→active`, `active→{completed,discarded}`,
  `completed→locked`, `locked/discarded` terminal. Enforced in `updateDentalVisit.ts:44-52`.
- Complete-visit guards are **ordered**: empty-auto-discard (flag) → open-treatments → consent → notes
  (`updateDentalVisit.ts:121-146`). Consent + notes are post-conditions of completion, not the chart.

### Family 2 — Treatment FSM
```
diagnosed → planned → performed → verified
   ↘ dismissed (clinician)   ↘ declined (patient, pre-performed only)
```
- **TREATMENT_TRANSITIONS** (`treatment.schema.ts:167`); forward-only, dismissed/declined terminal.
  `performed`/`verified` cannot reach `declined` (`treatment.schema.ts:170-173`).
- `→performed` gated on signed consent (`updateDentalTreatment.ts:70-77`, P0-003).
- Mark-Done is a **two-step write** (`use-mark-treatment-done.ts`): `diagnosed→planned→performed`.
  Self-heals on partial failure (lands `planned`, re-click completes). This is the **FIX-01 reference pattern.**

### Family 3 — Treatment-plan phasing / versioning / carry-over
- **Phasing (P1-18):** `TREATMENT_PHASE_ORDER` (`treatment.schema.ts:52`); plan sorts by
  (phase, priority, insertion) in `getTreatmentPlan.ts:99-107`. Unphased → rank 99.
- **Two parallel "accept" systems (MASTER-GAP-MATRIX §H "approval two paths"):**
  1. **Version-snapshot** — `acceptTreatmentPlan.ts` writes append-only `treatment_plan_versions` (immutable).
  2. **Header-FSM** — `dentalTreatmentPlans` with `deriveTreatmentPlanStatus` (`treatment-plan.schema.ts:56`):
     `approved/scheduled → partially_completed → completed`; dismissed/declined excluded from denominator (TP-BR-005).
  These are **not reconciled**: a `POST /accept` snapshot does not move the header FSM, and `approve` does not snapshot a version.
- **Option groups (P1-19):** `acceptTreatmentOption` sets chosen→`planned`, siblings→`declined`
  (`visit-treatment-plan.facade.ts:96-125`).
- **Carry-over (BR-008):** `carryOverTreatments.ts` copies pending rows to new visit (`carriedOver=true,
  sourceVisitId`). Explicit `sourceVisitId` or auto-discovery (last 5 visits). Cross-branch source allowed (MODULE_SPEC §13 drift, decision-pending).

### Ordering-gap list (probed against Step 2)
- **O-A01** Two-step Mark-Done (`use-mark-treatment-done.ts`) and two-step create-then-activate
  (`use-create-visit.ts:34-42`) are **not idempotent on the PATCH leg** — GAP-001 localId covers only the POST.
  A retried activate after a network blip can race the BR-001 unique index. → register **GAP-A01**.
- **O-A02** `acceptTreatmentOption` (`visit-treatment-plan.facade.ts:103-123`) performs **two separate
  UPDATEs with no transaction** — partial failure leaves the chosen option `planned` while siblings stay
  un-declined (double-accept window). → register **GAP-A02**.
- **O-A03** No **scheduled lock job** for completed→locked (WF-046 `[INFERRED]`; only manual PATCH reaches
  `repo.lock`, FE never sends it). Completed visits stay `completed` forever; the `locked` immutability tier
  is effectively unreachable in prod. → register **GAP-A03**.
- **O-A04** Option-group accept and carry-over **bypass `TREATMENT_TRANSITIONS`**: they write
  `status='planned'`/`'declined'` directly (`visit-treatment-plan.facade.ts:105,115`; `carryOverTreatments.ts:106`)
  rather than through the validated FSM path in `updateDentalTreatment`. A `performed`/`verified` sibling
  could in principle be force-declined by a malformed group. → register **GAP-A04**.
- **O-A05** `acceptTreatmentPlan` (version snapshot) writes **no audit row**, and **does not move the
  header FSM** — the two plan systems drift on accept (versioned-but-not-approved, or approved-but-no-version). → register **GAP-A05**.
- **O-A06** Carry-over from a **completed/locked or discarded** source is not blocked — auto-discovery
  pulls pending rows from any prior visit regardless of source status (`carryOverTreatments.ts:74-90`).
  `[ASSUMPTION]` no rule forbids carrying from a discarded source whose treatments were already dismissed-then-edited. → register **GAP-A06**.
- **O-A07** `→performed` requires signed consent, but **carry-over → planned → performed** can occur in a
  *new* visit whose consent is for a different procedure set; the consent gate is visit-scoped
  (`updateDentalTreatment.ts:70-77` via `hasSignedConsentForVisit`), not treatment-scoped. → register **GAP-A07**.

---

## (4) Gap & candidate register

Schema: `| id | finding | chunk | IMPLEMENTED|KNOWN|NEW | lenses{S,R,O,C} | KG-node | MODULE/WF-id | BR-id | spine-op/handler | severity | blast-radius |`

| id | finding | chunk | class | lenses | KG-node | MODULE/WF | BR-id | spine-op/handler | severity | blast-radius |
|---|---|---|---|---|---|---|---|---|---|---|
| GAP-A01 | Two-step create→activate & Mark-Done PATCH leg not idempotent; retried activate races BR-001 unique index | A | NEW | S,O | Visit/Treatment | dental-visit / WF-007,WF-010 | proposed **BR-A01** (activate/perform PATCH must accept localId / be retry-safe) | updateDentalVisit / use-create-visit.ts:38 | P2 | data-loss |
| GAP-A02 | `acceptTreatmentOption` does 2 un-transactioned UPDATEs; partial failure → chosen planned + siblings not declined (double-accept) | A | NEW | S,C | Treatment | dental-patient (P1-19) / spec-gap no WF | proposed **BR-A02** (option accept atomic: chosen+siblings in one tx) | acceptTreatmentOption / visit-treatment-plan.facade.ts:96 | P2 | data-loss |
| GAP-A03 | No scheduled visit-lock job (completed→locked); `locked` tier unreachable in prod | A | KNOWN | S,C | Visit | dental-visit / WF-046 [INFERRED] | BR-002 (gap), proposed **BR-A03** | (no job) updateDentalVisit.ts:170 | P2 | cosmetic |
| GAP-A04 | Option-accept & carry-over write treatment status directly, bypassing TREATMENT_TRANSITIONS guard | A | NEW | S,C,R | Treatment | dental-visit / WF-009 | BR-006 (strengthen) | acceptTreatmentOption, carryOverTreatments | P2 | data-loss |
| GAP-A05 | `acceptTreatmentPlan` (version snapshot) writes no audit row AND doesn't move header FSM — two plan systems drift on accept | A | KNOWN | S,R,C | TreatmentPlan | dental-visit G2 + MASTER-GAP §H "approval two paths" | proposed **BR-A05** (designate canonical accept; audit it) | acceptTreatmentPlan.ts:75 | P1 | data-loss |
| GAP-A06 | Carry-over auto-discovery does not gate on source visit status (can pull from discarded/locked source) | A | NEW | S,C | Visit/Treatment | dental-visit / WF-033 | BR-008 (strengthen: source must be completed/locked) | carryOverTreatments.ts:74 | P3 | cosmetic |
| GAP-A07 | `→performed` consent gate is visit-scoped, not treatment/procedure-scoped; carried-over item can be performed under unrelated consent | A | NEW | S,C,R | Consent/Treatment | dental-visit / WF-010 | BR-014 (strengthen scope) | updateDentalTreatment.ts:70 | P2 | cross-tenant→clinical-correctness |
| GAP-A08 | Carry-over has no FE trigger (cons=0); "Carried Over" subtotal only renders from seed | A | KNOWN | S | TreatmentPlan | dental-visit **G1** | BR-008 | carryOverTreatments (cons=0) | P1 | cosmetic |
| GAP-A09 | Accepted-plan version viewer unwired (cons=0) | A | KNOWN | S | TreatmentPlanVersion | dental-visit **G2** | BR-VIS-010 | getTreatmentPlanVersion (cons=0) | P2 | cosmetic |
| GAP-A10 | Plan header FSM (approve/derive/status-history/appt-link) unwired (cons=0) | A | KNOWN | S | TreatmentPlan | dental-patient **G9** | TP-BR-005, P1-21, P2-8 | approveTreatmentPlan/attach/list…StatusHistory (cons=0) | P2 | cosmetic |
| GAP-A11 | Treatment templates built+seeded, zero FE | A | KNOWN | S | Treatment | dental-visit **G3** | BR-VIS-009 | applyTemplate (cons=0) | P2 | cosmetic |
| GAP-A12 | FE affordance ≠ RBAC: chart-edit / treatment affordances shown to roles backend rejects | A | KNOWN | R | Visit/Treatment | dental-visit **G4** | BR-006 perms | createDentalTreatment / updateTooth | P2 | cosmetic |
| GAP-A13 | Cross-branch carry-over source allowed (patient-scoped, not branch-scoped) — drift vs original "blocked" intent | A | KNOWN | R | Visit | dental-visit / MODULE_SPEC §13 | BR-008 (decision-pending) | carryOverTreatments.ts:68 | P3 | cross-tenant |
| CAND-A14 | **Visit amendment / late-entry on locked visit** — real practices need post-lock corrigenda (addendum exists for notes, not for treatments/chart). Append-only amendment record. | A | NEW | S,C,R | Visit/Treatment | dental-visit / new WF | proposed **BR-A14** (locked-visit corrections are additive amendments, never edits; BR-019 extension) | createAmendment (notes only today) | P2 | data-loss |
| CAND-A15 | **Re-open / reverse a wrongly-completed visit** — no path; only discard (open-only) or amend. Owner-only reverse-with-reason. | A | NEW | S,R,C | Visit | dental-visit / new WF | proposed **BR-A15** (completed→active reversal owner-only, audited, blocked once billed/PMD-sealed) | (none) | P2 | data-loss |
| CAND-A16 | **Plan re-sequencing / phase change after acceptance** — phase/priority editable even on performed items (`updateDentalTreatment.ts:135`), but no versioning of the *sequence* the patient accepted. | A | NEW | S,C | TreatmentPlan | dental-patient / new WF | proposed **BR-A16** (accepted plan sequence is snapshotted; re-sequence creates a new version) | getTreatmentPlan / acceptTreatmentPlan | P3 | cosmetic |
| CAND-A17 | **Plan expiry / re-presentation** — accepted estimates go stale (fee schedule changes); no expiry or "estimate as-of" stamp on the live aggregate (only `cdtCodeSetYear` on header). | A | NEW | C,S | TreatmentPlan | dental-patient / new WF | proposed **BR-A17** (live plan estimate carries an as-of timestamp; accepted version freezes prices) | getTreatmentPlan.ts:94 | P3 | money |
| CAND-A18 | **Concurrent-edit conflict on a treatment across two devices (offline P2P)** — last-write-wins on `dental_treatment` rows; no per-field merge or status-monotonicity guard, so an offline `dismissed` can clobber a synced `performed`. | A | NEW | O,S,C | Treatment | dental-visit / cadence | proposed **BR-A18** (treatment status merge is monotonic along the FSM; never regress performed→planned on sync) | updateDentalTreatment / cadence | P1 | data-loss |
| CAND-A19 | **Two open visits across two devices** — BR-001 enforced by a DB unique index + app guard, but offline P2P could create two `active` rows that collide only on sync (no offline resolution rule). | A | NEW | O,R,S | Visit | dental-visit / cadence | proposed **BR-A19** (offline concurrent active-visit creation resolves to one; loser → discarded with audit) | createDentalVisit / cadence | P1 | data-loss |
| CAND-A20 | **Audit ordering on multi-write plan accept** — `acceptTreatmentPlan`/`acceptTreatmentOption`/`carryOverTreatments` emit no audit row, so the compliance trail is missing for clinically-material plan transitions (contrast: decline/dismiss/approve all audit). | A | NEW | R,C,S | TreatmentPlan/Treatment | dental-audit / dental-visit | proposed **BR-A20** (every terminal plan/option/carry transition writes a fail-closed audit row) | acceptTreatmentPlan/Option/carryOver | P1 | PHI-leak (absent trail) |

Verified-NOT-gaps (negative claims checked): BR-006 FSM enforcement is **fully tested** (3 test files +
property test — not "partial"); decline/dismiss **do** audit + recompute plan (`updateDentalTreatment.ts:84-119`);
`approveTreatmentPlan` **does** audit fail-closed (`approveTreatmentPlan.ts:95`); the dental-patient
`acceptTreatmentPlan.ts` is a **re-export shim, not a duplicate impl**; `discardVisit` **is** FE-wired
(`use-discard-visit.ts`) despite being absent from the (slightly stale) contract-spine.

---

## (5) TDD-ready slices (value-ordered, `SL-A01…`)

Run conventions (per `VERTICAL_TDD.md`): backend tests **from `services/api-ts/`** via
`bun run scripts/test-with-db.ts <file>` with
`DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test` (per-file, never
`bun test <path>`); contract `*.hurl` via `scripts/run-contract-tests.ts` (**restart API server first**);
FE unit (DentalChart globally stubbed — assert pure fns, not chart DOM); E2E self-seeded via
`tests/e2e/helpers/e2e-seed.ts`. Gate every slice: api-ts `bunx tsc` + `bun run check:boundaries` +
backend + contract + FE tsc/unit + E2E, no regressions.

### SL-A01 — Audit + canonicalize plan-accept (GAP-A05, GAP-A20) — P1, highest value
- **Steps:** 3-6 (backend-only; no new UI). Designate `acceptTreatmentPlan` (version snapshot) as the
  canonical patient-facing accept; on accept also write a fail-closed audit row and recompute the header
  FSM (or explicitly document the one-way relationship). Same audit treatment for `acceptTreatmentOption`
  and `carryOverTreatments`.
- **RED tests first:**
  - backend `dental-visit/treatments/accept-plan-audit.test.ts` — accept writes a `treatment_plan.accepted`
    audit row (spy on audit insert → 5xx when it fails, RED-before); option-accept + carry-over likewise.
  - contract `specs/api/tests/contract/dental-treatment-coordinator.hurl` §accept-audit — accept → 201, then
    audit list contains the row.
- **AC/BR:** binds proposed **BR-A05**, **BR-A20**; strengthens BR-VIS-010, AUD-BR-004 (fail-closed).
- **FSM change:** none to transition tables; optionally wire `recomputeStatus` after snapshot accept.
- **depends:** none.

### SL-A02 — Monotonic treatment-status merge for offline sync (CAND-A18) — P1
- **Steps:** 3-4 (backend/lib). Add a pure merge guard so a sync apply never regresses a treatment along
  the FSM (`performed`→`planned`/`diagnosed` rejected); reuse `TREATMENT_TRANSITIONS` as the ordering oracle.
- **RED tests first:**
  - backend `dental-visit/treatment-sync-merge.test.ts` — applying an older offline `{status:'planned'}`
    over a synced `performed` is a no-op/conflict, not a regression.
  - property test `treatment.fsm.merge.property.test.ts` (à la `treatment.fsm.property.test.ts`) — merge is
    monotone: `rank(merged) >= rank(local)` for all state pairs.
- **AC/BR:** proposed **BR-A18**; strengthens BR-006.
- **FSM change:** add a derived `TREATMENT_RANK` ordering beside `TREATMENT_TRANSITIONS`.
- **depends:** none. (Cross-ref Chunk F cadence; Chunk B per-tooth merge is sibling.)

### SL-A03 — Atomic option-group accept + FSM-validated writes (GAP-A02, GAP-A04) — P2
- **Steps:** 3-6. Wrap `acceptTreatmentOption`'s chosen+siblings updates in one `db.transaction`; route the
  status writes through the validated transition guard (reject force-declining a `performed`/`verified` sibling).
- **RED tests first:**
  - backend `dental-patient/option-accept-atomic.test.ts` — inject a sibling-update failure → chosen NOT left
    `planned` (rollback); a `performed` sibling in the group → 422, not silently declined.
  - contract `dental-treatment-coordinator.hurl` §option-accept — accept one → siblings declined in one round-trip.
- **AC/BR:** proposed **BR-A02**; strengthens BR-006, P1-19.
- **depends:** none.

### SL-A04 — Wire carry-over FE trigger + source-status guard (GAP-A08, GAP-A06) — P1 (decision-gated by MASTER-GAP-MATRIX OQ#9)
- **Steps:** full 1-9 if endpoint shape changes; else 7-9 (FE) + 3-4 guard. Add a "Carry over from previous
  visit" affordance in `treatment-plan-tab.tsx`/timeline; backend gates source to completed/locked visits.
- **RED tests first:**
  - FE `use-carry-over.test.ts` — trigger fires `POST /carry-over`, populates the response into the plan.
  - backend `carry-over-source-guard.test.ts` — carry from a `discarded`/`draft` source → 422.
  - E2E `carry-over.spec.ts` — perform on visit 1 incomplete → start visit 2 → carry-over → item appears,
    not double-charged; read-path regression on `listDentalTreatments`.
- **AC/BR:** BR-008 (strengthen), proposed **BR-A06**; binds AC-VIS-005.
- **depends:** SL-A01 (audit on carry-over).

### SL-A05 — Offline concurrent active-visit resolution (CAND-A19) — P1
- **Steps:** 3-4 (+cadence merge rule). On sync, if two `active` visits exist for one patient, deterministically
  keep one (earliest `createdAt`/lowest id) and `discard` the loser with an audit row + reason.
- **RED tests first:**
  - backend `concurrent-active-visit-resolution.test.ts` — two offline `active` rows merge to exactly one
    active + one discarded (audited); BR-001 unique index never throws raw 500 on sync.
- **AC/BR:** proposed **BR-A19**; strengthens BR-001.
- **depends:** SL-A02 (shared sync-merge harness). Cross-ref Chunk F.

### SL-A06 — Visit-lock scheduled job (GAP-A03) — P2 (decision: is locked tier in V1?)
- **Steps:** 3-4. Add a pg-boss/cron job that locks visits `completed` for > N hours (config flag), reusing
  `repo.lock` + DE-003 audit. Mirrors `dental-patient/jobs/recallDispatch`.
- **RED tests first:**
  - backend `visit-lock-job.test.ts` — a completed visit older than threshold → locked + `visit.locked` audit;
    a recently-completed one is untouched.
- **AC/BR:** BR-002/003, proposed **BR-A03**.
- **depends:** none. **[ASSUMPTION]** locked tier is wanted in V1 — confirm before building (it is currently
  unreachable, so the cost of leaving it is only a missing immutability escalation).

### SL-A07 — Treatment-scoped consent gate for carried-over performs (GAP-A07) — P2
- **Steps:** 3-4. Tighten the `→performed` consent check so a carried-over treatment requires consent covering
  *that* procedure/plan, not merely any signed consent on the new visit.
- **RED tests first:**
  - backend `carryover-perform-consent.test.ts` — carry over → plan → perform with only an unrelated consent → 422.
- **AC/BR:** BR-014 (strengthen scope), proposed **BR-A07**.
- **depends:** SL-A04 (carry-over must be reachable to exercise this). Cross-ref Chunk C (consent).

### SL-A08 — Locked-visit treatment/chart amendment record (CAND-A14) — P2
- **Steps:** full 1-9. Extend the existing notes-amendment pattern (`createAmendment`) to treatments/chart:
  an append-only correction on a locked visit, never an in-place edit (BR-019).
- **RED tests first:**
  - backend `treatment-amendment.test.ts` — amend a locked-visit treatment → new amendment row, original
    immutable; PATCH on the original still 422.
  - FE `amendment-form.test.ts` (extend) — amendment surfaces on a locked visit.
  - E2E `locked-visit-amendment.spec.ts`.
- **AC/BR:** proposed **BR-A14**; extends BR-003/BR-019.
- **depends:** SL-A06 ([ASSUMPTION] only meaningful if locked visits actually occur). 

### SL-A09 — Owner reverse/re-open of a wrongly-completed visit (CAND-A15) — P2
- **Steps:** 3-6. Add `POST /dental/visits/{id}/reopen` (owner-only, reason, audited) allowing `completed→active`
  **only if** not billed and no sealed PMD. FSM addition: `completed→active` (gated).
- **RED tests first:**
  - backend `visit-reopen.test.ts` — owner reopen of unbilled completed → active + audit; billed/PMD-sealed → 422;
    non-owner → 403.
- **AC/BR:** proposed **BR-A15**; relates BR-002/BR-003.
- **FSM change:** add gated `completed→active` to `VISIT_TRANSITIONS` (property-test the new edge).
- **depends:** none.

### SL-A10 — Accepted-plan version viewer + header FSM wiring (GAP-A09, GAP-A10) — P2 (decision OQ#11)
- **Steps:** 7-9 (FE; endpoints exist). Read-only version viewer (extend J09) + surface approve/status-history/
  appointment-link in `treatment-plan-tab.tsx`.
- **RED tests first:** FE `treatment-plan-version-viewer.test.ts` (snapshot render); FE `use-treatment-plan.test.ts`
  (extend); E2E extend J09.
- **AC/BR:** BR-VIS-010, TP-BR-005, P1-21, P2-8.
- **depends:** SL-A01 (canonical accept decided first, so the viewer shows the right source).

---

## (6) Open questions / [ASSUMPTION] for the user

1. **Canonical plan-accept** (GAP-A05): is the version-snapshot (`treatment_plan_versions`) or the header
   FSM (`dentalTreatmentPlans`) the source of truth, and should accept drive both? (MASTER-GAP-MATRIX OQ — §H.)
2. **Locked tier in V1?** (GAP-A03/SL-A06/SL-A08): no lock job exists; `locked` is unreachable in prod.
   Build the job or accept `completed` as the terminal durable state? `[ASSUMPTION]` currently unwanted.
3. **Cross-branch carry-over** (GAP-A13): keep patient-scoped (cross-branch continuity) or add a source-branch
   guard? (MODULE_SPEC §13 / MASTER-GAP-MATRIX OQ#9 explicitly decision-pending.)
4. **Offline conflict policy** (CAND-A18/A19): confirm last-write-wins is intentionally rejected in favor of
   FSM-monotonic merge for treatment status and deterministic active-visit resolution. Respects no-AI/local-first.
5. **Consent scope** (GAP-A07): is the visit-scoped consent gate acceptable, or must consent be
   procedure/plan-scoped for performs? `[ASSUMPTION]` visit-scoped is current intent (BR-014 reads visit-level).
6. **Plan estimate staleness** (CAND-A17): should the live plan aggregate carry an as-of timestamp / frozen
   prices on acceptance? Touches money.
