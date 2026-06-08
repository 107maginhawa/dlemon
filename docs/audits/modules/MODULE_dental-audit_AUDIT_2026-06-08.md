# Module Audit — dental-audit

**Date:** 2026-06-08
**Branch:** feat/module-workflow-alignment
**Auditor:** per-module deep audit + safe-gap closure (adversarial; verified against source)
**Verdict:** ✅ **READY** — dental-audit is the COMPLIANCE source-of-truth module (every other module writes to it via `logAuditEvent` → `dental_audit_log`). **Audit-trail integrity is sound on all three adversarial axes: append-only (HTTP 405 + DB trigger), cross-tenant-read-safe (branchId-required + `assertBranchRole`), and PHI-clean (recursive sanitizer at the repo choke point + snapshot-omitting viewer DTO).** No security hole found this round — the EM-AUD-002 cross-tenant leak (prior P0) **stayed fixed** and is now additionally **regression-pinned with the 2-org `OTHER_BRANCH_DENTIST` pattern** (an owner of org A passing org B's branchId → 403; the prior 403 test only covered a no-membership caller). The recurring cross-module **"audit-row assertion gap"** (deferred in rounds 6–9) is **CLOSED AT-SOURCE here**: `audit.test.ts` already asserts a representative `logAuditEvent` write persists a row with the correct actor(=session.userId)/action/targetType/tenant/branch + PHI-sanitized snapshots, and `getAuditEvents.test.ts` pins the self-audit `audit_log.accessed` actor == the viewing session user. Closed 1 missing adversarial test (cross-tenant read denial) + reconciled the **whole-module-absent br-registry block** (added dental-audit with 6 rules) and 4 doc-drift items (MODULE_SPEC §9 banner/§6/§11/§17 pg-boss + "no-self-audit" + legacy-table-name; API_CONTRACTS response field table). Gates green.

---

## STEP 0 — Artifacts & /module-review

| Artifact | Location | Status |
|----------|----------|--------|
| Handler dir | `services/api-ts/src/handlers/dental-audit/` | ✅ `getAuditEvents.ts` (the only HTTP endpoint — read viewer); `repos/audit-log.repo.ts` (the authoritative `dental_audit_log` sink + PHI choke point) + `repos/audit-log.schema.ts` |
| Shared audit lib | `services/api-ts/src/core/audit-logger.ts` (`logAuditEvent`) + `core/audit-phi-sanitizer.ts` (recursive PHI blocklist) | ✅ this is the function every other module calls; dual-writes the authoritative `dental_audit_log` + the legacy `dental_audit` table (`db/audit.repo.ts`) |
| Append-only HTTP guards | `app.ts:147-154` (DELETE/PUT/PATCH `/dental/audit-events/:id` → 405 `AUDIT_EVENT_IMMUTABLE`) | ✅ hand-mounted method-shadow guards (Cat-1) |
| Append-only DB guard | migration `0080_audit_log_append_only` (BEFORE UPDATE OR DELETE FOR EACH ROW trigger → RAISE `append-only`) | ✅ defense-in-depth |
| TypeSpec | `specs/api/src/modules/dental-audit.tsp` | ✅ `DentalAuditModule` — `getAuditEvents` op only (append-only doc note; read-only viewer); routed via `DentalAuditMgmt` in main.tsp |
| MODULE_SPEC / API_CONTRACTS | `docs/product/modules/dental-audit/` | ✅ present (carried pg-boss/async drift in §6/§16/§17/§20 + "audit module does NOT write events" §17 + legacy-table-name in §9 banner + API_CONTRACTS snake_case response table — all reconciled this round) |
| Tests | 6 `*.test.ts` (33 assertions) | ✅ `audit.test.ts` (14: repo + `logAuditEvent` row-written + PHI sanitize), `getAuditEvents.test.ts` (9: auth/role/branchId/date-range/DTO/self-audit + **NEW cross-tenant read denial**), `audit-append-only.test.ts` (4: real-app 405), `audit-immutability-db.test.ts` (3: DB trigger), `audit-events-route-registration.test.ts` (1), `core/audit-logger.test.ts` (2) |
| Routes | `generated/openapi/{registry,routes}.ts` | ✅ `getAuditEvents` codegen-registered (TR-DG-002); `/:id` 405 guards hand-mounted |
| Contract | `dental-audit.hurl` (10 req) + `audit.hurl` (3) + `audit-side-effects.hurl` (7) | ✅ all green against fresh `:7213` |

**/module-review result:** **PASS** — no `test.skip`/`xit`/`.only`; no `Not implemented` stub; no TODO/FIXME/HACK in handler code; no non-test `as any`. TypeSpec op `getAuditEvents` ↔ handler name match. The viewer self-audits its own read (`audit_log.accessed`). `logAuditEvent` logs `personId: session.userId` as the **true actor** — there is no caller-supplied actor field to forge.

---

## STEP 1–2 — Spec universe & conformance (audit-specific)

| Invariant | Spec | Impl | Conformance |
|-----------|------|------|-------------|
| **Append-only — no UPDATE/DELETE path** | AC-AUD-002 / MODULE_SPEC §5/§8 | HTTP: `app.ts:147-154` 405 `AUDIT_EVENT_IMMUTABLE` on DELETE/PUT/PATCH `/:id`. DB: migration 0080 BEFORE UPDATE/DELETE trigger RAISEs. **No update or delete handler exists** (grep: only `getAuditEvents.ts` + the repo `insert`/`list`). | ✅ enforced at BOTH layers |
| **Read is tenant-scoped + role-gated** | AC-AUD-003 / EM-AUD-002 | `getAuditEvents.ts:86` branchId REQUIRED (omitted → 400, never an unscoped all-tenant `list`); `:129` `assertBranchRole(db, user.id, branchId, ['dentist_owner'])` against `dental_membership` (EM-AUD-009: uses membership, not Better-Auth session role). | ✅ |
| **No PHI in log body** | AC-AUD-004 / V-AUD-001 / V-AUD-NEW-A | `core/audit-phi-sanitizer.ts` recursive blocklist (name/email/dob/ssn/mrn/diagnosis/medications/notes/…) applied at the `AuditLogRepository.insert` **choke point** (V-AUD-101) — covers metadata AND before/after snapshots on every write path. Viewer DTO additionally OMITS snapshot columns (V-AUD-003). | ✅ |
| **Mandatory row fields / true actor** | AUD-BR-004 | `logAuditEvent` persists actorId(=personId=session.userId)/action/targetType/tenantId/server-set timestamp + branchId/eventType/snapshots. No client-supplied actor field. | ✅ |
| **Viewing the log is self-audited** | V-AUD-NEW-B / WF-028 | `getAuditEvents.ts:155-177` writes one security-class `audit_log.accessed` event (scope/counts only — no PHI). Single insert, cannot recurse. | ✅ |
| **Write durability hardened** | V-AUD-007 / EM-AUD-008 / ADR-005 | one transient-connection retry + explicit row id + **fail-closed rethrow on security-class events** (a failed `dental_audit_log` write for a security event surfaces, never silently swallowed). | ✅ |
| **Retention 7yr / never deleted** | MODULE_SPEC §2 | append-only table; no deletion path. (Active retention enforcement is the **erasure/legal-hold/retention** module — round 11.) | ✅ (scoped) |

**Drift both ways:** the SPEC over-described an **async pg-boss** write path (corrected only in the §9 banner pre-edit) and claimed the audit module **does NOT write audit events** (§17) — both contradicted by the inline-synchronous reality and the V-AUD-NEW-B self-audit. Reconciled (STEP 7). No impl-side feature is undeclared.

---

## STEP 3 — KG mapping (query-only)

`.understand-anything/domain-graph.json` models `flow:audit-trail` (name "Audit Trail") and the `audit` domain. It correctly captures **"Cross-tenant audit leak (EM-AUD-002) fixed — tenant-scoped queries enforced"** and **"append-only"**.

**KG-projection drift (query-only — flag for next regeneration, do NOT hand-edit):**
1. **Phantom route.** `flow:audit-trail` `entryPoint` = **`GET /dental/audit/events`** — the real route is **`GET /dental/audit-events`** (no slash before `events`; TypeSpec/generated routes).
2. **Over-claim — wrong store + phantom filter.** Node summary: *"Retrieves structured audit events (Pino-logged, append-only) filtered by patient, branch, or operation type."* Two errors: (a) the **durable sink is the `dental_audit_log` table**, not the Pino stream (Pino carries only safe non-PHI identifiers, T-001); (b) there is **no `patient` filter** — filters are actorId/eventType/action/targetType/targetId/date-range.
3. **KG-backlog (lossy → NONE).** The graph does not model the **append-only DB trigger** (0080), the **PHI-sanitizer choke point** (V-AUD-101), the **fail-closed-on-security-event** durability rule (V-AUD-007), or the **`audit_log.accessed` self-audit** as distinct nodes. Note on next regeneration.

---

## STEP 4/5 — Tests (ADVERSARIAL) + RBAC

| Audit-integrity axis | Test | Strength |
|----------------------|------|----------|
| **(a) cross-tenant read rejected** | `getAuditEvents.test.ts` — **NEW** `AC-AUD-003: ORG_A owner passing ORG_B branchId → 403`. Seeds two independent orgs; the caller is a real `dentist_owner` of ORG_A with NO membership in ORG_B's branch; passing BRANCH_B → 403 and ORG_B's `invoice.voided` row is absent from the body. (The pre-existing 403 test seeded NO membership → denied for "no membership at all"; per the imaging/pmd carry-forward, cross-branch isolation must be proved with a *full-role member of a different org*.) Also `EM-AUD-002: branchId omitted → 400` (never unscoped). | VERIFIED (added this round) |
| **(b) append-only — no update/delete** | `audit-append-only.test.ts` (real app: DELETE/PUT/PATCH `/:id` → 405 `AUDIT_EVENT_IMMUTABLE`, incl. param-independence) + `audit-immutability-db.test.ts` (real Postgres: row UPDATE raises `append-only`, row DELETE raises, INSERT succeeds, original value intact). | VERIFIED (both layers) |
| **(c) audit-row written with correct fields (the deferred "audit-row assertion gap", CLOSED AT-SOURCE)** | `audit.test.ts` — `AUD-BR-004`: `logAuditEvent({...})` → row with `actorId`(=session user)/`action`/`targetType`/`tenantId`/`branchId`/server `timestamp` persisted + before/after snapshots round-trip; `V-AUD-NEW-A`: top-level AND nested-in-objects/arrays PHI keys stripped (no `Jane Doe`/email/`caries`/`555-1234` anywhere in the persisted row). `getAuditEvents.test.ts` `V-AUD-NEW-B`: the self-audit ACCESSED row's `actorId === session user`, `eventType === 'security'`, metadata = scope/counts only, snapshots null. | VERIFIED (end-to-end action→row pin exists at the source-of-truth module) |
| **RBAC** | 401 unauth; 403 non-owner role; 403 cross-tenant owner; dentist_owner same-branch → 200. | VERIFIED |
| **Date-range validity** | `V-AUD-002`: `from > to` → 422 `INVALID_DATE_RANGE`; unparseable `from` → 400. | VERIFIED |
| **Viewer DTO PHI omission** | `V-AUD-003`: response carries camelCase DTO, OMITS `beforeSnapshot`/`afterSnapshot`, and a seeded `patientName:'SHOULD NOT LEAK'` snapshot value is absent from the response. | VERIFIED |

**Round-9 optional-branchId lens:** `getAuditEvents` takes branchId as the scope guard and it is **REQUIRED** — omission → 400, NOT an unscoped query. So the EM-BIL-002 "optional branchId omitted → all-tenants" class **does not apply** here (the endpoint can never run unscoped). The repo `list()` filters are conditional (`if (filters.branchId)`), but the only caller (`getAuditEvents`) requires branchId before calling, and the test-only `AuditLogRepository` callers pass explicit scopes — there is no HTTP path that reaches `list()` without a branch condition.

---

## STEP 6 — Traceability Matrix

| Item | Spec? | Impl? | KG | Test (file:line) | Strength | Verdict |
|------|-------|-------|----|------------------|----------|---------|
| **AC-AUD-002** append-only — HTTP DELETE/PUT/PATCH `/:id` → 405 `AUDIT_EVENT_IMMUTABLE` | ✅ | ✅ app.ts:147-154 | NONE | audit-append-only.test.ts (4) | VERIFIED | 🟢 |
| **AC-AUD-002** append-only — DB trigger rejects row UPDATE/DELETE; INSERT allowed | ✅ | ✅ migration 0080 | NONE | audit-immutability-db.test.ts (3) | VERIFIED | 🟢 |
| **AC-AUD-002** no update/delete handler exists (source) | ✅ | ✅ only getAuditEvents + repo insert/list | — | (source-verified) | VERIFIED | 🟢 |
| **AC-AUD-003 / EM-AUD-002** read branchId-required → 400; dentist_owner-only → 403 | ✅ | ✅ getAuditEvents.ts:86,129 | flow | getAuditEvents.test.ts (401/403/400) | VERIFIED | 🟢 |
| **AC-AUD-003 cross-tenant read** ORG_A owner + ORG_B branchId → 403 (no leak) | implied | ✅ assertBranchRole (no membership in foreign branch) | flow | **getAuditEvents.test.ts (NEW: ORG_A owner→ORG_B branchId 403, body excludes ORG_B row)** | VERIFIED (added) | 🟢 |
| **AC-AUD-004 / V-AUD-001 / V-AUD-NEW-A** PHI stripped from metadata + snapshots (recursive, choke point) | ✅ | ✅ audit-phi-sanitizer.ts; audit-log.repo.ts:21-49 | NONE | audit.test.ts (top-level + nested) | VERIFIED | 🟢 |
| **V-AUD-003** viewer DTO omits before/after snapshots | ✅ | ✅ getAuditEvents.ts toDTO | NONE | getAuditEvents.test.ts:129-161 | VERIFIED | 🟢 |
| **AUD-BR-004** row has actorId(=session)/action/targetType/tenantId/timestamp + snapshots | ✅ | ✅ audit-logger.ts:149-167 | NONE | audit.test.ts:134-176 | VERIFIED | 🟢 |
| **V-AUD-NEW-B / WF-028** viewing the log writes a self-audit `audit_log.accessed` (scope-only) | ✅ | ✅ getAuditEvents.ts:155-177 | NONE | getAuditEvents.test.ts:163-195 | VERIFIED | 🟢 |
| **V-AUD-007 / EM-AUD-008** transient-retry + explicit id + fail-closed rethrow on security event | ✅ | ✅ audit-logger.ts:41-58,144-175 | NONE | audit-logger.test.ts (2) | PARTIAL (fail-closed-rethrow path not directly pinned) | 🟢 |
| **V-AUD-002** date-range `from>to` → 422 `INVALID_DATE_RANGE`; unparseable → 400 | ✅ | ✅ getAuditEvents.ts:99-122 | NONE | getAuditEvents.test.ts:84-102 | VERIFIED | 🟢 |
| **V-AUD-004** offset pagination (limit/offset, cap 200) + eventType filter | ✅ | ✅ getAuditEvents.ts:131-132 | NONE | getAuditEvents.test.ts:197-216; audit.test.ts | VERIFIED | 🟢 |
| **Route registration** `getAuditEvents` codegen-registered (not 404) | ✅ | ✅ generated routes | flow | audit-events-route-registration.test.ts | VERIFIED | 🟢 |
| **List shape** `{ data, meta:{total,limit,offset} }` | ✅ | ✅ getAuditEvents.ts:180 | NONE | getAuditEvents.test.ts | VERIFIED | 🟢 |

**Counts: 13 GREEN / 0 PARTIAL-verdict / 0 RED** (one row's *strength* is PARTIAL — the fail-closed rethrow branch — but the rule's verdict is GREEN; impl correct, edge-pin deferred).

**Verdict: READY.**

---

## STEP 7 — Gaps Closed This Round

### REAL test gap closed (the audit-trail-integrity cross-tenant pin)

| # | Gap | Class | Fix |
|---|-----|-------|-----|
| 1 | **No cross-tenant audit-read denial test.** The viewer's only 403 test seeded NO membership (denies for "no membership at all"), so the *cross-tenant* leak path — a legitimately onboarded `dentist_owner` of org A reading org B's audit trail by passing org B's branchId — was unpinned (correct by source via `assertBranchRole`, but unproven; same class the imaging/pmd carry-forward warns about). | REAL test gap (security regression pin) | Added `AC-AUD-003: ORG_A owner passing ORG_B branchId → 403` to `getAuditEvents.test.ts` (2-org seed; asserts 403 AND ORG_B's row absent from the body). GREEN. |

