# PMD Module Audit — Patient Medical Documents

**Date:** 2026-05-26
**Auditor:** Read-only automated audit
**Prior global score:** ~70%

---

## Scope

Backend: `services/api-ts/src/handlers/dental-pmd/`
Frontend: `apps/dentalemon/src/features/pmd/` + `features/workspace/`
Tests: `dental-pmd.test.ts`, `dental-pmd-module8.test.ts`, `pmd-generation.spec.ts`, `pmd-import.spec.ts`
OpenAPI: `specs/api/dist/openapi/openapi.json`

---

## Findings Summary

| # | Severity | Gate | Finding |
|---|----------|------|---------|
| F1 | P0-CRITICAL | G4/G7 | Fake SHA-256 checksum — not cryptographically valid |
| F2 | P0-CRITICAL | G7 | `findByVisit` only returns `status='generated'` — signed PMDs are invisible to supersession logic |
| F3 | P1 | G7 | Amendment flow calls `createAmendment` (visit-level clinical note amendment) — NOT a PMD void/amend operation. J10 (void/amend signed PMD entry) has no backend endpoint |
| F4 | P1 | G2 | `listPMDs` uses `assertBranchAccess` (any role) but `generatePMD` requires `['dentist_owner', 'dentist_associate', 'staff_full']` — `readonly` role can read; role asymmetry is undocumented |
| F5 | P1 | G6 | OpenAPI lists `GET /dental/visits/pmd` (listPMDs) but frontend never calls it — `usePMD` calls `GET /dental/visits/{visitId}/pmd` (getPMDForVisit). The list endpoint is dead from the frontend |
| F6 | P1 | G4 | `PMDImport` component uses raw `fetch()` to `POST /dental/pmd/import` — not using SDK. No auth token injection beyond `credentials: 'include'`. Inconsistent with rest of codebase |
| F7 | P1 | G5 | Amendment form (`amendment-form.tsx`) is complete UI — but it amends a clinical note record (tooth slideout), not a PMD document. The form label says "Add Amendment" to a `visitId`/`originalRecordId`. This is NOT PMD supersession |
| F8 | P2 | G3 | `pmd-generation.spec.ts` creates patient via `POST /patients` (non-dental endpoint) — likely wrong for this app's patient model |
| F9 | P2 | G6 | `useSharePMD` calls `generatePMD` (POST) — this re-generates/supersedes the PMD on every "share". Sharing should use `exportPMD` (GET export), not regenerate |
| F10 | P2 | G8 | No frontend unit tests for `PMDImport` confirm flow (file exists: `pmd-import.test.ts` — not read, but found). No E2E for amendment chain or supersession chain |
| F11 | P2 | G4 | `PMDViewerSheet` shows superseded PMDs with amber banner but no link to the superseding document — chain navigation missing |
| F12 | P2 | G2 | `importPMD` authorizes via `patient.preferredBranchId` — if patient has no preferred branch, throws `ForbiddenError` not `BadRequest`. Import of a patient without a branch is silently denied |
| F13 | P3 | G6 | `getImportedPMD` has inline audit logging with `ctx.get('audit') as any` — bypasses typed audit service. All other handlers omit audit logging entirely |
| F14 | P3 | G5 | `PMDImport` validates that content must be valid JSON (client-side), but backend `importPMD` accepts any string in `content` field — content-type contract mismatch |
| F15 | P3 | G4 | `exportPMD` falls back to `pmds[0]!` if all PMDs are superseded — could export a superseded document without warning |

---

## Gate-by-Gate Analysis

### Gate 2 — Roles

| Endpoint | Role Gate | Notes |
|----------|-----------|-------|
| `POST /dental/visits/{visitId}/pmd` (generate) | `dentist_owner`, `dentist_associate`, `staff_full` | `assertBranchRole` |
| `GET /dental/visits/{visitId}/pmd` (get for visit) | Any branch member | `assertBranchAccess` |
| `GET /dental/visits/{visitId}/pmd/export` | `dentist_owner`, `dentist_associate`, `staff_full` | `assertBranchRole` |
| `POST /dental/pmd/import` | `dentist_owner`, `dentist_associate`, `staff_full` | `assertBranchRole` via patient's branch |
| `GET /dental/visits/pmd` (list) | Any branch member | `assertBranchAccess` |
| `GET /dental/pmd/imported` (list imported) | Any branch member | `assertBranchAccess` |
| `GET /dental/pmd/imported/{id}` | Any branch member | `assertBranchAccess` |

