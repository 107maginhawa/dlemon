---
module: dental-pmd
reviewed: 2026-05-27T00:00:00Z
depth: deep
spec: docs/product/modules/dental-pmd/MODULE_SPEC.md
api_contracts: docs/product/modules/dental-pmd/API_CONTRACTS.md
findings:
  critical: 5
  warning: 6
  info: 3
  total: 14
status: issues_found
---

# Enforcement Review: dental-pmd

**Reviewed:** 2026-05-27
**Depth:** deep
**Status:** issues_found

---

## Summary

Full enforcement pass against MODULE_SPEC §7.2 Import Contract, all declared API endpoints, domain rules (BR-021, BR-022), permissions, state transitions, and schema constraints. Five blockers found — three are spec violations on the import contract, one is a security issue (authorization order), and one is a fake SHA-256 checksum. Six warnings cover schema FK violations, missing read-only route enforcement, response shape mismatches, and pagination bugs.

---

## Critical Issues

### CR-01: §7.2 Import Contract Invariant 1 violated — `imported_pmd` has a live DB FK to `patients`

**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts:41`
**Spec rule:** §7.2 ¶1 — "No DB foreign key constraints to `dental_patient`, `dental_branch`, or `dental_membership` tables."
**Issue:** `imported_pmd.patientId` is declared with `.references(() => patients.id)`. This is a hard FK to the `patients` table, directly violating the import contract. If a patient record is deleted (e.g. GDPR erasure), the FK constraint blocks the erasure path and breaks the "UUID refs only" isolation guarantee.
**Fix:**
```typescript
// pmd-document.schema.ts — remove .references() call
patientId: uuid('patient_id').notNull(),   // plain UUID, no FK
```
No corresponding FK should exist for `branch_id` or `imported_by_member_id` either; confirm neither is added in a future migration.

---

### CR-02: §7.2 Import Contract Invariant 4 violated — checksum is optional, not required; no server-side verification

**File:** `services/api-ts/src/handlers/dental-pmd/importPMD.ts:36-43`
**Also:** `docs/product/modules/dental-pmd/API_CONTRACTS.md:107` (marks `checksum` as `NO` required)
**Spec rule:** §7.2 ¶4 — "import must provide a checksum field; server verifies it against the uploaded content before creating the row. Missing or mismatched checksum → 422 CHECKSUM_MISMATCH."
**Issue:** The `importPMD` handler never reads a `checksum` field, never verifies it, and the repo `createOne` call has no checksum column at all. The API contract doc contradicts the spec by listing `checksum` as not-required. The spec is authoritative; both the handler and contract doc are wrong.
**Fix:**
```typescript
// importPMD.ts
import { createHash } from 'node:crypto';