### Doc / registry drift reconciled (docs commit)

| # | Drift | Fix |
|---|-------|-----|
| 2 | **dental-audit ENTIRELY ABSENT from br-registry.json** (only 9 of 10 dental modules registered — same class as dental-perio round 6). | Added the `dental-audit` registry block (6 rules: AC-AUD-002 append-only/two-layer, AC-AUD-003/EM-AUD-002 branch-scoped read + cross-tenant denial, AC-AUD-004/V-AUD-001/V-AUD-NEW-A PHI-clean choke point, AUD-BR-004 mandatory-fields/true-actor, V-AUD-NEW-B self-audit, V-AUD-007/EM-AUD-008 durability/fail-closed) with real source + test citations. JSON re-validated. |
| 3 | **MODULE_SPEC §9 banner** said the dual-write target is `dental_audit_log` + `audit_log_entry` — the real legacy table is **`dental_audit`** (`db/audit.schema.ts`). | Corrected to "authoritative `dental_audit_log` + legacy `dental_audit`" and expanded the banner to flag every pg-boss/async §ref as historical + summarize the durability + PHI-choke-point reality. |
| 4 | **MODULE_SPEC §6 / §11 / §17 stale.** §6 "Write: System only (async, pg-boss)" omitted the viewer's own self-audit write; §11 AC-AUD-003 didn't mention the branchId-required / cross-tenant-denial; **§17 claimed "Audit module itself does NOT write audit events (avoid recursion)"** — directly contradicted by the V-AUD-NEW-B `audit_log.accessed` self-audit. | §6 now lists the self-audit write + the 405/DB-trigger immutability; §11 AC-AUD-003 spells out branchId-required + cross-tenant 403; §17 rewritten to say the viewer DOES write exactly one non-recursive self-audit event + clarifies Pino vs the durable `dental_audit_log` sink. |
| 5 | **API_CONTRACTS response field table drift.** Listed snake_case `event_type`/`actor_id`/`aggregate_type`/`aggregate_id`/`occurred_at` and OMITTED the real `resourceType`/`resourceId`/`reason`/`ipAddress`/`userAgent`/`timestamp` — the real viewer DTO (`getAuditEvents.ts#toDTO` / TypeSpec `DentalAuditEvent`) is camelCase and excludes the snapshot columns. | Replaced with the real camelCase DTO table (14 fields, correct nullability) + a note that the old `aggregate_*`/snake_case fields are not the implemented shape; `Sort: timestamp DESC`. |