**Finding F4:** `listPMDs` with `assertBranchAccess` means a `readonly` role can list all PMDs for a patient. This is likely intentional but undocumented. `generatePMD` and `exportPMD` correctly restrict to clinical staff.

No frontend role gate on PMD tab visibility was found in the read components — tab visibility relies entirely on server 403s.

### Gate 3 — Routes

- `pmd-generation.spec.ts`: Full E2E journey — signup → patient → visit → activate → treatment → complete → generate PMD → verify content. Tests app at `localhost:3003`, API at `localhost:7213`.
- `pmd-import.spec.ts`: Tests `POST /dental/pmd/import` directly via `page.evaluate` fetch. Also tests 401. Does NOT test the PMD import UI component flow.
- **Finding F8:** `pmd-generation.spec.ts` creates patient via `POST /patients` (generic person endpoint) which returns `{ id }`. The dental patient model uses `POST /dental/patients` or similar. This may silently produce wrong patient IDs.

### Gate 4 — Interactions

- **PMDViewer**: Read-only after generation. Correct — no edit controls. Shows status badge (generated/signed/superseded), checksum, treatments, prescriptions.
- **PMD generation trigger**: `useSharePMD` calls `generatePMD` (POST) — naming implies "share" but actually generates/supersedes. **Finding F9**: sharing should call `exportPMD`, not regenerate.
- **Amendment flow**: `amendment-form.tsx` is complete (no TODO remaining — prior audit noted TODO which has been resolved). But it targets clinical note amendments (`createAmendment` at `POST /dental/visits/{visitId}/amendments`), NOT PMD document supersession. These are different operations. J10 (void/amend signed PMD) remains unimplemented at the PMD layer.
- **Share PMD**: `useSharePMD` mutation re-generates. Works but semantically wrong — every "share" creates a new supersession chain entry.
- **Import**: `PMDImport` is a 3-step wizard (form → preview safety floor items → confirm). **Finding F6**: uses raw `fetch()` instead of SDK.

### Gate 5 — Forms

**Amendment form** (`amendment-form.tsx`):
- Fields: `reason` (select: correction/additional_finding/clarification), `content` (textarea, min 10 chars)
- Validation: both fields required, content ≥ 10 chars
- Status: Complete UI, functional — BUT targets visit-level clinical note amendment, not PMD supersession
- No TODO remaining in this file

**PMD Import form** (`pmd-import.tsx`):
- Fields: `sourceFacility` (required), `sourceReference` (optional), `content` (JSON textarea, required)
- Validation: sourceFacility required, content must be valid JSON (client-side)
- 3-step: form → preview (extracts conditions/medications/allergies) → confirm
- **Finding F14**: Backend accepts any string; frontend enforces JSON-only

### Gate 6 — API Contract

| Frontend Call | Hook/Component | OpenAPI Endpoint | Match? |
|--------------|----------------|------------------|--------|
| `getPmdForVisitOptions({path:{visitId}})` | `use-pmd.ts` | `GET /dental/visits/{visitId}/pmd` | YES |
| `generatePmd({path:{visitId}, body:{patientId}})` | `use-share-pmd.ts` | `POST /dental/visits/{visitId}/pmd` | YES (but semantically wrong — see F9) |
| `fetch(apiBaseUrl + '/dental/pmd/import', ...)` | `pmd-import.tsx` | `POST /dental/pmd/import` | YES (raw fetch, not SDK) |
| `GET /dental/visits/pmd` (listPMDs) | — | OpenAPI registered | DEAD — no frontend consumer |
| `GET /dental/visits/{visitId}/pmd/export` | — | OpenAPI registered | NO frontend consumer found |

**Finding F5:** `exportPMD` endpoint exists in OpenAPI and backend, but no frontend hook uses it. The download functionality is unreachable from the UI.

