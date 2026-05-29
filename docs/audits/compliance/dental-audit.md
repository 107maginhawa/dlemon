# Compliance Audit — `dental-audit`

> **Dimension**: compliance · **Scope**: dental-audit · **Date**: 2026-05-30
> **Spec**: `docs/product/modules/dental-audit/MODULE_SPEC.md` (v1.0; header records the ADR-005 correction — writes are inline/synchronous via `core/audit-logger.ts#logAuditEvent`, dual-writing `dental_audit_log` + legacy `dental_audit`; the pg-boss/5s-async language is historical) · cross-checked against `docs/product/AUDIT_CONTRACTS.md`, `DATA_GOVERNANCE.md`, `ERROR_TAXONOMY.md`, `ROLE_PERMISSION_MATRIX.md`, module `API_CONTRACTS.md`
> **Verdict**: WARN (no P0; 1 P1)

## Audit Scope

`dental-audit` is an **append-only audit trail**: one privileged read endpoint (`GET /dental/audit-events`), the shared inline writer `core/audit-logger.ts#logAuditEvent` (the ACTIVE path — referenced by ~68 sites / 45+ source files), and a registered-but-unfed pg-boss consumer (`consumers/domain-events.consumer.ts`). There is **no hash chain, no `prev_hash`/`event_hash`, and no state machine** — MODULE_SPEC §8 = "None — append-only."

### Files read (exhaustive, hand-written only; `src/generated/` excluded)
- `handlers/dental-audit/getAuditEvents.ts` (viewer handler)
- `handlers/dental-audit/repos/audit-log.repo.ts` (insert + list)
- `handlers/dental-audit/repos/audit-log.schema.ts` (`dental_audit_log`)
- `handlers/dental-audit/consumers/domain-events.consumer.ts`
- `handlers/dental-audit/audit.test.ts`, `audit-append-only.test.ts`, `getAuditEvents.test.ts`
- `core/audit-logger.ts` (full — central recursive PHI sanitizer + dual-write)
- `handlers/shared/assert-branch-access.ts` (full — branch authz)
- `app.ts:197-221,567` (route registration + 405 immutability guards + consumer registration)

Frontend consumers in `apps/dentalemon/src`: none found.

### Ground-truth facts established this audit
- `logAuditEvent` recursively strips a PHI key blocklist (name/email/phone/ssn/dob/diagnosis/notes/…) from `metadata`, `before`, AND `after` BEFORE persisting to either table; never throws; security events fail-closed (rethrow). Proven by `V-AUD-NEW-A` tests (`audit.test.ts:195-294`). **The active write path sanitizes PHI correctly.**
- `publishAuditEvent` / `DENTAL_AUDIT_EVENTS_QUEUE` has **ZERO producers** in the codebase (grep across `src`, excluding the consumer + tests). The consumer is registered (`app.ts:567`) but never receives events today.
- AUDIT_CONTRACTS §5: `branchId` is REQUIRED (missing → `VALIDATION_ERROR(400)`); `tenantId` is an explicit **"Optional tenant override; defaults to `branchId`."** So the `tenantId ?? branchId` fallback in code is spec-sanctioned, not a bug.
- `tenant_id` semantically = organization id; real write callers resolve it as `branch.organizationId ?? branchId` (e.g. `dental-visit/.../updateDentalTreatment.ts:83`). The viewer's self-audit write does not resolve the org id and relies on the spec's branch fallback (V-AUD-202).

## Counts

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 1 |
| P2 | 3 |
| P3 | 2 |

---

## Findings