---

## Ranked Remaining Gaps (surfaced, NOT closed — out of safe scope)

**REAL test gaps (impl present, assertion not added this round):**
1. **Fail-closed-on-security-event pin.** V-AUD-007 (ADR-005) rethrows on a failed `dental_audit_log` write *only* for `eventType:'security'` events (non-security stay fire-and-forget). The behavior is correct by source but not directly pinned (would need a fault-injected insert failure). A test asserting "security-event write failure rethrows; data-modification write failure is swallowed" would harden the compliance guarantee.
2. **Legacy-table dual-write coverage.** `logAuditEvent` also writes the legacy `dental_audit` table; the tests assert the authoritative `dental_audit_log` row but not the legacy mirror. Low-value (legacy table is read only by wiring tests) — surface.

**Product / architecture decisions (not unilaterally changed):**
3. **Active retention enforcement** (7-year sweep / purge-after-retention) lives in the **erasure/legal-hold/retention** module (round 11), not here — dental-audit only guarantees append-only + never-deleted. Out of scope; chase the purge/legal-hold interplay there.
4. **`audit_log.accessed` self-audit `tenantId: tenantId ?? branchId`** uses a caller-supplied `tenantId` query-param fallback for the *display* tenant on the self-audit row. This is **not a leak** (the `list()` is scoped by the asserted branchId; tenantId is only a display/echo field on the self-audit row), but the attribution tenant is technically caller-influenceable. Surface only; if tightening is desired, derive tenant from the branch's organization (TDD).

