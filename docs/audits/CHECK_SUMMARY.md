---
oli-version: "1.0"
based-on:
  - docs/audits/enforce/module/dental-org.md
  - docs/decisions/ADR-007-self-service-onboarding.md
  - services/api-ts/src/handlers/dental-org/createOnboarding.ts
  - services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts
  - specs/api/src/modules/dental-org.tsp
  - services/api-ts/src/generated/openapi/routes.ts
  - services/api-ts/src/generated/openapi/registry.ts
  - services/api-ts/src/generated/migrations/0088_sloppy_sprite.sql
  - docs/audits/codebase-map/.map-meta.json
last-modified: 2026-06-03
last-modified-by: oli-check
run: "focused — reconciliation verification of the self-service onboarding batch (enforcement + traceability + diff bug-hunt)"
---

# OLI Check — Roll-Up Summary

## 0. TRUST STATUS

```
PRODUCER:      engine (oli-engine v0.1.0) — map artifacts carried from prior run
MAP-FRESHNESS: STALE-OVERLAP — map@c26d37b (branch feat/ceph-demoable-and-manual-ux)
               vs HEAD@c47ba346 (branch fix/standards-review-batch)
SCOPE:         backend handlers + TypeSpec/OpenAPI codegen + migration (raw-source dimensions, map-blind by design)
fields_unavailable: []
unverified:    0
─────────────────────────────────────────────────────────────────────
THESIS NOTE: the frontend codebase-map is stale on this branch, BUT this run is a
FOCUSED reconciliation of a backend/spec change. The dimensions exercised
(enforcement, traceability, diff bug-hunt) read RAW SOURCE and direct file
evidence — they do not consume the frontend graph — so map-staleness does not
bear on the verdict below. A full multi-dimension --auto re-run (with a fresh
rescan) was offered and deliberately scoped OUT; the 2026-06-02 full-state PASS
stands for everything outside this batch.
```

---

## 1. GATE VERDICT

```
GATE: PASS
```

The self-service onboarding batch (`243316db`→`c47ba346`, 9 commits) introduced **no new P0/P1**, the **EM-ORG-002 admin gate remains enforced**, and the new `POST /dental/onboarding` operation is **fully traceable** end-to-end. No drivers block the gate.

## 2. Triage — Fix-First Ranking

✓ No actionable findings. Pipeline unblocked.

## 3. Run Context

- **Date:** 2026-06-03 · **Branch:** `fix/standards-review-batch` · **HEAD:** `c47ba346` (local-only, not pushed)
- **Invocation:** focused reconciliation — "validate the EM-ORG-002 reconciliation holds; triage FIX-NOW vs DEFER"
- **Batch under review:** `243316db^..c47ba346` — self-service clinic onboarding (`POST /dental/onboarding`)
- **Dimensions exercised:** Enforcement (EM-ORG-002), Traceability (onboarding codegen chain), adversarial diff bug-hunt
- **Method:** read-only multi-agent investigation against raw source + audit/decision docs (map-blind)

## 4. Dimension Results

| Dimension | Verdict | report_age | Key findings | unverified |
|-----------|---------|------------|--------------|------------|
| Enforcement (EM-ORG-002 reconciliation) | **PASS** | current (direct-source) | 0 — admin gate intact, annotation well-formed, no re-flag | 0 |
| Traceability (`POST /dental/onboarding`) | **PASS** | current (direct-source) | 0 — full chain present, zero codegen drift | 0 |
| Diff bug-hunt (batch `243316db^..c47ba346`) | **PASS** | current (direct-source) | 0 new P0/P1 — tx atomic, race-safe, FE mapping + SSE gate correct | 0 |

