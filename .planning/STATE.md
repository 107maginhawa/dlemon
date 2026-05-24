---
gsd_state_version: 1.0
milestone: "v1.5-g1"
milestone_name: milestone
status: in-progress
stopped_at: Wave 0 CI unblock + roadmap sweep (2026-05-24)
last_updated: "2026-05-24T14:00:00.000Z"
progress:
  total_phases: 13
  completed_phases: 11
  total_plans: 28
  completed_plans: 28
  percent: 85
---

## Current Position

### v1.5 Spec Pipeline + G3 Follow-ups + G5-S1 — COMPLETE (2026-05-24)

All items landed on feat/v1.5-g1-foundation:

- 856a7dc — oli-magic spec pipeline (UI blueprints × 70 files + spec consistency PASS)
- e31fba1 — G3-S6/S7/S8/S9 (glossary imagingTier, audit route consolidation, visit Reopen removed, §4 workflow details)
- 018c25c — G5-S1 dental-perio module (TypeSpec + 2 tables + 5 handlers + tests + UI prototype)
- 8b74926 — Wave 0: tighten FSM transition types + null-assert AC-G2-S1 [typecheck CI unblock]

Next: Wave 3a (G6-S5 metrics, G6-S6 perf ratchet) + Wave 3b (G6-S8 iPad E2E, G6-S9 frontend coverage).

### G3 Domain Refactor — COMPLETE (2026-05-21)

All 6 G3 slices done on feat/v1.5-g1-foundation:

- G3-S1: Terminology "Encounter"→"Visit" in docs/comments ✅ (7bd46f9)
- G3-S2: docs/architecture/DOMAIN_MODEL.md written — 19 entities, ER diagram, FHIR R4 ✅ (5ee8509)
- G3-S3: DC-003/006/010/014 naming inconsistencies documented ✅ (b61c76f)
- G3-S4: ~25 bare UUID FKs — 2 real FKs added, 10 loose-coupling comments, 2 not-FK ✅ (5def6c0)
- G3-S5: EMR N+1 fixed (getBatchConsultationStats) + pool exhaustion fixed (max 5→2) ✅ (21585cc)
- G3-S6: BROWNFIELD_STATUS F-012..F-016 → ✅, STATE.md updated ✅

### G6-core — COMPLETE (2026-05-21)

All 6 G6 slices done on feat/v1.5-g1-foundation:

- G6-S1: Error envelope doc + conformance test ✅ (74c01e6 + 012e4ec — docs/api/ERROR_ENVELOPE.md + 28-test conformance suite)
- G6-S2: Property tests for 10 FSMs ✅ (all 10 FSMs have fast-check property tests, pre-existing)
- G6-S3: ASVS L2 checklist + THREAT_MODEL.md ✅ (docs/audits/ASVS_L2.md + THREAT_MODEL.md, pre-existing)
- G6-S4: dental_audit DB table + Pino shim + admin endpoint ✅ (migration 0037 + audit-logger.ts + audit.repo.ts + getAuditEvents.ts, pre-existing)
- G6-S7: TypeSpec @example annotations + OpenAPI drift CI ✅ (1e6218c — 4 examples each on dental-clinical.tsp + dental-org.tsp; drift CI pre-existing)
- G6-S10: Migration safety lint + CI script ✅ (scripts/lint-migrations.ts + quality.yml wired, pre-existing)

### G1 Foundation Stabilization — COMPLETE (2026-05-21)

All 5 G1 slices done on feat/v1.5-g1-foundation:

- G1-S1: staff_scheduling 403 tests — dental-treatment, dental-billing, clinical-prescription ✅ (8baca44 + 005885a)
- G1-S2: BR-005 auto-discard tests confirmed green — 5/5 pass ✅
- G1-S3: CephLandmark FSM 422 tests confirmed green — 52/52 pass ✅
- G1-S4: PaymentPlan FSM 422 tests confirmed green — 11/11 pass ✅
- G1-S5: imaging-test bundle guard via routeFileIgnorePattern ✅ (8baca44)
- Cross-module E2E: role-gates-scheduling.spec.ts — staff_scheduling 403 end-to-end ✅ (005885a)

Total new tests: 4 unit + 1 E2E. All 121 G1-S1 tests pass (33 + 58 + 30).

### Clinical Workflow Completion — PHASE 1 COMPLETE (2026-05-19)

All P0 + P1 clinical-workflow slices committed on feat/v1.4-clinical-imaging:

