<!-- oli-version: 1.0 -->
<!-- generated: 2026-05-24 -->
<!-- reconciled: 2026-05-30 (V-PMD-006 / V-PMD-009) — aligned to implemented JSON reality -->
<!-- skill: oli-api-contracts --all -->
<!-- based-on: MODULE_SPEC dental-pmd, API_CONVENTIONS.md, ERROR_TAXONOMY.md, generated/openapi -->

# API Contracts — dental-pmd

> PMD = **Portable Medical Document** (canonical; V-PMD-009). Generated documents are immutable (BR-021/BR-022).
> Generated: `generated` → `signed`/`superseded`. Imported: read-only.
>
> **V-PMD-006 reconciliation note:** The original contract specced presigned-URL downloads,
> multipart file upload, and `download_url`/`expires_at`/`file_url`/`size_bytes` fields. None of
> these are built. The platform has no object-store file flow for PMDs yet — generated/imported
> PMD content is stored and served **inline as JSON**. This document now reflects the implemented
> reality. Presigned-URL download and multipart upload are deferred to a future phase.

---

## Endpoints

### POST /dental/visits/{visitId}/pmd

Generate a PMD for a completed (or locked) visit. Re-generation supersedes the prior document.

**Auth:** `dentist_owner`, `dentist_associate` (branch role)
**Path params:** `visitId` (uuid)

**Request body (JSON):**

| Field | Type | Required | Format | Notes |
|-------|------|----------|--------|-------|
| `patientId` | string | YES | uuid | Patient identity bound into the snapshot |

> `branch_id` is NOT a request input — it is derived from the visit's branch (single source of truth).

**Response 201:** `PMDDocument` (inline JSON, not wrapped)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `visitId` | string (uuid) | NO | plain UUID, no DB FK (§7.2) |
| `patientId` | string (uuid) | NO | plain UUID, no DB FK (§7.2) |
| `authorMemberId` | string (uuid) | NO | clinician (non-repudiation) |
| `branchId` | string (uuid) | YES | |
| `status` | string | NO | `generated` \| `signed` \| `superseded` |
| `content` | string | NO | JSON snapshot of visit (CDT/RxNorm coded) |
| `checksum` | string | NO | `sha256-<hex>` of content |
| `signature` | string | YES | base64 digital signature |
| `signedAt` | string (date-time) | YES | |
| `supersedesId` | string (uuid) | YES | prior PMD this replaces |
| `createdAt` / `updatedAt` | string (date-time) | NO | |

**Errors:** `VISIT_NOT_COMPLETED(422)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`
**Domain event:** DE-017 PMDGenerated — satisfied by a synchronous `pmd.generated` audit row (ADR-006; no event bus).

---

### GET /dental/visits/{visitId}/pmd

Get the current (non-superseded) generated PMD for a visit.

**Auth:** branch membership **or** patient-self (the patient may read their own PMD — §6, V-PMD-008)
**Path params:** `visitId` (uuid)

**Response 200:** `PMDDocument` (as above)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`

---

### GET /dental/pmd?patientId={patientId}

List generated PMD documents for a patient.

**Auth:** branch membership **or** patient-self (V-PMD-008)
**Query params:** `patientId` (uuid, required), `limit`, `offset`

**Response 200:** `{ data: PMDDocument[], pagination }`

**Errors:** `VALIDATION_ERROR(400)` (missing patientId), `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`

---

### GET /dental/visits/{visitId}/pmd/export

Download the current PMD as an attachment.

**Auth:** branch role (`dentist_owner`/`dentist_associate`/`staff_full`) **or** patient-self (V-PMD-008)
**Path params:** `visitId` (uuid)

**Response 200:** `application/json` body with `Content-Disposition: attachment; filename="pmd-<visit8>-<date>.json"`.
The body is an export envelope: `{ pmdId, visitId, patientId, branchId, status, checksum, generatedAt, signedAt, content }`.

> There is no presigned `download_url`/`expires_at`. The file is streamed inline. (V-PMD-006)

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`

---

### POST /dental/pmd/import

Import an external PMD record (read-only, links to patient).

**Auth:** `dentist_owner`, `dentist_associate`, `staff_full` (role on the patient's preferred branch)
**Content-Type:** `application/json`

> Transport is **JSON with an inline `content` string**, not `multipart/form-data` file upload.
> File-upload import is deferred. (V-PMD-006)

**Request body (JSON):**

| Field | Type | Required | Format | Constraints |
|-------|------|----------|--------|-------------|
| `patientId` | string | YES | uuid | plain UUID, no DB FK (§7.2) |
| `sourceFacility` | string | YES | — | originating facility name |
| `sourceReference` | string | NO | — | external reference id |
| `sourceDescription` | string | YES | — | originating system; **max 200** (V-PMD-010, EF-PMD-005) |
| `content` | string | YES | — | raw PMD content (JSON or text) |
| `checksum` | string | NO | `sha256-<hex>` | verified server-side if provided |

> `branch_id` is NOT a request input — derived from the patient's preferred branch.

**Response 201:** `ImportedPMD` (inline JSON)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | string (uuid) | NO | |
| `patientId` | string (uuid) | NO | |
| `sourceFacility` | string | NO | |
| `sourceReference` | string | YES | |
| `sourceDescription` | string | NO | |
| `content` | string | NO | |
| `importedAt` | string (date-time) | NO | |
| `safetyFloorMerged` | boolean | NO | see §2 "Safety Floor merge" |

**PATCH/PUT/DELETE:** Returns `405 IMPORTED_PMD_IMMUTABLE` (BR-022; route-level guard — handled by infra in `app.ts`).
**Audit:** writes a `pmd.import` audit event (PHI ingestion provenance — V-PMD-007).

**Errors:** `CHECKSUM_MISMATCH(422)`, `VALIDATION_ERROR(400)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`

---

### GET /dental/pmd/imported?patientId={patientId}

List imported PMDs for a patient.

**Auth:** branch membership **or** patient-self (V-PMD-008)
**Query params:** `patientId` (uuid, required), `limit`, `offset`

**Response 200:** `{ data: ImportedPMD[], pagination }`

**Errors:** `VALIDATION_ERROR(400)`, `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`

---

### GET /dental/pmd/imported/{id}

Get detail of an imported PMD with parsed content.

**Auth:** branch membership (via patient's preferred branch)
**Path params:** `id` (uuid)

**Response 200:** `{ id, patientId, sourceFacility, sourceReference, importedAt, safetyFloorMerged, contentType, content }`
where `contentType` is `json` (parsed object) or `text` (raw string).

**Errors:** `NOT_FOUND(404)`, `FORBIDDEN(403)`, `UNAUTHORIZED(401)`