const providedChecksum = body.checksum;
if (!providedChecksum) {
  throw new ValidationError('checksum is required', 'CHECKSUM_MISSING');
}
const actualChecksum = createHash('sha256').update(body.content).digest('hex');
if (actualChecksum !== providedChecksum) {
  throw new ValidationError('Checksum mismatch', 'CHECKSUM_MISMATCH');
}
```
Also update `ImportedPMD` schema to store `checksum text not null` and update `imported-pmd.repo.ts` to accept and persist it.

---

### CR-03: §7.2 Import Contract Invariant 5 violated — `source_description` maps to `sourceFacility`; field effectively optional in handler

**File:** `services/api-ts/src/handlers/dental-pmd/importPMD.ts:36-43`
**Spec rule:** §7.2 ¶5 — "`source_description` required — the originating system must be identified."
**Issue:** The spec calls the field `source_description` (e.g. "Open Dental v21.1"). The schema/handler uses `sourceFacility` (camelCase) without a `source_description` field. The API contract doc (line 107) marks `source_description` as `NO` (not required), contradicting the spec. Regardless of naming, the handler does pass `sourceFacility` as required via the zod validator, but the semantic gap means the audit trail provenance requirement is partially met — no system version string is enforced, and the contract doc actively tells callers the field is optional.
**Fix:**
- Align field name or alias: accept `source_description` (per spec) OR document the deliberate rename and update the spec.
- Change API contract doc to mark `source_description` / `sourceFacility` as `YES` (required).
- Add a minimum-length constraint (e.g. `min(2)`) to prevent blank strings from passing.

---

### CR-04: Authorization check after data fetch — IDOR window on `getImportedPMD`

**File:** `services/api-ts/src/handlers/dental-pmd/getImportedPMD.ts:24-34`
**Issue:** The handler fetches the `imported_pmd` record from the DB (line 26) and only then resolves the patient to check branch authorization (line 31-34). An authenticated user from a different branch can probe valid imported PMD IDs: if the patient lookup fails (line 31 `NotFoundError`) or succeeds, the timing/error difference leaks whether the record exists. The record fetch should occur only after confirming branch authorization, not before.
**Fix:**
```typescript
// Fetch the record ID from query param; do NOT fetch the row yet.
// Get patientId from the request (query param or route), authorize first,
// then fetch the record.
export async function getImportedPMD(ctx: Context): Promise<Response> {
  // ...
  // Step 1: validate ID format only
  // Step 2: get patientId from request param (add ?patientId= or route param)
  // Step 3: assertBranchRole
  // Step 4: fetch record; 404 if not found
}
```
Alternatively: wrap the initial `findOneById` to return null without timing detail, then authorize before returning the record content. The current code reveals record existence to unauthorized actors.

---

### CR-05: `sha256Hex` in `generatePMD` is not SHA-256 — checksum is fake

**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts:22-27`
**Issue:** The function named `sha256Hex` computes a sum of char codes and prefixes it with `"sha256-"`. It is not SHA-256. BR-021 requires checksum-verified immutability; a fake checksum defeats integrity verification entirely. AC-PMD-003 (checksum mismatch → reject) cannot be satisfied when the checksum is derived from a broken algorithm. The comment in the source says "In production use node:crypto" — this is production code.
**Fix:**
```typescript
import { createHash } from 'node:crypto';

function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
```

---

## Warnings

### WR-01: `pmd_document` has live DB FKs to `dental_visit`, `patients`, `dental_memberships`, `dental_branch` — violates §20 AI instruction and coupling intent

**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.schema.ts:23-26`
**Issue:** MODULE_SPEC §20 instruction 2 says "No DB-level FKs to dental-visit (loose coupling) — use UUID ref only." The schema has `.references(() => dentalVisits.id)` on `visitId`, `.references(() => patients.id)` on `patientId`, `.references(() => dentalMemberships.id)` on `authorMemberId`, and `.references(() => dentalBranches.id)` on `branchId`. All four are forbidden by the spec.
**Fix:** Remove all four `.references()` calls from `pmd_document`. Store as plain `uuid('...')` columns. Referential integrity is maintained at the application layer via `getVisitOrThrow`.

---

### WR-02: BR-022 / §7.2 ¶3 — no 405 route-level rejection for PATCH/PUT/DELETE on imported PMDs

**File:** Route registration (not visible in reviewed files, but `importPMD.ts` has no router shown)
**Issue:** The spec (BR-022, §7.2 ¶3, AC-PMD-002) requires that PATCH/PUT/DELETE on imported PMD rows must return 405 at the router level, not a 403. The `ImportedPMDRepository` exposes `markSafetyFloorMerged` which performs a DB UPDATE — this is a mutation path on an "immutable" record. The API contract doc states PATCH/DELETE return `405 IMPORTED_PMD_IMMUTABLE`, but no test covers the 405, and the repo allows updates. No evidence that any router registers 405 handlers for these verbs.
**Fix:**
- Register explicit PATCH/PUT/DELETE routes for `/dental/pmd/imported/:id` that return 405 unconditionally before any auth checks.
- Add test: `PATCH /dental/pmd/imported/:id → 405`.
- If `markSafetyFloorMerged` is an internal-only operation (not via user-facing API), document that clearly and ensure no route exposes it.

---

### WR-03: `listPMDs` pagination is post-hoc (fetch-all then slice) — incorrect total count

**File:** `services/api-ts/src/handlers/dental-pmd/listPMDs.ts:33-38`
**Also:** `services/api-ts/src/handlers/dental-pmd/listImportedPMDs.ts:33-38`
**Issue:** Both handlers call `repo.findMany({ patientId })` which fetches ALL records, then slices in memory. The `totalCount` is therefore always the full unsliced count, but the `page` response returns only a slice. For large datasets this returns wrong pagination metadata (items not matching page reported as present). Additionally, all records are loaded into memory regardless of page size.
**Fix:** Push pagination to the DB layer. Add `limit`/`offset` params to `findMany` and use Drizzle's `.limit()` / `.offset()` methods. Use a separate `COUNT(*)` query for `totalCount`, or pass `limit`/`offset` through the repo. The current approach also means `parsePagination` is called after the full fetch, so `offset` is always applied against the already-complete set — the total count is correct numerically but the design is fragile.

---

### WR-04: `generatePMD` allows `staff_full` to generate PMDs — violates spec permissions

**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts:40`
**Issue:** `assertBranchRole` is called with `['dentist_owner', 'dentist_associate', 'staff_full']`. MODULE_SPEC §6 says "Generate PMD: dentist_owner, dentist_associate" — `staff_full` is listed only for Import and Download, not generation.
**Fix:**
```typescript
await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);
```