**KG-backlog:** `flow:audit-trail` cites the phantom `GET /dental/audit/events` (real: `/dental/audit-events`), claims a non-existent `patient` filter, and names Pino (not `dental_audit_log`) as the store; the append-only DB trigger, PHI choke point, fail-closed rule, and self-audit are unmodeled. Fix on next KG regeneration.

---

## STEP 8 — Gate

| Gate | Result |
|------|--------|
| `cd services/api-ts && bunx tsc --noEmit` | ✅ 0 errors |
| dental-audit module suite (`test-with-db.ts`, 6 files) | ✅ **33 pass / 0 fail** (32 baseline + 1 new cross-tenant pin) |
| `eslint` (changed test file) | ✅ 0 errors |
| `bun run check:boundaries` (api-ts) | ✅ no cross-module repo boundary violations |
| br-registry.json | ✅ valid JSON (dental-audit block added) |
| Contract suite (fresh `:7213`, restarted) | ✅ **`dental-audit.hurl` Success (10 req)** + **`audit.hurl` (3)** + **`audit-side-effects.hurl` (7)** all green (20 audit requests). 43/46 files pass; the 3 failures are **pre-existing environmental, outside this module**: `billing-lifecycle.hurl` (upstream Stripe), `auth-verification` + `auth-password-reset` (mailpit down) — identical to the prior nine rounds. |

