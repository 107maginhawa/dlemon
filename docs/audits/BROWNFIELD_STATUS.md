<!-- oli-magic v2 | cycle: 1 | updated: 2026-05-21 (G1+G2+G2.5 execution) | generated: 2026-05-20 | run: fresh-from-scratch + --update -->

# Dentalemon — Brownfield Adoption Dashboard

**Updated:** 2026-05-21 (post-G1 + G2 + G2.5 execution) | **Cycle:** 1/3 | **Branch:** feat/v1.5-g1-foundation
**Source audits:** `EXISTING_CODEBASE_ADOPTION_AUDIT.md`, `COMPLIANCE_REPORT.md`, `CONFIDENCE_REPORT.md`, `TRACEABILITY_MATRIX_AUTO.md`
**execution_state:** `executed` — G1 ✅ G2 ✅ G2.5 ✅ (G3+G6-core pending)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Codebase health (audit) | ~8.5 / 10 (projected; re-run `/oli-audit-codebase` to confirm) |
| Compliance health | ~8.5 / 10 (projected; re-run `/oli-audit-compliance --all`) |
| Confidence (L1–L4) | **9 / 10** ✅ (confirmed — all 10 modules at 9, all 4 layers at 9) |
| P0 remaining | **0** ✅ |
| P1 remaining | **0** ✅ (all G1+G2 P1s resolved) |
| P2 remaining | **4** (F-012..F-016 — G3 scope) |
| P3 remaining | **1** (F-021) |
| Modules with MODULE_SPEC | **9 / 10 dental** ✅ (dental-emr added 2026-05-21) |
| BR trace coverage | 100% any (47 BRs + 15 CIMG), registry has 62 entries |
| AC coverage | **55 / 55 = 100%** ✅ (was 40 canonical, 15 promoted 2026-05-21) |
| Hurl contract coverage | **132 / 132 = 100%** ✅ (53 scenarios added 2026-05-21) |
| Handler test coverage | All 10 dental handlers ≥70% ✅ |
| Feature delivery | v1.4 G4 🔄 PENDING CI GREEN (G4-P1 ✅ G4-P2 ✅ feature-done, F-016 CI gate) |

**Graduation verdict:** 🔄 IN PROGRESS — G1+G2+G2.5 complete. G3 (domain refactor) + G6-core (error envelope, FSM property tests, ASVS L2, dental_audit table, OpenAPI drift) required to reach ≥9.0. Projected final: audit 9.7 / compliance 9.9 / confidence 10.0.

---

## Graduation Check

| Threshold | Required | Current | Status |
|-----------|----------|---------|--------|
| P0 open | = 0 | 0 | ✅ PASS |
| Audit health | ≥ 9.0 | 7.2 | ❌ 1.8 to go |
| Compliance health | ≥ 9.0 | 7.4 | ❌ 1.6 to go |
| Confidence (L1–L4) | ≥ 9.0 | **9.0** | ✅ PASS (confirmed) |
| P1 open | — (informational) | 7 | ⚠️ Material |

Thresholds from `.planning/config.json` → `graduation` block.
Rationale: treatment planning, PHI, prescriptions, and billing carry clinical/legal risk — 9.0 is the floor for a dentist-facing product.

**Path to 9.0:** G1 → G2 → G3 → G6 (estimated 6–10 weeks).
Projected scores after completion: audit 9.0 / compliance 9.3 / confidence 9.5.

---

## Module Health Scorecard

