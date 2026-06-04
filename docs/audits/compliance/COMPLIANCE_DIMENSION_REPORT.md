# Compliance Dimension Report (oli-check)

---
Dimension: compliance
Audit Date: 2026-05-31
HEAD: f1b38d8
Map: docs/audits/codebase-map/ (v5, git_sha f1b38d8 == HEAD, fresh; provenance.fields_unavailable=[], confidence high)
Confidence threshold: MEDIUM
Focus: V-DG-001 data-retention enforcement vs DATA_GOVERNANCE.md §2 + compliance-program.tsp DataRetentionSchedule
Mode: READ-ONLY
---

## Audit Scope

| Artifact | Available | Notes |
|----------|-----------|-------|
| MODULE_SPEC.md | ✓ (12 modules) | retention is cross-cutting, no dedicated MODULE_SPEC |
| DATA_GOVERNANCE.md | ✓ | §2 Retention, §3 Right-to-Deletion authoritative |
| compliance-program.tsp | ✓ | FHIR-style `DataRetentionSchedule`/`LegalHold`/`CAPA`/`CompliancePolicy` |
| Codebase map | ✓ fresh | engine v5, all CODE_* fields available |

This run is scoped to the just-shipped V-DG-001 retention feature (per orchestrator instruction), assessed against the declared data-governance retention requirements. Full 12-module compliance sweep is covered by the standing `docs/audits/COMPLIANCE_REPORT.md`.

## V-DG-001 Assessment — Data Retention Enforcement

### What ships (verified from source)
- `dental_retention_policy` registry table (policy-as-data; tenant/branch scoped; unique on tenant+branch+entityType; migration `0076_past_annihilus.sql`). `retention-policy.schema.ts`.
- Generic engine `evaluateRetention()` with five hard safety invariants enforced in-engine regardless of policy row: (1) dry-run default, (2) never-purge audit (`protected` short-circuit + `retain` refusal before any read), (3) `delete`→`archive` downgrade (no hard-delete path exists), (4) legal-hold exemption (held candidates filtered out), (5) every real-target evaluation writes an append-only audit record. `retention-engine.ts`.
- Conservative seeded defaults: clinical/visit/attachment 10y (archive), prescription 5y (archive), audit 7y (retain), each stamped with a jurisdiction disclaimer. `retention-defaults.ts`.
- Cron wired: `registerRetentionJobs(jobs)` called in `app.ts:574`; daily 03:30; env-gated (`RETENTION_ENFORCEMENT_ENABLED`); dry-run unless explicitly "true". `jobs/index.ts`.
- Test coverage exists for all five invariants (engine, defaults, targets, jobs, repo test files present). Static existence verified; tests are DB-guarded (not executed here).

### Verdict on declared requirements
The engine **satisfies the safety/governance posture** declared in DATA_GOVERNANCE.md §2 (no auto-purge of clinical/audit, soft-archive, legal-hold-aware, fully audited, append-only audit preserved). The design is conservative and defensible. However, **enforcement is not yet end-to-end functional** for most declared entities, and the FHIR-spec compliance interface is unimplemented. Findings below.

## Findings

### P1 — Fix Before New Work

| ID | Module | Finding | Evidence | Suggested Fix |
|----|--------|---------|----------|---------------|
| V-RET-001 | retention | **Default policies are never seeded.** `seedDefaultRetentionPolicies()` has zero callers across `services/api-ts/src`, `scripts/`, `apps/`. The cron calls `repo.findEnabled()` against an empty table, so retention enforcement is a no-op at runtime until an operator manually inserts rows. DATA_GOVERNANCE §2 declares active retention requirements; none are enforced out of the box. | `retention-defaults.ts:50` (no callers); `jobs/index.ts:29` `repo.findEnabled()` | Call `seedDefaultRetentionPolicies(db, tenantId)` from org-bootstrap (alongside other per-tenant seeding) and/or the demo seed. |
| V-RET-002 | retention | **Target registry covers only `attachment`.** Defaults seed `clinical`, `visit`, `prescription` policies, but `RETENTION_TARGETS` registers only `attachment` + `audit`. The engine routes the other three to `outcome: 'no-target'` — silently skipped with only a `logger.warn`, no audit record. So the seeded clinical/visit/prescription policies never enforce even when enabled. Mismatch between declared defaults and enforceable targets. | `retention-targets.ts:86-89` vs `retention-defaults.ts:32-41` | Register `visit`/`clinical`/`prescription` targets, OR drop seeded defaults for entity types without a target until a target lands, to avoid declaring un-enforceable policy. |