---

## Audit-trail-integrity verdict

- **Append-only?** ✅ YES — enforced at BOTH the HTTP layer (405 `AUDIT_EVENT_IMMUTABLE` on DELETE/PUT/PATCH) and the storage layer (migration 0080 DB trigger RAISEs on row UPDATE/DELETE). No update/delete handler or route exists. Both layers tested.
- **Cross-tenant-read safe?** ✅ YES — branchId is REQUIRED (omitted → 400, never an all-tenant query) and read is `dentist_owner`-only via `assertBranchRole` against `dental_membership`, so an owner of another org passing this branchId → 403. **Now regression-pinned with the 2-org pattern** (previously only the weaker no-membership 403 was tested). The prior P0 EM-AUD-002 leak stayed fixed.
- **Audit-row-written invariant now pinned?** ✅ YES — pinned AT-SOURCE: `audit.test.ts` asserts a representative `logAuditEvent` write persists a row with the correct actor(=session.userId)/action/targetType/tenant/branch + PHI-sanitized snapshots, and the viewer self-audit row's actor == the session user. The recurring deferred cross-module "audit-row assertion gap" is closed at the source-of-truth module.

## Files Changed

**docs commit:**
- `services/api-ts/src/handlers/dental-audit/getAuditEvents.test.ts` — **NEW** cross-tenant read denial pin (2-org)
- `specs/api/docs/standards/br-registry.json` — **NEW** dental-audit block (6 rules)
- `docs/product/modules/dental-audit/MODULE_SPEC.md` — §9 banner (legacy table name + durability/PHI summary), §6 permissions, §11 AC-AUD-003, §17 observability
- `docs/product/modules/dental-audit/API_CONTRACTS.md` — response field table (camelCase DTO, snapshot omission, correct sort)
- `docs/audits/modules/MODULE_dental-audit_AUDIT_2026-06-08.md` — this report
- `docs/audits/MODULE_AUDIT_TRACKER.md` — row 10 verdict + "audit-row assertion gap" closed-at-source note
