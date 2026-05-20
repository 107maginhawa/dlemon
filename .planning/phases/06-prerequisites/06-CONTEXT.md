# Phase 1.5: Prerequisites — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart Discuss (autonomous)

<domain>
## Phase Boundary

Two independent infrastructure prerequisites that Phase 2 (Core Imaging Workspace) depends on.
Both can be done in parallel but are shipped together in this phase.

**1.5a — Chunked Upload (Lane A):**
Add S3 multipart upload to the storage module, raise file size limit to 100MB (BR-033).
Must include abort handler for partial uploads on network failure.

**1.5b — Imaging Tier Stub (Lane B):**
Add `imagingTier` enum column to the dental organization schema (`free | basic | addon`),
default `free`. Null on existing orgs (pre-migration) must be treated as `'free'` — never
expose paid features to unpaid orgs.

**Phase relationship:** Parallel with Phase 1 (rendering spike). Both must complete before
Phase 2 begins.

</domain>

<decisions>
## Implementation Decisions

### From eng review (D1 — Chunked Upload):
- S3 multipart upload: initiate → upload parts → complete or abort
- Abort handler REQUIRED on network failure (orphaned S3 objects are a cost/compliance risk)
- MAX_FILE_SIZE raised to 100MB in file.schema.ts
- TypeSpec endpoints added: multipart initiate, complete, abort
- Files: `services/api-ts/src/handlers/storage/uploadFile.ts`,
  `completeFileUpload.ts`, `repos/file.schema.ts`, `specs/api/src/modules/storage.tsp`

### From eng review (D2 — Imaging Tier Stub):
- Column: `imagingTier` enum (`free`, `basic`, `addon`), nullable, default `free`
- NULL → treated as `'free'` at business layer (never at DB layer — keep nullable for migration safety)
- Files: `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts`,
  `organization.repo.ts`
- No TypeSpec change needed for the stub (tier is internal, not exposed in API for Phase 1.5)

### Grey Area: TypeSpec workflow for multipart endpoints
**Question:** Do we follow the full API-first TypeSpec → codegen → handler workflow for
multipart endpoints, or implement directly given the complexity?
**Proposed answer:** Follow TypeSpec first (per CLAUDE.md API-first mandate). Add 3 new
operations to storage.tsp: `initiateMultipartUpload`, `completeMultipartUpload`,
`abortMultipartUpload`. Run `cd specs/api && bun run build` then
`cd services/api-ts && bun run generate` before implementing handlers.

### Grey Area: S3 mock for tests
**Question:** Do tests need a real S3/MinIO or a mock?
**Proposed answer:** Use existing test patterns. Check how `uploadFile.ts` tests are currently
written. If test infrastructure uses MinIO (docker-compose.deps.yml pattern), follow that.
If no S3 test infrastructure exists, write unit tests that mock the S3 client with bun:mock.

</decisions>

<code_context>
## Existing Code Insights

### Storage module layout (from eng review / Codex validation):
- `services/api-ts/src/handlers/storage/uploadFile.ts` — existing upload handler
- `services/api-ts/src/handlers/storage/completeFileUpload.ts` — existing complete handler
- `services/api-ts/src/handlers/storage/repos/file.schema.ts` — file schema with MAX_FILE_SIZE
- `specs/api/src/modules/storage.tsp` — existing TypeSpec definitions

### Dental-org module:
- `services/api-ts/src/handlers/dental-org/repos/organization.schema.ts` — org schema
- Uses Drizzle ORM — add column via schema + generate migration

### API-first workflow (CLAUDE.md mandated):
1. Edit TypeSpec → 2. `bun run build` → 3. `bun run generate` → 4. Implement handlers

</code_context>

<specifics>
## Specific Ideas

- The `imagingTier` column is a stub — Phase 2 will read it for gate-keeping. Phase 1.5
  just adds the column and migration; no business logic needed yet.
- Multipart abort must be called on upload cancellation AND on network error (use
  try/finally or error handler in the upload flow)
- Keep the tier check middleware for Phase 2 — don't implement it in Phase 1.5

</specifics>
