<!-- oli-audit v1 | dimension: spec-compliance | date: 2026-05-26 -->
# Spec-to-Code Compliance Audit

**Generated:** 2026-05-26  
**Scope:** All MODULE_SPEC.md files under `docs/product/modules/` cross-referenced against `services/api-ts/src/handlers/`  
**Auditor:** Senior code reviewer (claude-sonnet-4-6)

---

## Module Compliance Table

| Module | Spec exists? | Handler exists? | Key gaps |
|--------|-------------|----------------|----------|
| dental-org | Yes | Yes (`dental-org/`) | PIN endpoints not listed in spec §10 API table; `member_role` enum in spec (4 values) expanded to 9 values in code without spec update |
| dental-audit | Yes | Yes (`dental-audit/`) | Spec requires pg-boss async writes (AC-AUD-001) — no pg-boss consumer found; viewer route path mismatch (`/dental/admin/audit` in code vs `/dental/audit-events` in spec) |
| dental-emr-integration | Yes | Partial — `emr/` exists with 8 handlers | Spec explicitly marks this FUTURE PHASE (Phase 3+); code in `handlers/emr/` is a *different* EMR (consultation notes, not the external import bridge); no `handlers/dental-emr-integration/` directory |
| dental-clinical | Yes | Yes (`dental-clinical/`) | Not deeply audited — handler directory is large and populated |
| dental-patient | Yes | Yes (`dental-patient/`) | Not deeply audited — handler directory is large and populated |
| dental-billing | Yes | Yes (`dental-billing/`) | Not deeply audited — handler directory is large and populated |
| dental-scheduling | Yes | Yes (`dental-scheduling/`) | Not deeply audited — handler directory is large and populated |
| dental-imaging | Yes | Yes (`dental-imaging/`) | Not deeply audited — handler directory is large and populated |
| dental-perio | Yes | Yes (`dental-perio/`) | Not deeply audited — handler directory is large and populated |
| dental-visit | Yes | Yes (`dental-visit/`) | Not deeply audited — handler directory is large and populated |
| dental-pmd | Yes | Yes (`dental-pmd/`) | Not deeply audited — handler directory is large and populated |

**Overall handler coverage:** 11/11 spec modules have a handler directory. `dental-emr-integration` is the only module where spec and handler directory are misaligned (different concerns).

---

## Focused Module Analysis

### dental-org — PIN Auth

**Spec (§7 `dental_membership` fields):**
- `pin_hash` (bcrypt)
- `pin_failed_attempts` (default 0)
- `pin_locked_until` (nullable timestamp)

**Code (`repos/membership.schema.ts`):**  
All three fields present. Additionally implemented (beyond spec): `securityQuestion`, `securityAnswerHash`, `lastLoginAt`, `avatarUrl`, `displayName`. These extensions are not in the §7 data requirements table.

**Spec (§10 API Expectations table):**  
The table lists 9 endpoints. PIN endpoints (`set-pin`, `verify-pin`, pin recovery) are **absent from the §10 table** even though they exist in code and are referenced in §7/§5/§19. The spec's API table is incomplete.

**Code (handler files):**  
`setPin.ts`, `verifyPin.ts`, `pinRecovery.ts`, `recoverPin.ts`, `DentalMembershipManagement_setPin.ts`, `DentalMembershipManagement_verifyPin.ts` — all present and wired. Recent diff (Slice H) added `assertBranchAccess` to `setPin` and `verifyPin`, and wired `AuditRepository` into `verifyPin` for CF-46/AUTH-07.

**Spec (§6 Permissions):**  
`member_role` enum in spec: `dentist_owner / dentist_associate / staff_full / staff_scheduling` (4 values).  
Code enum: `dentist_owner / dentist_associate / hygienist / staff_full / staff_scheduling / dental_assistant / front_desk / billing_staff / read_only` (9 values). **Spec has not been updated to match.**

### dental-audit

**Spec (§7 Data Requirements):**  
Fields listed: `tenant_id`, `branch_id`, `actor_id`, `action`, `target_type`, `target_id`, `timestamp`, `reason`, `before_snapshot`, `after_snapshot`.

**Code (`audit-log.schema.ts`):**  
All spec fields present. Schema also uses `baseEntityFields` (adds `id`, `created_at`, `updated_at`) which are implicit infrastructure fields not in spec — acceptable.

**Route path mismatch:**  
- Spec §10: `GET /dental/audit-events`  
- Code (`getAuditEvents.ts` comment): `GET /dental/admin/audit`  
These differ. Whether the route is actually registered at which path requires checking the router file, but the discrepancy in the handler's own JSDoc comment is a signal.

**AC-AUD-001 compliance:**  
Spec requires audit events written within 5s via pg-boss. No pg-boss consumer file found in `handlers/dental-audit/`. The `logAuditEvent` import used in tests points to `@/core/audit-logger` — if that is synchronous (inline write), it satisfies the functional requirement but violates the async/pg-boss architecture the spec mandates.

**AC-AUD-002 compliance:**  
Spec requires 405 on PATCH/PUT/DELETE against audit events. No explicit route rejection tested or evident in the single handler file.

### dental-emr-integration

**Spec:** Explicitly marked `implementation_status: future_phase (Phase 3+)`. AI Instructions in spec §20 state: "Do not implement handler files until explicitly scheduled."

**Code:** `handlers/emr/` exists with 8 handler files (`createConsultation.ts`, `finalizeConsultation.ts`, `getConsultation.ts`, `listConsultations.ts`, `listEMRPatients.ts`, `updateConsultation.ts`, plus tests). This is a consultation-note EMR, **not** the external practice data import bridge that `dental-emr-integration` spec describes.