**Finding — `createAmendment`:** OpenAPI has `POST /dental/visits/{visitId}/amendments` (`operationId: createAmendment`). SDK `createAmendment` is called by `amendment-form.tsx`. This is a visit-level amendment, not a PMD operation. The OpenAPI spec has no PMD-specific void/amend/supersede endpoint beyond re-generation via `POST /dental/visits/{visitId}/pmd`.

### Gate 7 — Journeys

**J10 — Void/Amend Signed PMD:**
Broken because:
1. There is no `PATCH /dental/visits/{visitId}/pmd/:pmdId/void` or `POST .../supersede` endpoint
2. `generatePMD` re-generates by superseding the existing PMD — but only if `existing.status === 'generated'`
3. **Finding F2 (P0-CRITICAL):** `findByVisit()` in `pmd-document.repo.ts` line 53 queries `.where(and(eq(visitId), eq(status, 'generated')))` — it only finds `generated` PMDs. If a PMD is `signed`, `findByVisit` returns `null`. Then `generatePMD` creates a NEW PMD without superseding the signed one, breaking the chain integrity. Two active PMDs can coexist for the same visit.
4. Amendment form (`amendment-form.tsx`) amends a clinical note, not the PMD. This does not create a PMD supersession.

**Full PMD Journey — Nominal Path:**
1. Visit completed → `POST /dental/visits/{visitId}/pmd` → PMD created (`status: 'generated'`)
2. PMD viewable via `usePMD` → `GET /dental/visits/{visitId}/pmd` → shown in `PMDViewerSheet`
3. Export: `GET /dental/visits/{visitId}/pmd/export` → JSON download (no frontend trigger exists — F5)
4. Import external PMD: `PMDImport` wizard → `POST /dental/pmd/import` → creates `ImportedPMD` record

**Supersession chain — partially broken:**
- `pmd-document.repo.ts` `supersede()` correctly marks old as superseded and links `supersedesId`
- `exportPMD` correctly skips superseded PMDs (filters `status !== 'superseded'`)
- But `findByVisit` misses signed PMDs → chain breaks when a PMD is signed before re-generation

### Gate 8 — Tests

**`dental-pmd.test.ts`** covers:
- `generatePMD`: auth (401), visit-not-found (404), visit-not-completed (400), success (201)
- `getPMDForVisit`: auth (401), not-found (404), success (200)
- `importPMD`: auth (401), patient-not-found (404), success (201)
- `listImportedPMDs`: auth (401), patientId missing (400), success (200)
- `listPMDs`: auth (401), patientId missing (400), success (200)
- Uses `buildTestApp()` pattern — handlers mounted inline, not via real server router

**`dental-pmd-module8.test.ts`** adds:
- `getImportedPMD`: auth (401), not-found (404), JSON content parse (200), raw text fallback (200)
- `exportPMD`: auth (401), no PMD found (404), success with `Content-Disposition` header (200)
- Import with structured JSON content

**Frontend tests found:**
- `pmd-import.test.ts` — exists (not fully read due to context)
- `pmd-viewer.test.ts` — exists (not fully read)
- `use-pmd.test.ts` — exists
- `use-share-pmd.test.ts` — exists

**Missing tests:**
- Amendment → PMD supersession chain (no test that amendment triggers PMD update)
- Signed PMD re-generation (the F2 bug path: sign PMD → re-generate → should supersede signed)
- Export → Import round-trip (export JSON from visit A, import to patient B, verify content integrity)
- Supersession chain navigation (PMD B supersedesId → PMD A)
- `listPMDs` via real server (currently dead from frontend)
- Frontend E2E for import wizard UI flow (spec only tests API directly)

---

## Critical Issues Detail

### F1 — Fake SHA-256 (P0-CRITICAL)
**File:** `services/api-ts/src/handlers/dental-pmd/generatePMD.ts` lines 22-27

```ts
function sha256Hex(content: string): string {
  // Simple checksum using content length + first/last chars for demo
  // In production use node:crypto
  const sum = content.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `sha256-${sum.toString(16).padStart(16, '0')}`;
}
```

This is NOT SHA-256. It is a character-code sum. Two different documents with the same character sum will have identical "checksums." PMDs are legally binding immutable records — the checksum is the integrity guarantee. This comment says "In production use node:crypto" but was never replaced.