### Enforcement — EM-ORG-002 reconciliation HOLDS
- `docs/audits/enforce/module/dental-org.md:73-74` annotates EM-ORG-002 **"RESOLVED + ENFORCED"**, cites the live gate at `DentalOrganizationManagement_create.ts:24`, references **ADR-007**, and explicitly instructs against re-flagging. An enforcement re-scan reading this treats it as resolved-and-enforced — NOT a re-opened P0.
- Admin gate `DentalOrganizationManagement_create.ts:24` (`if (user.role !== 'admin') throw new ForbiddenError(...)`) is **literally unchanged**; no self-service/bypass branch added.
- `createOnboarding.ts` has **no admin path**; all four compensating guardrails are code-present — prod verified-email → `403 EMAIL_NOT_VERIFIED`, one-active-org pre-check → `409 ORG_LIMIT_REACHED`, tier gate `solo`/`clinic` → `403 TIER_NOT_SELF_SERVICE`, prod-only IP rate-limit → `429`. Audit row records real `actorRole: 'dentist_owner'` + `mode: 'self-service'`, not hardcoded `'admin'`.
- No other audit/enforce doc re-flags EM-ORG-002 as open (`ENFORCEMENT_FIX_REPORT.md` cites it as fixed).

### Traceability — INTACT (zero drift)
TypeSpec `DentalOnboarding` (`dental-org.tsp:703`) → OpenAPI `/dental/onboarding` (in sync) → generated route **registered** (`routes.ts:1124`) → validator → registry binding (`registry.ts:110,478`) → handler → migration `0088_sloppy_sprite.sql` (status column + partial unique index `dental_org_one_active_per_owner`, journaled idx 88). No dead-handler.

### Diff bug-hunt — NO NEW P0/P1
- Org+branch+membership creation is one atomic `db.transaction()` — full rollback on any failure, no partial tenant.
- One-active-org is race-safe: app pre-check **and** DB unique-index violation both resolve to `409 ORG_LIMIT_REACHED`.
- Frontend wizard maps `409`→dashboard / `403`→verify-email / `429`→retry, with localStorage cleared (no 409 resume loop).
- Side-fixes correct: storage SSE gate `provider==='s3'` (not inverted); `use-perio-chart` 204-as-empty is correct; demo-admin removal leaves no path assuming demo is admin.

## 5. Coverage Matrix

Single in-scope module this run (`dental-org`); dimensions limited to the batch's surface.

| Module | Enforcement | Traceability | Diff bug-hunt |
|--------|-------------|--------------|---------------|
| dental-org | ✓ checked (PASS) | ✓ checked (PASS) | ✓ checked (PASS) |

**Uncovered modules:** none in scope. Other modules ⊘ skipped (out-of-batch — covered by the 2026-06-02 full-state run; not re-verified here by design).

## 6. Overall

**PASS** — reconciliation validated, trace intact, no new P0/P1. The frontend-graph staleness is a freshness signal only; it does not floor this focused backend/spec verdict (the exercised dimensions are map-blind). For a graph-anchored full-state PASS across all modules, run `/oli-check --auto` after `oli-engine scan . --write` on this branch.

## 7. DEFER / no-op (known-expected or pre-existing — confirmed, NOT regressions)

Recorded so a later run does not mistake these for gaps:
- `status` column with no enforcement → designed PHI go-live fast-follow (ADR-007 §"PHI go-live gating").
- Onboarding IP rate-limit production-only → documented stopgap; one-active-org index is the real control.
- Stale SDK (~33K lines) → deliberately not regenerated (frontend uses raw fetch); pre-existing backlog.
- MCP/permission-spec mention of onboarding → correctly **absent** (pre-org bootstrap, auth-layer-only gating; no role permission applies). No action.
- Pre-existing, out of scope: perio-charting red-line bug (`perio-charting.spec.ts:242`); perio-voice non-existent route; 3 non-dental contract failures (auth-password-reset, cors, storage-edge).

## What's Next

- Gate is clean; no `--fix` needed.
- Branch `fix/standards-review-batch` held local per decision — push/PR deferred to the user.