**Assessment:** No `handlers/dental-emr-integration/` directory exists — correct per spec. The `handlers/emr/` directory serves a different concern (active consultation notes, likely consumed by `dental-visit`). The naming creates potential confusion but is not a compliance violation if `emr/` is understood as a sub-concern of visit/clinical, not the integration bridge.

---

## Top 3 Spec Gaps (In Spec, Not In Code)

### SG-1: dental-org §10 API table missing PIN endpoints
**Severity: HIGH**  
The spec's API Expectations table (§10) lists 9 endpoints and omits all PIN-related routes: `POST .../set-pin`, `POST .../verify-pin`, pin recovery, and pin reset. These routes are implemented in code and referenced in §5 (BR-016b), §7 (data fields), and §19 (ORG-S5 slice). The spec is the canonical reference — a reader following only §10 would not know these endpoints exist.

**Fix required:** Add PIN endpoints to §10 table in `dental-org/MODULE_SPEC.md`.

### SG-2: dental-org §7 `member_role` enum is stale (4 vs 9 values)
**Severity: MEDIUM**  
Spec documents 4 roles; code implements 9. The 5 undocumented roles (`hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only`) have no permission matrix, acceptance criteria, or business rule coverage in the spec.

**Risk:** Permissions for these roles are undefined in spec — any RBAC enforcement for them is ad hoc with no spec backing.

**Fix required:** Update `dental_membership` role enum in §7, add these roles to §6 Permissions matrix.

### SG-3: dental-audit §10 route path inconsistency + AC-AUD-002 not implemented
**Severity: MEDIUM**  
Two sub-gaps:  
(a) Spec says `GET /dental/audit-events`; handler file comment says `GET /dental/admin/audit`. One of them is wrong.  
(b) Spec AC-AUD-002 requires 405 on mutation attempts against audit records. No route-level guard or test covers this.

**Fix required:** Reconcile route path in handler vs spec. Add explicit rejection routes or middleware for PATCH/PUT/DELETE on audit endpoints.

---

## Top 3 Code Gaps (In Code, Not In Spec)

### CG-1: `handlers/emr/` module has no corresponding MODULE_SPEC
**Severity: HIGH**  
`services/api-ts/src/handlers/emr/` implements consultation notes (8 handlers, full test suite) but has no MODULE_SPEC.md under `docs/product/modules/`. This is a live, tested module with no spec backing — its contracts, permissions, business rules, and acceptance criteria are undocumented.

**Note:** `dental-emr-integration/MODULE_SPEC.md` documents a *different* future feature (external practice import bridge). The active consultation EMR in `handlers/emr/` needs its own spec.

### CG-2: `dental_membership` schema has 6 fields beyond spec
**Severity: LOW**  
Code adds `securityQuestion`, `securityAnswerHash`, `lastLoginAt`, `avatarUrl`, `displayName`, and expanded `role` enum — none documented in `dental_membership` spec table. `securityQuestion`/`securityAnswerHash` implement a PIN recovery flow referenced in code but absent from spec §10.

**Risk:** Low for correctness, but these fields are invisible to spec readers and cannot be covered by spec-derived acceptance criteria.

### CG-3: pg-boss async architecture for dental-audit not implemented
**Severity: MEDIUM**  
Spec mandates pg-boss for async audit event writes. Code uses `logAuditEvent` from `@/core/audit-logger` called inline (synchronously in tests, no queue consumer in `handlers/dental-audit/`). This is either a spec-ahead-of-code situation (pg-boss not yet wired) or the spec architecture was abandoned in favor of sync writes. Either way, the code-spec divergence is undocumented.

**Risk:** If `logAuditEvent` is synchronous, it adds latency to every write path. If it fails, audit events are lost silently. AC-AUD-001 (within 5s) is technically satisfiable either way, but the decoupled-queue guarantee of the spec is not met.

---

## Overall Compliance Score

**7 / 10**

**Rationale:**
- All 11 spec modules have handler directories (strong structural alignment)
- Schema fields match spec for audited modules with minor extensions
- Recent security hardening (Slice H) in dental-org is correctly implemented and test-covered
- Deductions:
  - `-1`: PIN endpoints missing from dental-org §10 API table (spec document incomplete)
  - `-1`: `member_role` enum has 5 undocumented values in spec (RBAC surface undocumented)
  - `-0.5`: dental-audit route path mismatch + AC-AUD-002 gap
  - `-0.5`: `handlers/emr/` active module with no MODULE_SPEC

---

## Recent Changes Review (git diff HEAD)

The current diff (`152 insertions`) is focused on dental-org PIN auth security hardening (Slice H):

**What changed:**
- `DentalMembershipManagement_setPin.ts` — added `assertBranchAccess` before PIN mutation (CF-38/AUTH-02)
- `DentalMembershipManagement_verifyPin.ts` — added `assertBranchAccess` + `AuditRepository` write on successful verify (CF-46/AUTH-07)
- `verifyPin.ts` — lockout logic improvements
- `pinRecovery.ts` — recovery flow hardening
- `dental-auth-module7.test.ts`, `verifyPin.test.ts` — test coverage updated
- Frontend: `_dashboard.tsx`, `pin-entry.$memberId.tsx`, `pin-select.tsx` — minor additions

**Assessment of diff:** Changes are targeted and correctly address the security control references cited (CF-38, CF-46). The `assertBranchAccess` guard is the right pattern for cross-membership isolation. The dual-handler situation (`setPin.ts` vs `DentalMembershipManagement_setPin.ts`) warrants a check that only one is registered on the route — having two files for the same operation creates confusion about which is authoritative.