- P0.1 surfaceConditionMap persistence (Gap #9) ✅
- P0.2 ceph seed fail-loud chain ✅
- P0.3 journey harness re-baseline ✅
- P1.1 signed/locked visit notes + addendum + audit (J02, J10) ✅ 8bb37fc / f6b00b9
- P1.2 treatment-plan versioning + acceptance link (J09) ✅ e65b4d0
- P1.3 chart entry-classification status (J01, J02, J05) ✅ 804330b
- P1.4 informed refusal — declined status + refusalReason (J08) ✅ 361d938

Phase 2 DEFERRED (accepted scope cuts):

- Gap #7 periodontal charting (J03) — spec done, zero runtime; scheduled v1.5
- Gap #14 treatment-plan phasing UI (J06) — scheduled v1.5

### Production Readiness — TIER 0 COMPLETE (2026-05-19)

Committed on feat/v1.4-clinical-imaging (19db952):

- PHI log redaction: pino redact for 22 PHI/credential paths + query-string URL strip
- Security test enforcement: HSTS/CSP/NODE_ENV gating + CORS fail-closed behavioral tests
- Prod credential guard: rejects minioadmin storage creds and default postgres:password DB URL at startup

Pending (Tier 1): fresh journey harness re-baseline to confirm J04/J07/B01-B04 + per-slice flips.
Pending (Tier 2 close-out): docs/STATE.md finalization when harness run is green.

### Known Production Residuals (accepted, documented)

- *_version tables (visit_note_version, treatment_plan_version) are append-only **by
  application convention**. DB-enforced REVOKE UPDATE/DELETE is a scheduled fast-follow
  for medico-legal tamper-evidence hardening.

- J03/J06 BROKEN-by-design (Phase 2 deferred). Documented, not regression.
- Non-production env gets Hono default headers only (HSTS/CSP prod-only by design).
- 2026-05-19 audit docs are STALE — they describe pre-fix code. CORS, Swiper CVE,
  and prod-secret-guard issues are all resolved. See 19db952 and 361d938.

### Track A — v1.4 Clinical Imaging Feature Roadmap (IN PROGRESS)

Phase 4: Cephalometric Workspace — feat/v1.4-clinical-imaging

- S0 (test harness) ✅ fa0cf86
- F0 (ceph-coords transform) ✅ 513c407
- F1 (landmark hooks) ✅ 513c407
- F2 (ceph-geometry lib) ✅ 2a3a22f
- F3 (7 Ceph canvas/panel components + tests) ✅ 26d725f
- F4 (wire ceph into imaging-workspace) ✅ 59f13d4
- F5 (ceph-export + CephReportView + print route) ✅ adbd388 — 152 unit tests GREEN
- F6 (E2E specs + harness fix) ✅ GREEN — 32/32 ceph tests pass
    - Root cause: ApiProvider 401-interceptor → hard redirect; fixed with isHarnessRoute() noop in app.tsx
    - Shared harness helper created: tests/e2e/helpers/imaging-harness.ts
    - Former [RED] tests now green: CEPH-05 (layer toggle), CEPH-09 (PNG button)
  v1.4 Phase 2+3 COMPLETE.

Phase: 11 — Structured Imaging Findings (COMPLETE — Phase 3 gate closed 2026-05-16)

### Track B — Audit / Confidence Stabilization (TIER 2 R2 CLOSED 2026-05-17)

History: Tier 1 was prematurely declared closed (commits 11ab1bc/4457bab). Independent
review then found a real, reproducible test-fixture defect: dental-visit/billing/scheduling/pmd
suites failed in isolation because cross-suite shared-DB seeds collided on
dental_membership's (person_id, branch_id) partial unique index (onConflictDoNothing masked
it). D-01's FK constraint correctly surfaced it. Fixed by giving each suite a unique
BRANCH_ID + membership id (org/patient/person ids kept original for idempotent no-op).
Tier 1 Status: All 4 P0 fixes done (M1/SM-01/B-01/D-01). 12/12 test-quality P0s verified.
Fixture defect fixed. Confidence: 6/10. CLOSED 2026-05-16.

Tier 2 Round 1 Status: CLOSED 2026-05-16.

- dental-visit-module4.test.ts added: 15 tests, 15 pass, 0 fail
- dental-billing-module3.test.ts added: 19 tests, 19 pass, 0 fail
- upsertVisitNotes.ts: ForbiddenError guard added (latent 500 → 403)
- L1: 6→7, Overall: 6→7

Tier 2 Round 2 Status: CLOSED 2026-05-17. Overall: 7 (L1 7→8, L3 7→8, L2 bottleneck at 7).

- T1: route-registration.test.ts — 216 routes verified via set-equality + handler-identity binding
  (13 tests; structural gap closed — prior: "No dedicated route registration tests exist")

- T5: email handler suite — 42 tests (email-templates.test.ts 22 + email-queue.test.ts 20)
  9 handlers covered; avg 95.7% line, min 71.6%. Email CRITICAL eliminated.

- T4: comms unskip — chatRoomId seeded in beforeAll; 43/43 previously-skipped tests passing, 0 fixme.
  Comms CRITICAL → HIGH.