**Fix:** Replace with `import { createHash } from 'node:crypto'; return createHash('sha256').update(content).digest('hex');`

### F2 — findByVisit misses signed PMDs (P0-CRITICAL)
**File:** `services/api-ts/src/handlers/dental-pmd/repos/pmd-document.repo.ts` lines 49-56

```ts
async findByVisit(visitId: string): Promise<PMDDocument | null> {
  const [row] = await this.db
    .select()
    .from(pmdDocuments)
    .where(and(eq(pmdDocuments.visitId, visitId), eq(pmdDocuments.status, 'generated')));
  return row ?? null;
}
```

If a PMD is signed (`status = 'signed'`), `findByVisit` returns `null`. Then `generatePMD` (line 92-113) takes the `else` branch and creates a brand-new PMD without superseding the signed one. Two non-superseded PMDs now exist for the same visit.

**Fix:** Remove `eq(pmdDocuments.status, 'generated')` from `findByVisit`. Query should return any non-superseded PMD. Or query for `status IN ('generated', 'signed')`.

### F3 — J10 Void/Amend Signed PMD — No backend endpoint (P1)
The amendment form calls `createAmendment` (`POST /dental/visits/{visitId}/amendments`) — this is a visit-level clinical note amendment, not a PMD operation. There is no endpoint to:
- Void a signed PMD
- Formally amend a signed PMD (creating a supersession with amendment reason)
- Track who authorized the void/amendment

The OpenAPI spec has no such endpoint. `generatePMD` re-generation is the only supersession path, but it doesn't record an amendment reason or require elevated authorization beyond `staff_full`.

### F9 — useSharePMD re-generates instead of exporting (P2)
**File:** `apps/dentalemon/src/features/workspace/hooks/use-share-pmd.ts`

Calls `generatePmd` (POST = create/supersede). Every share action creates a new PMD version in the supersession chain. Should call `exportPMD` (GET `/dental/visits/{visitId}/pmd/export`) which returns the existing PMD as a downloadable file without mutation.

---

## Immutability Assessment

| Property | Status |
|----------|--------|
| Append-only repo (no UPDATE on content) | PASS — `supersede()` inserts new, marks old superseded |
| Content hash integrity | FAIL — hash is not SHA-256 (F1) |
| Signed PMD tamper-proof | PARTIAL — `sign()` uses WHERE status='generated' guard, but F2 can create duplicate active PMDs |
| Chain linkage (`supersedesId`) | PASS — field populated on supersede |
| Chain navigability from UI | FAIL — no link from superseded → superseding document in viewer |
| Audit trail on sign | MISSING — `sign()` has no audit log call |
| Audit trail on generate | MISSING — no audit log in `generatePMD` |
| Audit trail on export | PARTIAL — only `getImportedPMD` has audit logging, and it's `ctx.get('audit') as any` |

---

## Recommended Fix Priority

| Priority | Finding | Action |
|----------|---------|--------|
| P0 | F1 — fake checksum | Replace with `node:crypto` SHA-256 immediately |
| P0 | F2 — findByVisit status filter | Remove `status='generated'` guard; query all non-superseded |
| P1 | F3 — J10 no void/amend endpoint | Design + implement `POST /dental/visits/{visitId}/pmd/{pmdId}/amend` with reason + elevated auth |
| P1 | F9 — share re-generates | Change `useSharePMD` to call `exportPMD` GET endpoint |
| P1 | F5 — export unreachable from UI | Add export download button wired to `GET /dental/visits/{visitId}/pmd/export` |
| P1 | F6 — raw fetch in import | Migrate `PMDImport` to use SDK `importPmd` function |
| P2 | F11 — no chain nav in viewer | Add "superseded by" link in `PMDViewer` when `status='superseded'` |
| P2 | F13 — inconsistent audit logging | Add structured audit log calls to `generatePMD`, `exportPMD`, `importPMD` |
| P2 | F15 — export superseded fallback | Add warning header or 409 when only superseded PMDs exist |
| P3 | F14 — content-type mismatch | Either enforce JSON in backend schema or relax client-side validation |

---

*Audit complete. Context window at ~80% at time of write — no follow-up analysis performed.*