| Module | Purpose | P0 | P1 | P2 | P3 | MODULE_SPEC | Health |
|--------|---------|----|----|----|----|-------------|--------|
| dental-org | Orgs, branches, memberships, PINs | 0 | 0 ✅ | 0 | 0 | ✅ | 🟢 |
| dental-patient | Patient management | 0 | 0 | 1 | 0 | ✅ | 🟢 |
| dental-visit | Visits, treatments, charting | 0 | 0 ✅ | 1 | 0 | ✅ | 🟡 |
| dental-scheduling | Appointment management | 0 | 0 ✅ | 1 | 0 | ✅ | 🟡 |
| dental-billing | Invoices, payments, plans | 0 | 0 | 0 ✅ | 0 ✅ | ✅ | 🟢 |
| dental-clinical | Prescriptions, labs, consent | 0 | 0 | 1 | 0 | ✅ | 🟢 |
| dental-imaging | X-rays, findings, ceph | 0 | 0 ✅ | 0 ✅ | 0 ✅ | ✅ | 🟢 |
| dental-pmd | Patient medical documents | 0 | 0 | 0 | 0 | ✅ | 🟢 |
| dental-emr | EMR consultation notes | 0 | 0 | 0 | 0 | ✅ | 🟢 |
| shared | assertBranchAccess, guards | 0 | 0 ✅ | 0 | 0 | — | 🟢 |
| packages/ceph-math | Isomorphic ceph engine | 0 | 0 | 0 | 0 | — | 🟢 |

Legend: 🟢 healthy | 🟡 has open P1/P2 | 🔴 P0 open

---

## Finding Classification Table

| ID | Finding | Module | Priority | Classification | Wave | Status |
|----|---------|--------|----------|----------------|------|--------|
| F-001 | `assertBranchAccess` ignores `MemberRole` — role matrix not enforced at API | shared + dental-org | P1 | stabilize-existing | G1 | ✅ RESOLVED (G1-S1 commit 005885a) |
| F-002 | BR-005 auto-discard empty visit — NOT IMPLEMENTED | dental-visit | P1 | stabilize-existing | G1 | ✅ RESOLVED (G1-S2) |
| F-003 | CephLandmark state machine unguarded | dental-imaging | P2 | stabilize-existing | G1 | ✅ RESOLVED (G1-S3) |
| F-004 | PaymentPlan state machine unguarded | dental-billing | P2 | stabilize-existing | G1 | ✅ RESOLVED (G1-S4) |
| F-005 | Debug routes in production build (`imaging-test.tsx`, `imaging-comparison-test.tsx`) | dental-imaging | P3 | stabilize-existing | G1 | ✅ RESOLVED (G1-S5 commit 8baca44) |
| F-006 | 20 ACs untested (~50% coverage at audit time) | cross-module | P1 | stabilize-existing | G2 | ✅ RESOLVED (G2-S1 + G2.5-S2 — 55 ACs, 100% coverage) |
| F-007 | Zero ceph BRs in spec (BR-036+ not written) | dental-imaging | P1 | stabilize-existing | G2 | ✅ RESOLVED (BR-036–BR-047 in 5f246e3) |
| F-008 | 9/10 dental MODULE_SPECs missing | cross-module | P1 | stabilize-existing | G2 | ✅ RESOLVED (9 specs complete + dental-emr added) |
| F-009 | Dental endpoints absent from Hurl contract tests | cross-module | P2 | stabilize-existing | G2 | ✅ RESOLVED (132/132 endpoints, commit b8558d5) |
| F-010 | br-registry.json empty (35 BRs not populated) | cross-module | P3 | stabilize-existing | G2 | ✅ RESOLVED (62 entries in registry) |
| F-011 | booking (11%) + storage (20%) coverage below ratchet | booking, storage | P2 | stabilize-existing | G2 | ✅ RESOLVED (booking 70.9%, storage 72.2%, emr/imaging/patient all ≥70%) |
| F-012 | "Encounter" vs "Visit" — FHIR/dental terminology conflict in docs/comments | cross-module | P2 | refactor-existing | G3 | ⬜ OPEN |
| F-013 | No DOMAIN_MODEL.md — FHIR entity catalog not mapped to dental DB | cross-module | P2 | stabilize-existing | G3 | ⬜ OPEN |
| F-014 | DC-003, DC-006, DC-010, DC-014 — naming inconsistencies in schema/code | cross-module | P2 | refactor-existing | G3 | ⬜ OPEN |
| F-015 | DC-001, DC-007, DC-008 — ~25 bare UUID FK columns undocumented | cross-module | P2 | refactor-existing | G3 | ⬜ OPEN |
| F-016 | N+1 in EMR + pool exhaustion in parallel tests | emr | P2 | stabilize-existing | G3 | ⬜ OPEN (CI gate F-016 wired 2026-05-20, pending green) |
| F-017 | v1.4 Phase 1: Structured Imaging Findings (CIMG-01–06) | dental-imaging | — | new-feature | G4 | ✅ COMPLETE (2026-05-16) |
| F-018 | v1.4 Phase 2: Cephalometric Workspace | dental-imaging | — | new-feature | G4 | 🔄 PENDING CI GREEN (F0–F6 done, 32/32 E2E pass) |
| F-019 | v1.5 Periodontal Charting | (new module) | — | new-feature | G5 | ⬜ PLANNED |
| F-020 | Dental audit DB table (queryable trail beyond Pino) | cross-module | P2 | new-feature | G5 | ⬜ PLANNED |
| F-021 | No standalone ARCHITECTURE.md | cross-module | P3 | stabilize-existing | G5 | ⬜ OPEN |

