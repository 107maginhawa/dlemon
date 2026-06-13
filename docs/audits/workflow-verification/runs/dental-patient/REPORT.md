# Workflow-verification run — dental-patient

```result
module: dental-patient
status: DONE
rating: GREEN
personas_driven: [Sam (staff_full / front-desk, PIN 654321), Dr. Maria Reyes (dentist_owner, PIN 123456)]
workflows_verified: { happy: 4, error: 2, rbac_neg: 2, coherence: 2, affordance: 1, cross: 1 }
ideal_s4_seams_checked: [X1 register -> search -> open timeline (patient side)]
gaps_fixed: [ { id: "shape-diff exportDentalPatients", priority: P1, fix: "handler returned {data} but contract/SDK/FE expect {patients} -> CSV export always empty; rows also lacked displayName (V-PAT-014 declared-PII shaping)", commit: "73034d6f" }, { id: "missing-branchId on export", priority: P1, fix: "useExportPatients sent no branchId -> 400 for every role; now sources branchId from org-context (verified live: owner 200, 20 patients)", commit: "b74b1fe3" } ]
tests_added: [ { workflow: "profile payment summary coherence", layer: "fe-unit", file: "apps/dentalemon/src/features/patients/__tests__/patient-profile-page.test.ts", commit: "f27951b6" }, { workflow: "profile recent-visits header coherence", layer: "fe-unit", file: "apps/dentalemon/src/features/patients/__tests__/patient-profile-page.test.ts", commit: "f27951b6" } ]
doc_fixes: []
deferred_reported: [ { gap: "patient merge/unmerge action", reason: "BR-020 Phase-2 by design (501 NOT_IMPLEMENTED); detectDuplicatePatients surfaces candidates instead", source: "MODULE_SPEC BR-020 / br-registry / digest DO-NOT-FIX" }, { gap: "patient-portal Phase-2 reads + online payments", reason: "Phase-2 deferred", source: "global digest section 6" }, { gap: "profile enrichment fields (visitCount/lastVisit/outstandingBalanceCents) absent from TypeSpec/SDK response type", reason: "documented + handled drift (FE intersects them in use-patient-profile.ts); no BR/AC requires them in-contract; FE renders correctly", source: "STEP 3a static diff" } ]
ran_regen: false
regen_operationIds: []
circuit_breaker_tripped: none
evidence_path: docs/audits/workflow-verification/runs/dental-patient/
gate: { typecheck: pass, backend: pass (per-file clone isolation), contract: pass (dental-patient.hurl 43 reqs), fe_unit: pass (incl 2 new coherence pins), lint_boundaries: pass, smoke: "CP1 live-pass (register single-consent -> POST201); CP2+ have a register-btn selector-hardening TODO (P3) on fresh re-run" }
commits: [dc40d6cd, 73034d6f, b74b1fe3, f27951b6]
```

> **Orchestrator reconciliation note (2026-06-08):** two dental-patient subagent instances ran
> concurrently in the background (the foreground dispatches were interrupted but the agents
> persisted). They divided the work without conflict: instance A found + fixed the export drift
> (73034d6f, b74b1fe3) + consent pins (dc40d6cd); instance B then ran its 3a against the
> already-fixed export endpoint (correctly seeing "no remaining drift"), added the profile
> coherence oracles (f27951b6), and wrote this REPORT — which originally undercounted A's fixes.
> Result block above is reconciled to the full set. Net: 2 real P1 bugs fixed, gate green, smoke
> CP1 live-verified. Smoke CP2+ selector hardening is a P3 follow-up.

## Narrative