### V-AUD-101 — pg-boss consumer write path bypasses PHI sanitization (latent) (P1)
**Rule**: BR "No PHI in log body" (MODULE_SPEC §5), AC-AUD-004, DATA_GOVERNANCE §2/§3 (`AuditEvent`: append-only, **never deleted**)
**Location**: `handlers/dental-audit/consumers/domain-events.consumer.ts:36-46`
The consumer calls `repo.insert({... beforeSnapshot: event.beforeSnapshot ?? null, afterSnapshot: event.afterSnapshot ?? null })` **directly**, passing caller-supplied snapshots verbatim. PHI sanitization lives in `logAuditEvent`, NOT in `AuditLogRepository.insert`, so this path does not strip PHI. The store is append-only and never deleted (DATA_GOVERNANCE §3 row `AuditEvent`: "No — never"), so any PHI written here is unremediable. **Currently latent**: `publishAuditEvent` has zero producers, so nothing flows through this path today — but the spec's stated design ("all modules write events via the queue", §3/§6/§10b) intends to wire it, at which point raw row snapshots persist unsanitized. Filed P1 (not P0) because it is not presently reachable.
**Fix**: Move the recursive PHI sanitizer into `AuditLogRepository.insert` so EVERY write path is covered regardless of caller (preferred — single choke point), or route the consumer through `logAuditEvent`. Add a consumer test mirroring `V-AUD-NEW-A`.
**Autofixable**: false (decide central sanitizer location; extract shared function)

### V-AUD-102 — Consumer silently drops malformed events (no log/metric/DLQ) (P2)
**Rule**: AUDIT_CONTRACTS reliability — audit events must not be silently lost; MODULE_SPEC §17 (`audit_events_written_total` metric)
**Location**: `handlers/dental-audit/consumers/domain-events.consumer.ts:34`
`if (!event?.tenantId || !event?.actorId || !event?.action || !event?.targetType) return;` swallows any event missing a required field with no log, no metric, no dead-letter. A producer bug that omits `actorId` would permanently lose audit records with zero observability — invisible in a compliance trail. (Latent like V-AUD-101 — no producers yet — but a correctness/observability gap once wired.)
**Fix**: On validation failure, log warn/error (no PHI) with queue name + correlation id and/or route to a DLQ; emit a failure metric per §17.
**Autofixable**: false

### V-AUD-103 — Viewer list ordered `desc(timestamp)` with no tie-break → non-deterministic pagination (P2)
**Rule**: WF-028 viewer; MODULE_SPEC §10 pagination
**Location**: `handlers/dental-audit/repos/audit-log.repo.ts:54`
`orderBy(desc(timestamp))` only. `timestamp` is `defaultNow()`; rows written in the same tick (e.g. the ACCESSED self-audit written alongside the queried results, or future bulk events) have non-deterministic relative order across pages, so an event can be skipped or duplicated between paginated requests.
**Fix**: Add a deterministic secondary sort: `orderBy(desc(timestamp), desc(id))`.
**Autofixable**: true

### V-AUD-104 — `total` computed by selecting all matching ids into memory (P2)
**Rule**: NFR §16 (viewer < 2s; ~100k events/branch over 7-year retention)
**Location**: `handlers/dental-audit/repos/audit-log.repo.ts:57-63`
Count = `select({ id }).from(...).where(where)` then `countResult.length` — transfers every matching row's id to the app and counts in JS. At the spec's stated ~100k events/branch, a branch-only viewer query pulls ~100k UUIDs on every page load, jeopardizing the <2s NFR and wasting memory/bandwidth.
**Fix**: SQL aggregate count: `db.select({ count: sql\`count(*)\` }).from(dentalAuditLog).where(where)`.
**Autofixable**: true

### V-AUD-105 — Self-audit write does not resolve the org id for `tenant_id` (relies on spec branch-fallback) (P3)
**Rule**: AUDIT_CONTRACTS §5 (`tenantId` "Optional tenant override; defaults to `branchId`") — spec-COMPLIANT, but inconsistent with sibling write callers
**Location**: `handlers/dental-audit/getAuditEvents.ts:159-161`
The ACCESSED self-audit write uses `tenantId: tenantId ?? branchId`. Because `tenantId` is an optional query param, in the normal case the `tenant_id` column receives the branch id. This is *permitted* by AUDIT_CONTRACTS §5 (tenant defaults to branch), so it is NOT a violation — but it diverges from every other write caller, which resolves the true org id (`branch.organizationId ?? branchId`, e.g. `updateDentalTreatment.ts:83`). For consistent tenant attribution on these security/ACCESSED rows, the viewer should resolve org id the same way.
**Fix**: Resolve org id from the branch (the membership/branch lookup is already in scope via `assertBranchAccess`) and pass `org ?? branchId`, matching the visit/treatment handlers.
**Autofixable**: false