- T2: honest path-glob coverage baseline (c8 ignore NOT supported by Bun — documented)
- T3: bunfig.coverage.toml opt-in ratchet (line=62, function=61, branch=40)
- T8: #15 + #16 closed (billing-queue-morgan swallowed .catch; billing.spec.ts conditional)
- T10: #22 + #23 closed (tooth-slideout .toBeTruthy→.not.toBeNull; UUID receipt numbers)
- Handler coverage: email 0%→95.7% avg, comms 18%→84.2% avg (scoped runs)
- L1: 7→8 (route-reg closed + email + comms CRITICAL eliminated)
- L3: 7→8 (P1 items #15/#16/#22/#23 all closed)
- Overall: stays 7 (L2 bottleneck: AC coverage 50% vs target 70%, persona E2E 10–43%)

Deferred to Round 3: T6 (booking 11%), T7 (storage 20%), T9 (setTimeout ~38 sites), #21.

Still open (separate, non-blocking infra): full `bun test` (113 files parallel) hits
PostgreSQL "too many clients already" — distinct connection-pool issue, not a code defect.
Next decision: Tier 3 (continue coverage sprint: booking/storage/L2 AC) OR resume v1.4 ceph feature.
Reference: ~/.claude/plans/are-these-still-part-golden-pearl.md

## Accumulated Context

### Decisions

- [04-04] Prefixed dental-org models with Dental to avoid collision with healthcare module models
- [04-04] recoverPin TypeSpec op has no @useAuth — preserves existing public endpoint posture
- [04-04] workingHours re-export shims placed in dental-org/ to match codegen import paths
- [07-01] ModalityEnum 7 values: periapical|bitewing|panoramic|cephalometric|intraoral_photo|extraoral_photo|other
- [07-01] imaging_study_tooth is JOIN TABLE (not JSONB) for indexed tooth-number queries
- [07-01] listPatientImages union: imaging_study_image(source:imaging) + dental_attachment(source:legacy)
- [07-02] zoom/pan state in useRef (not useState) for zero-rerender perf
- [08-01] Geometry discriminated union: 'distance' API type maps to 'line' DB enum
- [08-01] Org imagingTier resolved via dentalBranches→dentalOrganizations join using study.branchId
- [09-01] Annotation types bypass free-tier gate; only measurement types are tier-gated
- [09-02] CreateMeasurementInput.measurementValue/measurementUnit optional for annotation types
- [TypeSpec route fix] PatientImageListing @route must use /{patientId}/images on op (not interface) due to main.tsp override pattern

### Blockers

(none)

### Todos

(none)

### Prior Milestones Completed

- ✅ v1.0 Dental Patient Backend (shipped 2026-05-06)
- ✅ v1.1 PR1 Frontend Completion (shipped 2026-05-06)
- ✅ v1.2 Wire & Ship (shipped 2026-05-09)
- ✅ Plan B: Audit Stabilization (shipped 2026-05-09)
- ✅ Workspace Reconciliation Phases 1-2 + partial Phase 6 (shipped 2026-05-10)
- ✅ v1.2.1 Workspace Reconciliation Phases 3-6 / TypeSpec Migration (shipped 2026-05-11)
- ✅ v1.3 Imaging Workspace (shipped 2026-05-11) — 6 phases, 11 plans, IMG-01–IMG-18

### G0 Phase B'' — Repo Test Stabilization + CI Gate — COMPLETE (2026-05-20)

Tasks 1–9 done on feat/v1.4-clinical-imaging:

- seedClinicalChain helper extracted (cfd3824); 7 repo test files migrated (Tasks 2–5b)
- patient/repos + dental-chart/repos: 27/27 pass, no FK failures (Task 6)
- storage.test.ts + email.test.ts quarantined under tests/quarantine/ (Task 7)
- E2E drift triaged → docs/audits/G0-E2E-DRIFT.md; booking.host rename + pagination.totalCount fixed (Task 8)
- .github/workflows/postgres-services.yml wired (Task 9)

**F-016** — CI gate wired; branch pushed 2026-05-20. Status: PENDING first green run.
Update to CLOSED once postgres-services.yml passes on this branch.

## Session Continuity

Last session: 2026-05-24T08:54:57.305Z
Stopped at: context exhaustion at 76% (2026-05-24)
Resume file: None
Resume branch: feat/v1.4-clinical-imaging

### Journey Harness Audit Cycle — COMPLETE (2026-05-19)

All Tier A (harness trust) and Tier B (small real gaps) items shipped:

- A1: J04 two-step revenue chain spec fixed
- A2: J02/J10 visitId resolution fixed
- A3: B01-B04 ceph branchId param fixed
- A4: Stale AUDIT test corrected
- B1: Server consent gate (TREATMENT_CONSENT_REQUIRED) on updateDentalTreatment
- B2: Visit-lock guard (VISIT_LOCKED) on upsertVisitNotes
- B3: surfaceConditionMap persisted through chart save
- Phase 5: CONFIDENCE_RECONCILED.md written + CONFIDENCE_REPORT.md correction banner
- Phase 6: journey-verification CI job added to quality.yml