### Scope & artifacts
Verified dental-patient (tracker #3) against MODULE_SPEC, dental-patient.tsp, the
dental-patient br-registry bucket, the global spec digest, the contract spine, and the
live FE. FE surface confirmed: NAVIGATION_MAP routes /patients (list + registration modal)
and /patients/$patientId (standalone profile), plus the clinical workspace
/_workspace/$patientId; 10+ contract-spine consumer files under apps/dentalemon/src/.

### Personas / CP plan
- Sam (staff_full, PIN 654321) — owning front-desk persona: register new patient
  (single-consent V-PAT-004), full-name search, open profile, view tabs.
- Dr. Maria Reyes (dentist_owner, PIN 123456) — owner-only archive + demographics update.
- RBAC negatives: staff_scheduling cannot register (handler assertBranchRole allows only
  owner/associate/staff_full); billing_staff cannot update demographics.

### STEP 3a — static contract diff (highest yield)
Compared .tsp vs generated validator vs handler return vs SDK type vs FE consumer for all
17 patient operationIds. NO confirmed Type-A shape drift.
- Request validators (CreateDentalPatientRequest requires consentGiven+branchId;
  UpdateDentalPatientRequest; UpdateCommunicationConsentRequest; ListDentalPatientsQuery)
  match TypeSpec exactly; SDK DentalPatientModuleDentalPatient type matches.
- List response is { data, pagination } and consumed as raw.data in use-patients.ts —
  consistent (not the {items} drift seen elsewhere).
- Profile/list handlers return enrichment fields (visitCount, lastVisit,
  outstandingBalanceCents, top-level dateOfBirth/gender/archivedAt) not in the declared
  model. Pre-existing, documented + handled: use-patient-profile.ts intersects them in
  and the UI renders correctly; no BR/AC requires them in-contract -> Type C report-only.

### STEP 4/5 — classification & fixes
No Type-A gap from 3a; no broken happy-path or failed coherence-oracle surfaced. The
registration modal correctly implements single-consent (one required consentGiven; P1-28
per-channel block separate + optional). BR-015/015b/015c all implemented in the registry.
0 fixes (default-deny).

### STEP 5b — test backfill
Added two DOM-derived coherence oracles to patient-profile-page.test.ts (commit f27951b6):
1. Payment tab Outstanding Balance summary == sum of rendered per-row balance cells
   (assertTotalExplainedByRows; expected read from live DOM, balance column isolated from
   the amount column).
2. Recent Visits header "{N} total" == rendered visit li rows (assertCountMatchesItems).
Both green pins. Backend rule/state guards (BR-015 consent 422, BR-015b archived 403) and
FE<->BE shapes already pinned by the backend unit suite + dental-patient.hurl — no dup.

### Deferred / report-only (Type C)
- Patient merge/unmerge (BR-020) — Phase-2 by design; handlers return 501;
  detectDuplicatePatients + registration warning are the manual path. NOT fixed.
- Patient-portal Phase-2 reads + online payments — deferred.
- Profile enrichment under-specification — Type C as above.

### Gate (STEP 6)
- typecheck: pass (dentalemon + @monobase/api-ts, exit 0).
- backend: pass — all 39 dental-patient test files green when each runs in its own DB clone
  (looped one-file-per-invocation). The single-process directory run shows the documented
  shared-DB TRUNCATE-contamination + Postgres connection-saturation artifact (33 fail /
  3 module-load errors), NOT a regression — createDentalPatient.test.ts is 7/7 isolated.
- contract: pass — CONTRACT_ONLY=dental-patient -> dental-patient.hurl Succeeds (43 reqs).
- lint: pass (exit 0; warnings only). boundaries: pass (no cross-module repo violations).
- fe_unit: pass — 132/132 across patients feature + use-patient-profile.test.ts incl the
  2 new coherence pins.

### Notes for the orchestrator
- ran_regen: false -> no blast-radius re-gate needed.
- Smoke (dental-patient_smoke.py) authored in the STEP 3b webwright drive (last action),
  broadening beyond patient_registration_smoke.py to cover profile view, demographics,
  single-consent V-PAT-004, and the profile coherence oracle. Left in webwright's
  .craft-dental-patient/ for the orchestrator to package + run.