### V-AUD-106 — Self-audit metadata key `eventType` shadows the column `eventType` (P3)
**Rule**: AUDIT_CONTRACTS §2 (metadata = safe non-PHI context)
**Location**: `handlers/dental-audit/getAuditEvents.ts:163,170`
The ACCESSED row sets column `eventType: 'security'` (the event's own class) and also `metadata.eventType` (the *filter* the viewer queried). Two `eventType`s with different semantics is confusing downstream. No data risk; PHI-safe.
**Fix**: Rename the metadata key to `filteredEventType` (symmetry with `filteredActorId`, line 169).
**Autofixable**: true

---

## Rule / AC compliance matrix

| Item | Status | Evidence |
|------|--------|----------|
| BR: append-only, no UPDATE/DELETE | PASS | `audit-append-only.test.ts` hits the REAL app (`createApp(parseConfig())`): DELETE/PUT/PATCH `/dental/audit-events/:id` → 405 `AUDIT_EVENT_IMMUTABLE` (`app.ts:214-221`); repo has no update/delete |
| BR: No PHI in log body | PASS (active path) / latent gap | `logAuditEvent` recursively sanitizes (audit-logger.ts:97-178; tests 195-294); consumer path = V-AUD-101 |
| BR: Retention 7yr, never deleted | PASS | no purge code; DATA_GOVERNANCE §2/§3 = never delete |
| Perms: Read = dentist_owner, branch-scoped | PASS | role check `getAuditEvents.ts:80`; required `branchId:94`; `assertBranchAccess:132` → 403 `BRANCH_ACCESS_DENIED` |
| Perms: Write = System only | PASS | no public write route; writes via `logAuditEvent` / consumer only |
| Perms: Delete = NEVER | PASS | 405 guards on real routes |
| AC-AUD-001: write within 5s | PASS | inline per ADR-005; consumer `registerDelayed(...,0,...)` |
| AC-AUD-002: PATCH/PUT/DELETE → 405 | PASS | tested on real routes; code `AUDIT_EVENT_IMMUTABLE` (ERROR_TAXONOMY §5) |
| AC-AUD-003: viewer returns only requester's branch | PASS | required `branchId` (`VALIDATION_ERROR 400` if missing, per AUDIT_CONTRACTS §5) + `assertBranchAccess` membership check; tested (`getAuditEvents.test.ts:73-79`) |
| AC-AUD-004: no email/name fields | PASS (active) | `logAuditEvent` strips; viewer DTO omits before/after snapshot columns (`getAuditEvents.ts:51-71,183`, tested `getAuditEvents.test.ts:129-161`); consumer latent gap = V-AUD-101 |
| §10 API: GET /dental/audit-events (branch/actor/eventType/date/page) | PASS | all params present; date-range 422 `INVALID_DATE_RANGE` + 400 on unparseable; pagination default 50 / max 200 |
| §16 viewer < 2s | AT RISK | V-AUD-104 in-memory count |
| §17 observability (write metric, no recursion) | PARTIAL | self-audit recursion avoided (single insert + rationale comment); no DLQ/metric on dropped events → V-AUD-102 |
| Data model (§7) | PASS | schema matches/extends spec (adds actorRole, ip/userAgent, before/after snapshots, 4 indices) |
| tenantId semantics | PASS | matches AUDIT_CONTRACTS §5 (optional override, defaults to branchId); V-AUD-105 is consistency-only |

## Verdict

**WARN** — no P0. The append-only immutability (405, real-app tested), dentist_owner + required-branchId + `assertBranchAccess` read gating, active-path recursive PHI sanitization (`logAuditEvent`, tested), the viewer DTO's deliberate omission of snapshot columns, date-range validation, and pagination bounds are all correctly implemented and tested. The one P1 (V-AUD-101) is **latent**: the pg-boss consumer would persist unsanitized PHI snapshots, but the queue has zero producers today — fix by centralizing the sanitizer in `AuditLogRepository.insert` before any module wires `publishAuditEvent`. Remaining items are pagination determinism, count performance, consumer observability, and two cosmetic consistency notes. The earlier-suspected tenant_id/scope issues are NOT violations — AUDIT_CONTRACTS §5 explicitly defines `tenantId` as an optional override defaulting to `branchId`.
