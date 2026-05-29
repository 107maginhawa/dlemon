# Dentalemon — Brownfield Rescue Cycle 3

<!-- oli-magic v2 | generated: 2026-05-30 | cycle: 3 (LAST before blocked) | source: cycle-2 re-audit reports -->

## Overview
Close the cycle-2 graduation gap: lift **Confidence 8.0 → ≥9.0** and clear the residual P0-latent + consistency FAILs. Classified from the cycle-2 re-audit (CONFIDENCE_REPORT, TRACE_REPORT, COMPLIANCE_REPORT) + knowledge graph — NOT a discovery audit (specs are complete). The gap is **test-coverage reach**, not active defects.

**Graduation target:** P0=0, audit/compliance/confidence ≥ 9.0. **Cycle 3 is the last before `blocked`.**

## Progress
0/3 waves complete

## Phase Catalog

### Phase 1: Wave G9 — Security & Auth Hardening (sequential)
**Goal:** Eliminate the residual latent-P0 and the pmd auth gap before broad test work.

**Requirements:**
- S9-1 (GAP-DENTAL-027): add `admin` role guard to `POST /patients/merge` + `/patients/unmerge` (guard the stubs — do NOT implement merge business logic). Re-run engine scan → `CODE_SPEC_TRACE.auth_drift` empty.
- S9-2: dental-pmd deny-403 RBAC tests + regression test pinning `generatePMD` patientId binding (N-PMD-02).

**Success Criteria:**
- auth_drift = 0 in CODE_SPEC_TRACE; non-admin → 403 on merge/unmerge (test RED→GREEN).
- dental-pmd has deny-403 coverage; generatePMD identity guard pinned.
- Full suite green, typecheck clean.

**Mode:** tdd
**Depends on:** (none)
**Status:** not-started
**Parallel:** NO (security first, small)

---

### Phase 2: Wave G10 — Coverage Reach (parallel, disjoint modules)
**Goal:** Lift L1/L2 coverage breadth — the decisive confidence lever. Per-module, disjoint files → parallel-safe.

**Requirements:**
- S10-1: dental-imaging handler/contract tests across ~42 handlers (study, annotation, batch-landmark mutation + audit). Target L1/L2 4→8.
- S10-2: BR-036..047 (12 ceph business rules) — add test owners + assertions.
- S10-3: domain-event traceability — publisher-asserts-audit-row tests for the 18 untraced DE-NNN events (consumer/idempotency deferred per ADR-006; document in denominator).
- S10-4: patient + person base-module coverage — raise from L1/L2=3.

**Success Criteria:**
- dental-imaging, ceph BRs, events, patient/person each reach meaningful test ownership (Confidence L2 ≥ 9).
- No regressions; full suite green; assertions STRONG (no toBeDefined-only).

**Mode:** tdd
**Depends on:** Phase 1
**Status:** not-started
**Parallel:** YES (4 disjoint-module slices) — integration-test flag on S10-3 (cross-module events)

---

### Phase 3: Wave G11 — Consistency & Boundary Closure (refactor)
**Goal:** Clear the 2 FAIL-level CONSISTENCY findings holding compliance below 9.

**Requirements:**
- S11-1 (C4): resolve ROLE_PERMISSION_MATRIX vs MODULE_SPEC §6 permission-closure contradictions (3 HIGH). Reconcile matrix ↔ spec; no behavior change unless a real gap.
- S11-2 (C7 / GAP-021): break the dental-clinical → dental-visit direct repo import via a VisitService interface (bounded-context fix).

**Success Criteria:**
- CONSISTENCY_REPORT C4 + C7 → PASS (re-run `/oli-spec-gate`).
- No cross-module direct-repo imports (verify via CODE_IMPORT_GRAPH).
- Suite green, typecheck clean.

**Mode:** tdd
**Depends on:** Phase 2
**Status:** not-started
**Parallel:** NO (touches shared spec/boundary; codegen-coupled changes serialized)

---

## Notes
- **Codegen serialization:** any TypeSpec/OpenAPI changes (S11) run centrally with a single `specs/api build` + `api-ts generate`, NOT inside parallel agents (lesson from cycle-2 compliance pass).
- **Out of scope (deferred to V2):** implementing patient-merge logic; adding the 3 missing roles as new features (treat C4 as doc-reconciliation unless a real authz gap); claims/inventory/post-op modules.
- After all 3 waves: re-run `/oli-check --compliance --all` → `--confidence` → `--traceability` → `/oli-magic --update` for the cycle-3 graduation verdict.