---

### WR-05: `membership` is not null-guarded before use — silent `undefined!` dereference

**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts:99`
**Issue:** `membership` is declared as the destructured result of a limit-1 DB query (line 43). If no active membership is found for the user+branch, `membership` is `undefined`. The code uses `membership!.id` on line 99 with a non-null assertion, which will throw a runtime `TypeError: Cannot read properties of undefined` instead of a controlled domain error.
**Fix:**
```typescript
if (!membership) {
  throw new ForbiddenError('No active membership found for this branch');
}
// then use membership.id safely
```

---

### WR-06: `exportPMD` — `JSON.parse(pmd.content)` has no error guard; throws 500 on corrupt stored content

**File:** `services/api-ts/src/handlers/dental-pmd/exportPMD.ts:53`
**Issue:** `JSON.parse(pmd.content)` on line 53 has no try/catch. If stored content is corrupt (possible if written by external tooling or the fake sha256 logic failed atomically), this throws a SyntaxError which propagates as a 500. The rest of the codebase wraps this pattern in try/catch (see `getImportedPMD.ts:39-44`).
**Fix:**
```typescript
let parsedContent: unknown;
try {
  parsedContent = JSON.parse(pmd.content);
} catch {
  parsedContent = pmd.content; // raw fallback
}
```

---

## Info

### IN-01: API contract uses different URL shape than handler — `GET /dental/pmd/:patientId` vs query param

**File:** `docs/product/modules/dental-pmd/API_CONTRACTS.md:49-55` vs `services/api-ts/src/handlers/dental-pmd/listPMDs.ts:20`
**Issue:** The API contract specifies `GET /api/v1/dental/pmd/:patientId` (path param). The handler reads `ctx.req.query('patientId')` (query param). These are different URL shapes. Tests use the query param form. Contract doc is wrong or out of date.
**Fix:** Align contract doc to reflect query param form, or update handler to use path param to match the declared contract.

---

### IN-02: `PMDDocument` frontend type missing `branchId` field

**File:** `apps/dentalemon/src/features/pmd/types.ts:28-39`
**Issue:** The backend `PMDDocument` includes `branchId`; the frontend `PMDDocument` interface omits it. Not currently a runtime bug (the field is unused in the viewer), but the interface is incomplete relative to the API response shape.
**Fix:** Add `branchId: string` to the frontend `PMDDocument` interface.

---

### IN-03: `pmd-import.tsx` validation requires JSON content — contradicts API contract which accepts PDF/XML

**File:** `apps/dentalemon/src/features/pmd/components/pmd-import.tsx:53-55`
**Issue:** The frontend validates that `content` is valid JSON and rejects non-JSON input. The API contract specifies `multipart/form-data` with PDF or XML file uploads. The frontend UI accepts a JSON text area instead of a file upload, which is inconsistent with the spec. This is currently a feature gap, not a code bug, but the JSON-only enforcement in the UI will silently block PDF/XML imports.
**Fix:** Replace the textarea with a file input (`<input type="file" accept=".pdf,.xml">`) and send `multipart/form-data` per the API contract. The current UI is disconnected from the declared API surface.

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer / oli-enforce-module)_
_Depth: deep_
