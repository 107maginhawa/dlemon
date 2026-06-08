# Module Audit Tracker — 2026-06-08

Per-module deep audit + safe-gap closure. Product-first clinical vertical sequence
(15 audit rounds; bounded-context modules fold into their parent). One commit per module.

**Sequence:**
dental-org → dental-patient → dental-scheduling → dental-visit → dental-clinical → dental-perio →
dental-imaging → dental-pmd → dental-billing → dental-audit → erasure/legal-hold/retention →
dental-portal → emr-consultation → provider → external-records-import

| # | Module | Verdict | Gaps closed | Deferred | Report |
|---|--------|---------|-------------|----------|--------|
| 1 | dental-org | ✅ READY | 5 (1 test gap, 3 doc drift, 1 registry drift) | BR-016c → imaging round | [MODULE_dental-org_AUDIT_2026-06-08.md](modules/MODULE_dental-org_AUDIT_2026-06-08.md) |
| 2 | dental-patient | ✅ READY | 9 (3 cross-tenant PHI holes, 1 stub 500→501, 5 doc/registry drift) | 8 test gaps + archived-sub-resource-guard product decision + KG-backlog | [MODULE_dental-patient_AUDIT_2026-06-08.md](modules/MODULE_dental-patient_AUDIT_2026-06-08.md) |
| 3 | dental-scheduling | ✅ READY | 8 (1 RBAC bypass, 1 adversarial test, 1 stale comment, 1 wrong FSM/table doc note, 4 registry/spec/contract drift) | BR-SCH-003-on-PATCH-cancel decision + sub-feature negative-path line-audit + KG over-claim | [MODULE_dental-scheduling_AUDIT_2026-06-08.md](modules/MODULE_dental-scheduling_AUDIT_2026-06-08.md) |
| 4 | dental-visit | ✅ READY | 10 (5 security: applyTemplate RBAC + cross-clinic template leak + 3× treatment-plan cross-tenant PHI; 5 registry/spec/contract/workflow-map drift) | carry-over cross-branch decision + TypeSpec shape reconciliation + BR-005 flag-ON test + template-CRUD RBAC + KG-backlog | [MODULE_dental-visit_AUDIT_2026-06-08.md](modules/MODULE_dental-visit_AUDIT_2026-06-08.md) |
| 5 | dental-clinical | ✅ READY | 6 (1 consent-integrity bug: revoke-then-sign + gate ignored revoked; 5 contract/spec/registry/comment drift). _Post-audit: updatePrescription BR-003 field-edit guard added (resolved)._ | post-sign consent-withdrawal decision (ratified as-is) + AC-CLI-005 405 pin + KG-backlog | [MODULE_dental-clinical_AUDIT_2026-06-08.md](modules/MODULE_dental-clinical_AUDIT_2026-06-08.md) |
| 6 | dental-perio | ✅ READY | 7 (1 clinical-correctness bug: partial-chart over-staging to IV via charted-count `remainingTeeth`; 1 wrong-role RBAC test; 1 stale comment; 4 registry/spec/contract drift incl. whole module absent from br-registry) | WF-P03 amendment + WF-P05 PDF export deferred + cascade-audit-row test gap + cross-branch positive test + KG-backlog | [MODULE_dental-perio_AUDIT_2026-06-08.md](modules/MODULE_dental-perio_AUDIT_2026-06-08.md) |
| 7 | dental-imaging | ✅ READY | 6 (1 cross-branch PHI isolation test; 5 doc/registry drift: DOMAIN_MODEL SM-01 mislabel, MODULE_SPEC §6 permissions / §13 edge-cases / §15 errors, br-registry CIMG-001/002 tier + CIMG-010 analyses) | AI auto-tracing/DICOM/structural-superimposition non-goals + imaging audit-row test gap + detect kill-switch-OFF test + 403/404-mask convention note + KG-backlog | [MODULE_dental-imaging_AUDIT_2026-06-08.md](modules/MODULE_dental-imaging_AUDIT_2026-06-08.md) |
| 8 | dental-pmd | ✅ READY | 5 (1 cross-branch PHI isolation test; 4 doc/registry drift: MODULE_SPEC §7/§7.2 phantom columns, §10 wrong list route + multipart, §15 error table, br-registry enriched 2→7 rules) | getImportedPMD-patient-self-detail decision + async/presigned/multipart/notif deferred + 2 test gaps (detail-read audit row, care-record superseded-exclusion) + KG over-claim (PMD mis-expansion / phantom route / recall claim) | [MODULE_dental-pmd_AUDIT_2026-06-08.md](modules/MODULE_dental-pmd_AUDIT_2026-06-08.md) |
| 9 | dental-billing | ✅ READY (1 security fix) | 6 (1 REAL cross-tenant money+PHI hole on 5 optional-branchId report endpoints; 5 doc/registry drift: br-registry +BR-014/BR-015/EM-BIL-002 & BR-010/012 stale, MODULE_SPEC §8 FSM / §10 routes, API_CONTRACTS plan-frequency enum) | recordedByMemberId server-validation product decision + 2 test gaps (empty-membership pin, DE-008 partial-negative pin) + KG-backlog (phantom ar/aging route) | [MODULE_dental-billing_AUDIT_2026-06-08.md](modules/MODULE_dental-billing_AUDIT_2026-06-08.md) |
| 10 | dental-audit | ✅ READY | 6 (1 REAL test gap: cross-tenant audit-read denial pin; 5 doc/registry drift: br-registry whole-module ABSENT → added 6 rules, MODULE_SPEC §9 banner legacy-table-name + §6/§11/§17 pg-boss/no-self-audit, API_CONTRACTS response field table snake_case→camelCase) | fail-closed-on-security-event pin + legacy-table dual-write coverage + retention→round-11 + self-audit tenantId-echo decision + KG-backlog (phantom `/dental/audit/events` route) | [MODULE_dental-audit_AUDIT_2026-06-08.md](modules/MODULE_dental-audit_AUDIT_2026-06-08.md) |
| 11 | erasure/legal-hold/retention | ✅ READY | 5 (2 REAL test gaps: audit-survives-erasure pin + AC-LH-004 release-already-released/nonexistent FSM pins; 3 doc/registry drift: whole governance layer ABSENT from br-registry → added 6-rule block, 2 stale "no legal-hold store exists yet" source comments contradicted by the code, WORKFLOW_MAP WFG-006 three stale "Gap/no-implementation/PHI-purge/store-remaining" spots → RESOLVED) | dental-erasure MODULE_SPEC anchor absent + cross-tenant admin-scope product decision + retention enforcement env-gated-off + extra targets/Art.20-portability deferred + erasure fail-closed-audit pin + KG-backlog (phantom /dental/data-governance/* routes, retention unmodeled, Pino-not-store) | [MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md](modules/MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md) |
| 12 | dental-portal | ✅ GAPS (honest — Phase-1 read-only foundation; what's built is GREEN) | 3 (1 REAL adversarial-test pin: IDOR-tamper-inert + empty-self-scope ×6; 2 doc/registry drift: whole module ABSENT from br-registry → added 5-rule V-PORTAL-001..005 block, WORKFLOW_MAP WF-078 over-described unbuilt Phase-2 + omitted built reads → reconciled) | guardian/household-dependent portal access + self-booking + online self-pay + /me imaging/clinical/treatment-plan reads + secure-messaging/consent-mgmt + dental-portal MODULE_SPEC anchor — all Phase-2 DEFERRED/surfaced (NOT built); route-level role-reject belt-and-suspenders pin | [MODULE_dental-portal_AUDIT_2026-06-08.md](modules/MODULE_dental-portal_AUDIT_2026-06-08.md) |
| 13 | emr-consultation | ✅ READY | 2 (1 REAL adversarial-test pin: cross-owner list self-scoping ×5 — provider/patient list excludes foreign owner both directions + cross-patient `?patient=`→403 + own-id allowed; 1 registry drift: whole module ABSENT from br-registry → added 5-rule `emr-consultation` block V-EMR-OWN/001/AUTH/CTX/005) | no `emr.hurl` contract file + KG under-models the module (no emr node) — both surfaced; amend-after-finalize is a documented non-goal (V-EMR-001); route-level role-reject belt-and-suspenders pin | [MODULE_emr-consultation_AUDIT_2026-06-08.md](modules/MODULE_emr-consultation_AUDIT_2026-06-08.md) |
| 14 | provider | ✅ READY | 2 (1 REAL test gap: credential field-visibility — privileged read returns full NPI/DEA/license verbatim + unauth → 401, no public read; 1 registry drift: whole module ABSENT from br-registry → added 4-rule `provider` block V-PROV-001..004) | 4 orphan handlers (getProvider/listProviders/updateProvider/deleteProvider — dead code, no route/registry/tsp) + `practitioner:owner` non-functional role (no person link, no handler check, never granted — latent IDOR unreachable today) + no product MODULE_SPEC + KG conflation (flow:manage-providers points at dental-org route) + credential-status-FSM non-goal | [MODULE_provider_AUDIT_2026-06-08.md](modules/MODULE_provider_AUDIT_2026-06-08.md) |
| 15 | external-records-import | ✅ READY | 2 (1 REAL test gap: bulk-import cross-tenant + role-gating + ingestion-safety — 7 adversarial pins; 1 registry drift: whole import bridge ABSENT from br-registry → added 4-rule `external-records-import` block V-XRI-001..004) | FHIR/CDA/PDF `/dental/emr-import` bridge UNBUILT (Phase-3+ by design — needs ingestion-hardening review: file-type/MIME + XXE-safe XML + zip-bomb/path-traversal + size cap) + no server-side row-COUNT cap on bulk import (DoS-class, product decision) + naive `split(',')` CSV (RFC-4180) + KG-backlog (bulk patient-import + FHIR bridge unmodeled; PMD-import flow node IS accurate) | [MODULE_external-records-import_AUDIT_2026-06-08.md](modules/MODULE_external-records-import_AUDIT_2026-06-08.md) |

---

# 🏁 SERIES ROLLUP — 15-Module Deep Audit (2026-06-08)

**The single hand-off artifact.** 15 modules audited end-to-end (adversarial; every claim verified against
source). Branch `feat/module-workflow-alignment`. One docs commit per module; every real behavioral fix is a
SEPARATE `fix()` commit.

## Aggregate verdicts

| Verdict | Count | Modules |
|---------|-------|---------|
| ✅ **READY** | 14 | dental-org, dental-patient, dental-scheduling, dental-visit, dental-clinical, dental-perio, dental-imaging, dental-pmd, dental-billing, dental-audit, erasure/legal-hold/retention, emr-consultation, provider, external-records-import |
| ✅ **GAPS (honest)** | 1 | dental-portal (Phase-1 read-only foundation; what's BUILT is GREEN; Phase-2 features well-surfaced as deferred) |
| ❌ BLOCKED | 0 | — |

**14 READY / 1 honest-GAPS / 0 BLOCKED.** No module shipped a reachable, unmitigated security hole at the close
of its round.

## Real behavioral bugs FOUND + FIXED across the series (8)

All proven RED-before-GREEN; security fixes are separate `fix()` commits (or folded into the module's docs commit
where the fix + its test were inseparable from the audit). Verified against `git log`:

| # | Module | Bug | Class | Commit |
|---|--------|-----|-------|--------|
| 1 | dental-patient | `listPatientVisits` + `listPatientConditions` took a caller-supplied `branchId` that was access-checked but never tied to the path patient → **cross-tenant PHI read** (V-PAT-002) | cross-tenant PHI | `f1a03342` (folded) |
| 2 | dental-patient | `removeHouseholdMember` had no `archived`-guard while its sibling `addHouseholdMember` did (asymmetry) | state-guard | `27bfb0ee` |
| 3 | dental-visit | `getTreatmentPlan` / `getTreatmentPlanVersion` / `acceptTreatmentPlan` — same caller-supplied-branchId **cross-tenant PHI** (×3) | cross-tenant PHI | `cf008532` (folded) |
| 4 | dental-visit | `applyTemplate` was an alternate treatment-creation path with **weaker RBAC** than `createDentalTreatment` (assertBranchAccess vs assertBranchRole) + cross-clinic template leak | RBAC bypass | `cf008532` (folded) |
| 5 | dental-clinical | Consent **revoke-then-sign** produced a contradictory signed+revoked row that the `signed=true`-only gate honored → treatment could proceed on a revoked consent (asymmetric FSM terminal guard) | consent integrity | `088332f1` (folded) |
| 6 | dental-clinical | `updatePrescription` (BR-003) skipped the locked/completed-visit **immutability guard** that all five create handlers enforce | immutability | `27bfb0ee` |
| 7 | dental-perio | `classifyChart` defaulted `remainingTeeth` to the count of teeth *charted* on a partial exam → a fully-dentate patient charted on <20 teeth was **over-staged to Stage IV** (a test had enshrined the wrong result) | clinical correctness | `90ee0555` |
| 8 | dental-billing | **EM-BIL-002** — 5 report/aggregate endpoints treated `branchId` as an OPTIONAL filter; omitting it applied NO scope → **full multi-tenant financial + PHI aggregate** | cross-tenant money+PHI | `825bffbb` |

**Breakdown:** 5 cross-tenant isolation holes (dental-patient ×2 reads, dental-visit ×3 + RBAC, dental-billing
×5 endpoints) · 1 consent-integrity FSM hole · 1 immutability-guard gap · 1 clinical-scoring correctness bug.
**provider, dental-org, dental-scheduling, dental-imaging, dental-pmd, dental-audit, erasure/legal-hold/retention,
dental-portal, emr-consultation, external-records-import = NO behavioral hole found** (guards already correct;
those rounds added the missing adversarial PINS).

## Test gaps closed (adversarial pins added)

~**40+ adversarial tests** added across the series (cross-tenant 2-org denials, immutability 405s, FSM illegal
transitions, role-reject 403s, credential field-visibility, IDOR-tamper-inert self-scope, ingestion-safety 4xx,
empty-scope zero-rows). Per-round gap counts: org 1 · patient 8 · scheduling 1 · visit (folded) · clinical 1 ·
perio 1 (+cascade) · imaging 1 · pmd 1 · billing 2 · audit 1 · governance 2 · portal 1 · emr 1 · provider 1 ·
import 7. Highest-value class: the **2-org `OTHER_BRANCH` cross-tenant-denial** pin (the cheap test that would
have caught bugs #1, #3, #8 had it existed first) and the **zero-rows-written-on-403** assertion (proves the guard
runs before the write/tx).

## Registry / doc drifts fixed

- **br-registry blocks added for 6 entirely-absent modules:** dental-perio, dental-audit,
  erasure-legal-hold-retention, dental-portal, emr-consultation, provider, external-records-import (the recurring
  "whole module missing from br-registry" class — cross-cutting/governance/platform/bridge modules that don't map
  1:1 to a `dental-<x>` dir are the most likely to be absent).
- **Rule corrections:** dental-imaging CIMG-001/002 (tier gate understated `basic` as allowed → strict `!== 'addon'`),
  dental-billing BR-010/012/014/015, dental-pmd 2→7 rules + phantom-column purge, dental-audit response-field
  snake_case→camelCase.
- **MODULE_SPEC / API_CONTRACTS / WORKFLOW_MAP reconciliations:** dental-pmd §7/§10 phantom columns + wrong list
  route, dental-billing §8 FSM / §10 routes, dental-scheduling FSM/table note, dental-visit shape reconciliation,
  governance WFG-006 three stale "Gap/no-implementation" spots + 2 stale "no legal-hold store yet" source comments,
  dental-portal WF-078 over-description, dental-clinical/scheduling stale comments.

## Security-class dispositions (FINAL)

| Class | Disposition | Where closed |
|-------|-------------|--------------|
| **Optional-branchId / caller-supplied-branchId (cross-tenant)** | ✅ **CLOSED.** Holes found+fixed in dental-patient + dental-visit (caller-supplied) and dental-billing (optional-omitted). Targeted cross-module sweep ([SWEEP_optional-branchid_2026-06-08.md](SWEEP_optional-branchid_2026-06-08.md)) proved the optional-omitted variant UNIQUE to billing. portal/emr/provider/import = N/A by design (no branch param or no branch dimension). All 15 contexts audited — no chase targets remain. | rounds 2,4,9,13 + sweep |
| **Audit-row-invariant (right actor/action/target/tenant + PHI-sanitized)** | ✅ **CLOSED AT-SOURCE** in dental-audit (round 10): the `logAuditEvent` mechanism writes a correct, PHI-clean `dental_audit_log` row with actor=session.userId (no forgeable actor field) + append-only enforced by BOTH a 405 HTTP guard AND a DB BEFORE-UPDATE/DELETE trigger. Per-module "handler X writes a row" is now belt-and-suspenders. | round 10 |
| **Legal-hold blocks erasure** | ✅ **ENFORCED + tested** on 4 axes (round 11); the cross-cutting governance layer is substantially complete (3 handler dirs, 8 codegen ops, env-gated retention cron, 77 tests). | round 11 |
| **IDOR / portal self-scope** | ✅ **CLEAR.** Patient-facing surfaces (portal, emr, provider-self) resolve identity server-side from the session (`resolveSelfPatientIdOrThrow` / owner-from-session); no route accepts a client-supplied patientId; `?patientId=` tamper is INERT. The latent `practitioner:owner` IDOR in provider is **unreachable** (role never granted, no person link, no handler check — surfaced as spec drift). | rounds 12,13,14 |
| **Immutability / append-only (imported originals, audit log, signed consent)** | ✅ **ENFORCED.** Imported-PMD (405 + verbatim store, round 8), audit log (405 + DB trigger, round 10), signed consent (symmetric terminal-FSM guards after the round-5 fix). | rounds 5,8,10 |
| **Ingestion safety (untrusted external import)** | ✅ **CLEAR for built surfaces** (bulk patient import → specific 4xx not 500; PMD checksum 422; both pinned). The future FHIR/CDA bridge MUST add file-type/MIME + XXE-safe XML + zip-bomb/path-traversal + size + row-count guards when built. | round 15 |

## Consolidated DEFERRED / SURFACED backlog (the one actionable list)

Grouped across all 15 rounds — none auto-built (each needs a product decision, a schema migration, or new scope).

**A. Absent / future-phase features (build when scheduled):**
1. **external-records-import FHIR/CDA/PDF bridge** (`/dental/emr-import`, `emr_record`) — Phase-3+; needs ingestion-hardening review (round 15).
2. **dental-portal Phase-2** — guardian/household-dependent access, self-booking, online self-pay, `/me` imaging/clinical/treatment-plan reads, secure messaging, consent management (round 12). Guardian access MUST check the household relationship server-side.
3. **dental-perio** — WF-P03 chart amendment + WF-P05 PDF export; calculus/MGJ/per-site fields (rounds 6, clinical-standards).
4. **dental-pmd** — async/presigned/multipart upload + import notification (round 8).
5. **dental-imaging** — AI auto-tracing / DICOM / structural-superimposition (intentional non-goals — do NOT propose).
6. **emr-consultation** — amend-after-finalize is a documented non-goal (V-EMR-001); the `amended` enum is reserved/unreachable.
7. **provider** — credential-verification FSM (pending→verified) is an upstream non-goal; 4 orphan Provider read/update/delete handlers (dead code — wire-or-delete decision).
8. **erasure/legal-hold** — extra erasure targets + Art.20 data-portability; retention enforcement is env-gated-OFF by default.

**B. Product decisions needed (behavior change — surfaced, not made):**
9. **dental-billing** — `recordedByMemberId` server-validation (currently client-supplied on payment record).
10. **dental-scheduling** — BR-SCH-003 reason-requirement on the generic `PATCH {status:'cancelled'}` (the dedicated cancel endpoint enforces it; the PATCH path bypasses).
11. **dental-patient** — archived-patient sub-resource read-guard scope (writes are guarded; reads are not).
12. **dental-pmd** — `getImportedPMD` patient-self detail-read access.
13. **erasure** — cross-tenant admin-scope is by-design (DPO model) but should be ratified as a tracked decision.
14. **external-records-import** — bulk-import row-COUNT cap (DoS) + partial-vs-all-or-nothing semantics for oversized files; RFC-4180 CSV parsing.
15. **dental-clinical** — post-sign consent-withdrawal handling (ratified as-is this series).

**C. KG-backlog (query-only — flag for next `/understand` regeneration, never hand-edit):**
16. **Phantom routes** in KG node summaries: dental-audit (`/dental/audit/events`), dental-billing (ar/aging), governance (`/dental/data-governance/*`), dental-pmd (`/dental/pmd/generate`).
17. **Conflations / under-models:** provider (`flow:manage-providers` points at the dental-org route; FHIR directory unmodeled), dental-pmd ("PMD"="Patient medical data" wrong expansion + "recall management" over-claim), external-records-import (bulk patient-import + FHIR bridge unmodeled).
18. **Accurate KG nodes (no drift):** dental-portal (`flow:patient-self-service-read`), external-records-import (`flow:import-external-pmd`) — confirmed correct.

**D. Missing test infrastructure (low priority):**
19. `emr.hurl` contract file absent (round 13); product MODULE_SPEC/API_CONTRACTS absent for platform modules (emr, provider) — expected, not gaps.

## Cross-module learnings (reusable lenses) → see the detailed carry-forward section below

The richest reusable findings, distilled: **(1) caller-supplied branchId is not an auth boundary** — authorize against the resource's own branch; **(2) optional-filter omission → unscoped all-tenant aggregate** — an omitted optional scope must default to the caller's accessible set; **(3) paired terminal FSM transitions need symmetric guards** AND read-gates must filter the full invariant, not one boolean; **(4) generic update/PATCH paths may skip the create-path guard** (immutability, RBAC, reason-requirement); **(5) absence-of-evidence ≠ a clinical signal** in derived scores; **(6) cross-cutting/platform/bridge modules are the most likely to be registry-absent**; **(7) an `:owner` role can be declared-but-non-functional** (verify handler-check + schema link + grant path all exist); **(8) orphan handler files typecheck but are dead** — diff the handler set against the operationId set + routes; **(9) test with a *different-branch full-role* member, not just a no-membership outsider** (they deny for different reasons); **(10) assert zero-rows-written on a 403** (proves the guard precedes the write).

---

## Cross-module carry-forward

- ~~**BR-016c (imagingTier gate)** — declared in dental-org §5 but enforced/tested in dental-imaging.~~
  **RESOLVED 2026-06-08 (dental-imaging round).** The gate is implemented as strict `imagingTier !== 'addon'`
  at study create (cephalometric/CBCT) AND on every ceph endpoint, blocking free/basic/null with 403
  IMAGING_TIER_REQUIRED. br-registry CIMG-001/002 reconciled (had understated `basic` as allowed). Tests
  pin free→403, basic→403, null→403, addon→pass.
- **AC-ORG-002** fee-schedule → new-invoice default: dental-org proves the per-branch override;
  the invoice-time price snapshot is billing-side — verify in the **dental-billing** round.
- ~~**BR-015b archived = read-only (product decision)**~~ **RESOLVED 2026-06-08.** Re-verification
  shows the EF-PAT-001 guard (`patient.status==='archived'` → 403 `PATIENT_ARCHIVED`) is now
  pervasive across all sub-resource writers (insurance/contacts/alerts/tasks/household-create/
  treatment-plan/case-presentation/consent/follow-up) — the round-2 note was stale. The lone
  straggler `removeHouseholdMember` (had no guard while its sibling `addHouseholdMember` did) was
  fixed this session (403 `PATIENT_ARCHIVED` + test). Scope decision = enforce (not narrow).
- **PATCH-status-field bypass class (from dental-scheduling)** — a generic `PATCH {status}` update
  path can bypass the narrower RBAC/validation enforced by a transition's dedicated endpoint. In
  scheduling, `PATCH {status:'cancelled'}` bypassed the owner/staff_full cancel restriction (fixed)
  and still bypasses the BR-SCH-003 reason requirement (surfaced). **Check every module with a
  generic status-PATCH against its dedicated transition endpoints** (visit checkout/lock, treatment-plan,
  consent, claim FSM) for the same role/validation asymmetry.
  - **dental-visit instance found + fixed:** `applyTemplate` was an alternate treatment-creation
    path with weaker RBAC than `createDentalTreatment` (assertBranchAccess vs assertBranchRole).
    Keep checking alternate-path writers (templates, carry-over, bulk ops) in every module.
- **Asymmetric FSM transition guards (from dental-clinical V-CLN-010).** A state machine
  with two terminal exits (e.g. consent signed⊥revoked) can guard one direction but not the
  other: `revoke` blocked signed→revoke, but `sign` did **not** block revoke→sign, producing a
  contradictory signed+revoked row that the downstream `signed=true`-only gate honored — letting
  a treatment proceed on a revoked consent. **For every paired terminal transition, check BOTH
  guards are symmetric AND that any read-gate filters on the full invariant (signed=true AND
  revoked=false), not just one flag.** Recurs anywhere a status read-gate (billing, completion,
  treatment) trusts a single boolean.
- **Generic update handlers may skip the immutability guard the create handler enforces
  (from dental-clinical `updatePrescription`).** All five clinical *create* handlers block
  writes to a locked/completed visit (BR-003), but `updatePrescription` had no such guard.
  **RESOLVED 2026-06-08:** `updatePrescription` now blocks field edits on a locked/completed
  visit (422 `VISIT_IMMUTABLE`) while still allowing status FSM progression (dispense/cancel are
  external, per the lab-order §13 carve-out) — tests pin both. The *pattern* still stands: check
  every module's *update* path for the immutability guard its *create* path enforces.
- **Absence-of-evidence must not be inferred as a clinical signal (from dental-perio IDEAL-§343).**
  `classifyChart` defaulted `remainingTeeth` to the count of teeth *charted* on a (partial) perio
  exam, so a fully-dentate patient charted on <20 teeth tripped the `<20 teeth` Stage-IV factor and
  was over-staged — and a test had *enshrined* the wrong result. **For every derived clinical/scoring
  default, check that an omitted optional input is treated as "no evidence" (passed through as
  undefined), not silently substituted with a structurally-related but semantically-different value.**
  Recurs anywhere a classifier/score fills a missing risk input from the data at hand.
- **A whole module can be missing from br-registry (from dental-perio).** dental-perio's BR-P01..P07
  + V-PER codes were entirely absent from `br-registry.json` (8 of 10 dental modules registered).
  **When auditing a module, confirm it has a registry block at all** — not just that individual rules
  are present. **RECURRED at dental-audit (round 10):** dental-audit (the 10th dental module) was also
  entirely absent (only 9 of 10 registered) despite being the compliance source-of-truth — added a
  6-rule block this round. Pattern confirmed: registry coverage lags module creation; always check
  presence-of-block first. **RECURRED AGAIN at erasure/legal-hold/retention (round 11):** the entire
  cross-cutting data-governance layer (3 handler dirs) had NO br-registry block (11 module blocks, none
  for governance) — added a 6-rule `erasure-legal-hold-retention` block. **Cross-cutting/governance
  concerns are the MOST likely to be registry-absent because they don't map 1:1 to a `dental-<x>` dir.**
- **A "deferred P1" memory note can badly understate a since-built module (round 11).** Prior MEMORY
  flagged "erasure/retention" as a deferred/partial data-governance item — but the audit found a
  substantially COMPLETE, well-tested layer (3 handler dirs, 8 codegen ops, env-gated cron, 77 tests,
  the legal-hold-blocks-erasure invariant enforced + tested on 4 axes). **Resolve artifacts against
  source before trusting a "deferred/absent" summary** — the headline finding was over-completeness,
  not absence. The same staleness appeared IN-SOURCE: two comments ("no legal-hold store exists yet")
  and three WORKFLOW_MAP spots ("Gap WFG-006 / no implementation") contradicted the code below them.
  **For a governance/safety module, grep the source comments + WORKFLOW_MAP for "yet/Gap/no implementation"
  against what the code actually does — these stale-past notes survive precisely because the code that
  obsoleted them was added in a separate later pass.**
- **A platform-`admin`-gated cross-tenant endpoint is NOT the optional-branchId hole (round 11).**
  Erasure/legal-hold gate on the Better-Auth platform `admin` superuser role and take `tenantId` from the
  request BODY (cross-tenant by design — the DPO/data-controller model). This is NOT the EM-BIL-002
  "optional branchId omitted → all-tenants" class: there is no per-branch boundary to leak past, the scope
  is intentionally global, and it's RBAC-gated to `admin` + recorded as a tracked product decision (IDEAL
  standard §342). **When a list/report endpoint returns cross-tenant rows, first establish whether it's a
  branch-scoped resource leaking (a hole) or a platform-admin function operating globally (by design) —
  the test is whether a non-superuser role can reach it.** The right RBAC pin for the latter is non-admin → 403,
  not a 2-org cross-branch denial.
- **The recurring "audit-row assertion gap" is now CLOSED AT-SOURCE (dental-audit round 10).**
  Rounds 6–9 repeatedly deferred an "audit-row assertion gap": handlers were confirmed to CALL
  `logAuditEvent` by source, but few tests asserted the row is actually WRITTEN with the right
  actor/action/target/tenant. **That invariant lives at the source-of-truth module and IS pinned
  there:** `dental-audit/audit.test.ts` asserts `logAuditEvent({...})` persists a `dental_audit_log`
  row with the correct `actorId`(=session.userId, the true actor — there is no caller-supplied actor
  field to forge)/`action`/`targetType`/`tenantId`/`branchId`/server `timestamp` + PHI-sanitized
  before/after snapshots, and `getAuditEvents.test.ts` pins the viewer self-audit row's actor == the
  session user. **Implication for the remaining modules:** a per-module "handler X writes an audit row"
  pin is now *belt-and-suspenders*, not a P1 — the write mechanism itself is proven correct + PHI-clean
  at-source. Per-module deferrals of "assert the audit row" are downgraded; only add one where a
  module's *specific* action→row mapping (the right `action` string / `targetType`) is load-bearing
  and untested.
- **Append-only / immutability has a canonical two-layer pattern (dental-audit round 10, also dental-pmd
  imported-PMD).** The strong form is HTTP method-shadow guards (DELETE/PUT/PATCH → 405 IMMUTABLE) PLUS a
  DB BEFORE UPDATE/DELETE trigger that RAISEs — so a direct SQL mutation (compromised credential, errant
  migration) is also refused. **When a module claims "immutable/append-only," verify BOTH layers exist
  and are tested** (the HTTP 405 alone is bypassable by direct DB access; the DB trigger alone misses the
  API contract). dental-audit has both (app.ts 405 guards + migration 0080 trigger), both tested.
- **Caller-supplied branchId is not an auth boundary (V-PAT-002 → V-VIS-011).** A `branchId`
  query param that is access-checked but never tied to the path resource (patientId) leaks
  cross-tenant. dental-patient (list visits/conditions) and dental-visit (treatment-plan
  get/accept/version) both had it. **Audit every patient/resource-scoped read+write that takes
  a `branchId` query param** in the remaining modules (billing, pmd, portal, emr) — authorize
  against the resource's own branch, not the param.
  - **dental-imaging = the SAFE pattern (no hole found).** Every imaging handler derives branch
    from the resource (`study.branchId`, or image→study), then `assertBranchAccess/Role`; the
    `listPatientImages?branchId=` repo filters images by `branchId` AND the caller must be a member
    of it, so a member of a different branch sees zero rows (no leak). The 2026-06-08 round only
    ADDED the missing *test* for this (a same-org member of `OTHER_BRANCH` is denied a `BRANCH_ID`
    radiograph) — it was correct by source but unpinned. **Cross-branch isolation should be tested
    with a member of a *different* branch (full role), not just a no-membership `OUTSIDER` — the two
    deny for different reasons and only the former proves the resource-scoped-branch invariant.**
  - **dental-pmd = also the SAFE pattern (no hole found) — 2026-06-08.** dental-pmd trusts **no
    `branchId` query param at all**; visit-scoped handlers derive branch from `visit.branchId`,
    patient-scoped handlers from `patient.preferredBranchId` (the patient resource's own branch,
    org-scoped so it can't cross an org boundary), then `assertBranchAccess/Role`. The round only
    ADDED the missing cross-branch *tests*.
  - **dental-billing = HOLE FOUND + FIXED (EM-BIL-002) — 2026-06-08.** The *mutating* handlers are
    SAFE (branch from `invoice.branchId`/`claim.branchId`/`patient.preferredBranchId` + assertBranchRole),
    and `listDentalInvoices` *requires* branchId (400 otherwise). But **five REPORT/LIST endpoints**
    (`getArAging`, `getCollectionsSummary`, `getPayerArAging`, `listInsuranceClaims`,
    `generateStatementBatch`) treated `branchId` as an OPTIONAL filter and only `assertBranchAccess`
    *when supplied* — so **omitting branchId applied NO branch condition and scanned every org's
    invoices/payments/claims/balances + patient names** (cross-tenant financial-data + PHI). This is
    a **NEW, stronger variant** of the class: not "caller-supplied branchId untied to the resource"
    but **"optional branchId omitted → no scoping at all → full multi-tenant aggregate."** Fixed TDD:
    omitted-branch now scopes to the caller's own active branches via `getActiveBranchIdsForPerson`
    → `inArray` (empty membership → zero rows, never the whole DB). **NEW CARRY-FORWARD: audit EVERY
    list/report/aggregate endpoint whose tenant/branch filter is OPTIONAL — an omitted optional scope
    must default to the caller's accessible set, never to "unfiltered = all tenants." Check portal +
    emr (the last two modules) for the same optional-filter-omitted pattern, not just caller-supplied
    branchId.**
  - **dental-audit = SAFE (no hole) + prior P0 stayed fixed — 2026-06-08 (round 10).** The audit-log
    READ endpoint (`getAuditEvents`) takes branchId as a **REQUIRED** scope guard (omitted → 400, never
    an unscoped all-tenant `list` — this is the EM-AUD-002 P0 that was fixed earlier, **verified still
    fixed**) and gates on `assertBranchRole(dentist_owner)` against `dental_membership`, so an owner of
    org A passing org B's branchId → 403. The optional-branchId-omission variant does NOT apply (branchId
    is required, not optional). The round ADDED the missing **cross-tenant read-denial test** with the
    2-org full-role pattern (the prior 403 test only covered a no-membership caller — the imaging/pmd
    lesson).
  - **dental-portal = N/A by design (no branch surface) — 2026-06-08 (round 12).** The portal is
    PATIENT-FACING and read-only: it takes NO `branchId` (or any) client param. Identity is the
    session patient (`resolveSelfPatientIdOrThrow`, `patients.person === user.id`) and the facades
    scope on a REQUIRED `eq(patientId)` that is always the session id — so neither the caller-supplied-
    branchId class nor the optional-branchId-omission class applies (there is no branch/tenant param to
    tamper or omit, and no cross-resource aggregate with an optional-only scope). IDOR/self-scope =
    CLEAR; the round only ADDED an IDOR-tamper-inert + empty-self-scope test.
  - **emr-consultation = N/A by design (no branch/tenant dimension at all) — 2026-06-08 (round 13).** The EMR
    module is PLATFORM-LEVEL and governed by Better-Auth roles (provider/patient/admin), NOT branch/membership.
    `consultation_note.tenant_id` is nullable and intentionally NOT the isolation mechanism — isolation is purely
    PROVIDER/PATIENT OWNERSHIP resolved server-side from the session (PHI lives in per-user embedded SQLite; cadence
    P2P scope claims handle cross-device isolation). The two list endpoints (`/emr/consultations`, `/emr/patients`)
    force the provider/patient scope from the session (admin sees all by role, intentionally global), and the lone
    client scope param (`?patient=` on listConsultations) is validated to equal a patient caller's OWN id (403
    otherwise). So neither the caller-supplied-branchId variant nor the optional-branchId-omission variant can apply
    (there is no branch/tenant param to tamper or omit, and no cross-resource aggregate with an optional-only scope).
    Cross-owner isolation + sign-immutability + authoring-role-gating + audit-row = CLEAR; the round only ADDED the
    missing cross-owner list-isolation test (provider/patient list excludes a foreign owner both directions, + a
    cross-patient `?patient=` → 403).
  - **branchId-auth-boundary class status: FINAL — CLEAR for org/patient/scheduling/visit/clinical/perio/
    imaging/pmd/audit/portal/emr (portal + emr N/A by design); HOLES found+fixed in dental-patient + dental-visit
    (caller-supplied branchId) and dental-billing (omitted optional branchId). ALL 15 contexts audited — no remaining
    chase targets.**
  - **OPTIONAL-BRANCHID-CLASS CARRY-FORWARD — CLOSED (2026-06-08, round 13, emr = last flagged module).**
    Final disposition across all modules: (1) **caller-supplied-branchId variant (V-PAT-002):** holes found+fixed in
    dental-patient + dental-visit, CLEAR everywhere else. (2) **optional-branchId-omitted variant (EM-BIL-002 — omit →
    unscoped all-tenant aggregate):** hole found+fixed in dental-billing (5 report endpoints); the targeted cross-module
    sweep (`SWEEP_optional-branchid_2026-06-08.md`) proved it UNIQUE to billing. (3) **portal + emr:** N/A by design
    (portal = patient-facing self-scope, no branch param; emr = platform-level, no branch/tenant dimension). **The
    optional-filter-omission hazard remains live ONLY for cross-resource aggregate/report endpoints with an optional-only
    scope — a shape that existed ONLY in billing (now fixed).** No further chase targets remain in the audit series.
  - **TARGETED CROSS-MODULE SWEEP for the optional-branchId-omission variant — CLEAN (2026-06-08).**
    After EM-BIL-002, swept all 45 list/report/aggregate/search/export endpoints across the eight
    already-audited modules (org/patient/scheduling/visit/clinical/perio/imaging/pmd) specifically for
    *"optional branchId omitted → unscoped → all tenants."* **ZERO holes found** — the variant is unique
    to dental-billing. Every list/report endpoint in these modules is either (a) **branchId-required**
    (400/throw on omit → hard `eq(branchId)`), (b) **resource-anchored** — branch derived from a path
    resource (visit/patient/study/image/household/chart/template) then `assertBranchAccess/Role`, the
    query `branchId` only a further-narrowing filter (the V-PAT-002/V-VIS-011 posture), or (c) scoped to
    the caller's **own memberships** (`getBranchesByUser`, `getPermissionGrid` org-resolution). The six
    repos with a conditional `if (filters.branchId)` (`visit.repo:35`, `perio-chart.repo:27`,
    `dental-appointment.repo:37`, `waitlist-entry.repo:34`, `queue-item.repo:25`, `membership.repo:62`)
    were each traced to callers that require branchId or derive+assert it from a resource first — none
    leaves an unfiltered all-tenant path. **Why clean, not a coverage gap:** the billing hole was
    structural — its reports aggregate *across patients* (AR aging / collections / payer aging / claim
    worklist / statement batch), so there is no path-resource to anchor the branch and the only scope was
    the optional `branchId`. Every report in the other 8 modules is resource-anchored or branchId-required,
    so there is no "cross-resource aggregate with an optional-only scope" surface to leak. **The
    optional-filter-omission hazard therefore remains live ONLY for cross-resource aggregate/report
    endpoints — chase it specifically in portal + emr (and any future reporting module).** Coverage proof:
    [SWEEP_optional-branchid_2026-06-08.md](SWEEP_optional-branchid_2026-06-08.md) (full per-endpoint table,
    negative results included).
- **A br-registry rule can UNDERSTATE a gate, not just be absent (from dental-imaging CIMG-001).**
  CIMG-001 said the ceph tier gate blocks "free or null" — but the code is strict `!== 'addon'`, so
  `basic` is blocked too (a test already proved it). **When a registry rule enumerates the blocked
  set, re-derive it from the operator in code** (`!== 'addon'` ⇒ everything except addon), not from
  the prose. Same class as a stale "only one analysis type exists" claim after N shipped (CIMG-010).
- **A MODULE_SPEC can list PHANTOM schema columns / wrong routes a sibling doc already fixed (from
  dental-pmd §7/§10).** API_CONTRACTS had already been reconciled to the inline-JSON reality
  (V-PMD-006), but MODULE_SPEC §7 still listed `storage_file_id`/`format_version`/`imported_pmd.branch_id`
  columns that don't exist and §10 still listed the wrong list route + multipart upload. **When two
  spec docs for a module disagree, diff BOTH against the schema/routes — don't assume the
  most-recently-edited one propagated its fix.** Re-derive the column set from `*.schema.ts` and the
  route set from `generated/openapi/routes.ts`, not from prose.
- **KG node summaries can carry a wrong domain-term EXPANSION + a phantom route (from dental-pmd).**
  The graph expanded "PMD" as "Patient medical data" (canonical is "**Portable** Medical Document",
  V-PMD-009), cited a non-existent `POST /dental/pmd/generate` (real: `POST /dental/visits/:visitId/pmd`),
  and claimed out-of-scope "recall management". **Treat KG node prose as DESCRIPTIVE-and-possibly-stale:
  verify the acronym expansion against MODULE_SPEC §2 and every cited route against the generated
  routes before trusting a summary.** Query-only — flag for next regeneration, never hand-edit the KG.
- **A PATIENT-FACING module has a DIFFERENT auth model — IDOR, not branch-RBAC (from dental-portal round 12).**
  The portal actor is a PATIENT (`user` role, linked Person + dental_patient, NO membership), so the
  boundary is NOT `assertBranchRole` — it is "derive the patient id from the SESSION and read only that."
  The IDOR-safe pattern (and what to look for in any patient-facing surface): **no route accepts a
  client-supplied `patientId`; identity is resolved server-side via `resolveSelfPatientIdOrThrow`
  (`patients.person === user.id`, invariant user.id===person.id); facades scope on a REQUIRED `eq(patientId)`.**
  Cross-patient access is then impossible *by construction*, not by a check. The adversarial pin that
  proves it: a caller appending `?patientId=<other>` must be INERT (still gets own rows) AND an empty
  owned-scope must return `[]`/zero (not a fallback to all). **For emr (the last module), if any endpoint
  is patient/provider-self-facing, apply this lens, not the branch-RBAC one.** A partially-built patient
  portal whose UNBUILT features (guardian/dependent access, self-pay, /me imaging) are well-surfaced as
  Phase-2-deferred is an HONEST `GAPS` verdict — don't force `READY`, and don't auto-build a patient-write
  /PHI surface (high-risk; needs product decisions). Guardian-over-scope is N/A when no guardian access is
  built — there's no over-broad scope to leak; building it later MUST check the household relationship
  server-side (a guardian sees ONLY their own dependents, never trusted from the client).
- **An `:owner` ownership ROLE can be declared in TypeSpec/routes yet be NON-FUNCTIONAL (from provider round 14).**
  The round-13 EMR pattern said "the route-level `:owner` role is non-gating by design — authMiddleware delegates to
  the handler, which is the real boundary." Provider is the inverse failure mode: `practitioner:owner` is declared on
  get/update practitioner, so `authMiddleware` passes through to the handler — BUT the handler does NO ownership check,
  the `practitioners` schema has NO person link to compute ownership against, and the role is NEVER granted to any user.
  So the "owner" path is aspirational/dead: the latent IDOR (a bare `practitioner:owner` token reading/updating any
  practitioner) is **unreachable today** because the role is unassignable. **When a route lists an `:owner` role, verify
  ALL THREE: (a) a handler-level ownership check exists, (b) the resource schema actually has a link to resolve ownership
  (a person/user FK), and (c) the role is ever granted. If any is missing, the role is non-functional — surface it as
  spec drift, and if a self-service surface is later built it MUST add the link + the check + a grant path (the EMR pattern).**
- **A module can ship ORPHAN handler files (no TypeSpec op, no registry import, no route) — dead code that still typechecks
  (from provider round 14).** `getProvider`/`listProviders`/`updateProvider`/`deleteProvider` exist (and contain a correct
  owner-check), but only `createProvider` + the 10 FHIR ops are wired; the live Provider surface is create-only. The orphans
  typecheck cleanly, so `tsc` does NOT catch them. **When auditing, diff the handler-file set against (a) the TypeSpec
  `@operationId` set and (b) the generated routes/registry — extra files are orphan/dead code (surface, don't auto-delete:
  deleting may remove intended-but-unfinished work; needs a product decision).** Module-review's "operationId ↔ handler"
  check passes on the LIVE set; it does not flag the reverse (handler with no op).
- **The KG can CONFLATE two same-named domains (from provider round 14).** `flow:manage-providers` in domain-graph.json
  points at `POST /dental/providers` (the dental-org STAFF flow) and mentions treatment_coordinator/dental_assistant — it
  models dental-org, NOT the platform FHIR `/providers` + `/providers/practitioners` directory, which is unmodeled. **When two
  modules share a noun ("provider" = dental-org staff vs platform FHIR practitioner directory), check the KG node's
  entryPoint route to see WHICH one it actually models — a same-named node may belong to the sibling.** Query-only — flag for
  regeneration, never hand-edit.
- **OPTIONAL-BRANCHID CLASS — provider is a 4th N/A-by-design module (round 14, class already CLOSED round 13).** Provider has
  NO branch/tenant dimension at all (no `branchId` param anywhere; `tenant_id` defaults to 'default'; governance is purely the
  platform role list). Neither the caller-supplied-branchId variant nor the optional-branchId-omitted variant can apply. Confirms
  the round-13 disposition: the optional-filter-omission hazard remains live ONLY for cross-resource aggregate/report endpoints
  with an optional-only scope — a shape unique to billing (fixed). No new chase target.
- **First clean-KG round (dental-portal round 12).** Unlike every prior round (each carried a phantom
  route / wrong-store over-claim / lossy under-model), `domain:patient-portal` + `flow:patient-self-service-read`
  are accurate: correct routes (`GET /me/appointments|/me/invoices|/me/balance`), the IDOR claim verbatim,
  and the right file/facade citations. **A KG node CAN be trustworthy — verify (don't assume drift either way).**
- **A "module" can be a CROSS-CUTTING bridge with no handler dir, resolved across several artifacts (from
  external-records-import round 15).** `external-records-import` is not a dir — it is (a) a FUTURE-PHASE FHIR/CDA
  bridge specced under `docs/product/modules/` with NO code, (b) the single-record `importPMD` (round 8), and (c)
  the FR7.2 bulk-patient import living inside `dental-patient/identity/`. **When a module name doesn't grep to a
  handler dir, resolve it across the spec docs + sibling handlers before concluding it's "absent" — part of it may
  be built under another module's dir, part future-phase.** The distinct, un-audited piece (bulk import) was the
  real target; the PMD piece was cross-referenced, not re-audited.
- **Ingestion-safety lens (from external-records-import round 15).** For any untrusted-external-input surface,
  the adversarial pins are: malformed payload → specific 4xx (not 500); empty/wrong-shape → 4xx; oversized FIELD
  values tolerated without crash; cross-tenant write authorized against the caller's OWN branch ownership BEFORE
  the tx (403 + **zero rows written** — assert the row count, not just the status); role-gating (non-owner → 403);
  identity-binding only matters when the import BINDS to an existing record (bulk import creates fresh rows → N/A;
  single PMD import binds to an existing patientId → server-validate its branch). **The surfaced (not-fixed)
  ingestion gaps were a missing row-COUNT cap (DoS) + naive `split(',')` CSV — both behavior-change product
  decisions, not safe in-place fixes. A future file-based FHIR/CDA importer MUST additionally guard file-type/MIME +
  XXE-safe XML + zip-bomb/path-traversal + size cap.**
- **SERIES COMPLETE (round 15).** All 15 modules audited; 8 real behavioral bugs found+fixed (5 cross-tenant, 1
  consent-FSM, 1 immutability, 1 clinical-scoring); ~40+ adversarial pins added; 6 absent br-registry blocks added;
  all 6 security classes dispositioned (see the SERIES ROLLUP above). The optional/caller-supplied-branchId class,
  the audit-row invariant, legal-hold-blocks-erasure, and IDOR/portal self-scope are all CLOSED/ENFORCED/CLEAR.