---

## Wave Progress

| Wave | Name | Status | Slices Done | Total Slices | P-level | Score target |
|------|------|--------|-------------|--------------|---------|-------------|
| G1 | Foundation Stabilization | ✅ COMPLETE (2026-05-21) | 5 | 5 | P1–P3 | 7.5 / 7.7 |
| G2 | Spec & Coverage Completeness | ✅ COMPLETE (2026-05-21) | 6 | 6 | P1–P2 | 7.9 / 8.1 |
| G2.5 | G2 Push to Max | ✅ COMPLETE (2026-05-21) | 7 | 7 | P1–P2 | ~8.5 / 8.5 |
| G3 | Domain Model Refactoring | ⬜ NOT STARTED | 0 | 5 | P2 | 8.7 / 8.9 |
| G4 | Feature Delivery | 🔄 PENDING CI (F-016) | 2 | 2 | new-feature | — |
| G5 | Future Features | ⬜ PLANNED | 0 | 2 | new-feature | — |
| G6-core | Excellence (graduation push) | ⬜ NOT STARTED | 0 | 6 | P2–P3 | **9.7 / 9.9** |

**G4 detail:** G4-P1 (Structured Imaging Findings) ✅ COMPLETE 2026-05-16. G4-P2 (Ceph Workspace) F0–F6 committed, 32/32 E2E green — blocked only on CI gate F-016 (postgres-services.yml first green run).

**G2 detail:** G2-S4 (Hurl contracts) ✅ COMPLETE per spec review (`docs/audits/G2-S4_SPEC_REVIEW.md`, commit 3701e88). Remaining: G2-S1 (AC tests), G2-S2 (ceph BRs), G2-S3 (MODULE_SPECs), G2-S5 (br-registry), G2-S6 (booking/storage coverage).

---

## UI Compliance Discovery

**Frontend detected:** `apps/dentalemon` (React 19 + TanStack Router), `apps/sample-workspace` (Vite standalone prototype)