### P2 — Fix When Touching

| ID | Module | Finding | Evidence | Suggested Fix |
|----|--------|---------|----------|---------------|
| V-RET-003 | retention/compliance | **compliance-program.tsp is spec-only — 0 generated routes, 0 handlers.** `compliance-program.tsp` is imported in `main.tsp:153` but the compiled `openapi.json` contains 0 `/compliance/*` paths, and no handlers exist for `createRetentionSchedule`/`createLegalHold`/`CAPA`/`CompliancePolicy`. The FHIR-style `DataRetentionSchedule` (months/legalBasis/jurisdiction/afterAction) the orchestrator referenced is **not the implemented model** — V-DG-001 uses a parallel `dental_retention_policy` (days/action/notes). This is a spec/impl divergence: two retention models, only one built. Classified P2 (spec gap + admin-only API absent), not P0, because the implemented engine is the safer authority. | `main.tsp:153`; `grep -c compliance/ openapi.json` = 0; no handlers | Either implement the compliance-program REST surface, or mark the TypeSpec interfaces as out-of-scope/deferred so spec-trace doesn't expect routes. Reconcile the two retention models in DOMAIN_MODEL. |
| V-RET-004 | retention | **Legal-hold predicate hard-coded `false`.** No legal-hold store exists; `findEligible` returns `legalHold: false` for every candidate. The engine's exemption logic is correct and tested, but with enforcement off-by-default this is currently latent. When enforcement is enabled before a legal-hold store lands, held records would NOT be protected. | `retention-targets.ts:55-56` | Acceptable while `RETENTION_ENFORCEMENT_ENABLED` stays false; before enabling live enforcement, land the legal-hold store and wire the predicate. Documented in code. |

### P3 — Track

| ID | Module | Finding | Evidence |
|----|--------|---------|----------|
| V-RET-005 | retention | `dryRun`/`no-target` skips are not audited (only logged). Operators auditing the trail won't see that clinical/visit/prescription policies were skipped. Minor observability gap. | `retention-engine.ts:157-164` |

## Known / Deferred (not counted)
- **V-DG-002 erasure (WFG-006)** — right-to-deletion / GDPR Art.17 orchestration unimplemented. Confirmed in DATA_GOVERNANCE §3 (`[WFG-006 — not yet implemented]`). Out of scope for this V-DG-001 ship; already on the deferred-P1 backlog. Not double-counted here.
- PHI at-rest encryption (G-012) — separate governance gap, not part of V-DG-001.

## Unverified (below confidence threshold)
0 nodes. All findings sourced directly from source code reads (engine, targets, defaults, schema, jobs, app.ts, openapi dist). Map was used only to confirm freshness; no finding relies on a low-confidence CODE_* node.

## Health Score (retention slice)
| Dimension | Score | Notes |
|-----------|-------|-------|
| Data governance — retention safety invariants | 9/10 | dry-run/never-purge/downgrade/legal-hold/audited all enforced + tested |
| Data governance — retention functional completeness | 6/10 | capped by P1: not seeded, targets incomplete |
| Spec↔impl consistency (compliance-program.tsp) | 6/10 | capped by P2 divergence |

## Verdict
**WARN** — V-DG-001 ships a sound, conservative, well-tested safety engine that honors the declared governance posture, but two P1 functional gaps (no seeding, incomplete target registry) mean declared retention is **not actually enforced end-to-end** yet, and the FHIR compliance-program spec surface is unbuilt. No P0: there is no data-loss, auth, or integrity risk (engine is dry-run-by-default and hard-refuses audit purge / hard-delete).