| Dimension | Status | Notes |
|-----------|--------|-------|
| Component library | ✅ Shadcn/Radix (inlined) | Consistent primitive usage across app |
| Design tokens | ✅ Tailwind CSS | Custom CSS vars for lemon accent (#FFE97D per DESIGN.md) |
| Accessibility | ⚠️ Partial | Radix handles a11y; custom dental chart components unverified |
| Form validation | ✅ Zod + TanStack Form | All forms validated |
| Responsive / iPad | ⚠️ In progress | v1.3 iPad spike done; layout not fully verified |
| Debug routes in prod | ❌ P3 risk | `imaging-test.tsx`, `imaging-comparison-test.tsx` in production bundle (F-005, G1-S5) |
| Prototype isolation | ✅ Separate app | `apps/sample-workspace` not bundled with production app |

No new UI-NNN findings this update cycle. Re-run Step 2e after G1 execution to detect any regressions.

---

## Health Trend

| Date | Run | Audit Health | Compliance Health | Confidence | BR Trace (full) | P0 | P1 Open |
|------|-----|-------------|-------------------|------------|-----------------|----|----|
| 2026-05-14 | fresh | 5.4 / 10 | — | — | — | 4 | — |
| 2026-05-18 | fresh | 7.2 / 10 | 7.4 / 10 | ~9 / 10 | — | 0 | 7 |
| 2026-05-20 | --update | 7.2 / 10 | 7.4 / 10 | **9 / 10** ✅ | 29% (10/35 unit+E2E) | 0 | 7 |

**Note:** Audit and compliance scores unchanged because upstream audit/compliance reports were not re-run this cycle (G0 Phase B'' was test-infra, not feature/security work). Re-run `/oli-audit-codebase` and `/oli-audit-compliance --all` after Wave G1 execution to see score movement.

---

## Cleanup Candidates

Populated after G0 Phase B'' execution (2026-05-20). Review before deleting — these are suggestions, not commands.

| File/Dir | Category | Reason | Safe to Remove? |
|----------|----------|--------|-----------------|
| `docs/audits/2026-05-19-scaffolding-infra-audit.md` | Dead doc | STATE.md: "STALE — describes pre-fix code. CORS, Swiper CVE, and prod-secret-guard issues resolved in 19db952/361d938." | LIKELY — verify no open items remain |
| `docs/audits/2026-05-19-workspace-clinical-workflow-audit.md` | Dead doc | STATE.md: "STALE — describes pre-fix code." Large (52KB) — superseded by JOURNEY_VERIFICATION.md + G0-E2E-DRIFT.md | LIKELY — verify before deleting |
| `tests/quarantine/storage.test.ts` | Quarantined test | Moved from main suite in G0 Task 7. Infra issue (PostgreSQL "too many clients"). Not a code defect. | VERIFY — keep until pool exhaustion (F-016) resolved |
| `tests/quarantine/email.test.ts` | Quarantined test | Same quarantine as storage. SMTP infra dependency. | VERIFY — keep until infra resolved |
| `apps/sample-workspace/` | Prototype | Standalone prototype, not imported by production app. Already confirmed isolated. | VERIFY — confirm zero imports from production bundle before archiving |

**NEVER auto-delete.** "Safe to Remove?" is a suggestion only. The quarantined tests in particular should be restored, not deleted, once F-016 (pool exhaustion) is resolved.

---

## What's Next

**Priority order (recommended):**

1. **Close F-016 CI gate** — wait for `postgres-services.yml` first green run on `feat/v1.4-clinical-imaging`. This unblocks G4 completion. Mark F-016 in STATE.md as CLOSED once confirmed.

2. **Execute Wave G1** (Foundation Stabilization) via `/gsd-execute-phase`
   - Fix RBAC: `assertBranchAccess` + `MemberRole` enforcement (G1-S1)
   - Implement BR-005 auto-discard empty visit (G1-S2)
   - Guard CephLandmark + PaymentPlan FSMs (G1-S3, G1-S4)
   - Remove debug routes from production build (G1-S5)
   - **This is the highest-value stabilization wave** — closes 2 P1s and the most critical security gap

3. **Continue Wave G2** (5 slices remaining, G2-S4 ✅ already done)
   - G2-S1: Write remaining AC tests (audit says 20 untested, confidence 9/10 suggests improvement — re-audit after G1 to confirm)
   - G2-S2: Write ceph BRs (BR-036+) in BUSINESS_RULES.md
   - G2-S3: Write 9 MODULE_SPECs
   - G2-S5: Populate br-registry.json
   - G2-S6: Boost booking (11%) + storage (20%) coverage

4. **After G1+G2 complete:** Run `/oli-audit-compliance --all` → `/oli-confidence-stack` → `/oli-magic --update` for next graduation check cycle.

5. **Wave G3** (Domain Model) after G2 lands.

**To refresh this dashboard:** `/oli-magic --update` (after compliance + confidence re-audits)

**Current execution_state:** `planned` → `executed` after G1+G2+G3 complete → `audited` after re-audit → `graduated` / `cycle_N` after graduation check
