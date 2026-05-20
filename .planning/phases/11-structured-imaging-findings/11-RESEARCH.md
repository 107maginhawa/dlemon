# Phase 11: Structured Imaging Findings - Research

**Researched:** 2026-05-11
**Domain:** Dental imaging findings — Drizzle schema extension, TypeSpec new interface, handler CRUD, React sidebar panel
**Confidence:** HIGH (all findings verified from live codebase)

## Summary

Phase 11 adds an `imaging_finding` table with two new Postgres enums, four TypeSpec operations in a new `ImagingFindings` interface, four backend handlers following the established `ImagingMgmt_*` delegate pattern, a new `ImagingFindingRepository` (separate file from `imaging.repo.ts`), and a collapsible sidebar panel wired into the existing `ImagingWorkspace` component.

All patterns are available in the live codebase — no external research required. The handler skeleton (`ValidatedContext` delegate → `createFinding.ts` implementation), test harness (`buildApp` + mock DB in `imaging.test.ts`), and hook pattern (`use-measurements.ts`) can be copied directly. The sidebar is a new right-side panel inside the existing `flex flex-col bg-black` container.

**Primary recommendation:** New `imaging_finding.schema.ts` + `imaging_finding.repo.ts` under `repos/`; four `ImagingFindings_*.ts` delegate files; one `ImagingFindings` interface block appended to `dental-imaging.tsp`; one `use-imaging-findings.ts` hook; one `FindingsSidebarPanel` component inserted in `imaging-workspace.tsx`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D1** — New `imaging_finding` table (separate from `imaging_annotation`). Schema columns: id (baseEntityFields), imageId (NOT NULL → imaging_study_image.id), annotationId (nullable → imaging_annotation.id), treatmentId (nullable → dental_treatment.id), visitId (NOT NULL, denormalized), patientId (NOT NULL, denormalized), branchId (NOT NULL, denormalized), type (imaging_finding_type enum, NOT NULL), status (imaging_finding_status enum, NOT NULL, default 'suspected'), toothNumber (integer, nullable), surfaces (jsonb<string[]>, nullable), note (text, nullable).
- **D2** — 15-type enum `imaging_finding_type`: caries, secondary-caries, bone-loss, furcation-involvement, periapical-lesion, root-resorption, calculus, crown-fracture, root-fracture, impacted-tooth, over-eruption, open-contact, overhang, crown-needed, implant-needed.
- **D3** — Status enum `imaging_finding_status`: suspected, confirmed, monitoring, resolved. Any→any transitions (no forward-only enforcement).
- **D4** — `treatmentId` nullable FK → `dental_treatment.id`. PATCH `updateFinding` handles after-the-fact linking.
- **D5** — `annotationId` nullable FK → `imaging_annotation.id`.
- **D6** — Frontend: collapsible right-side panel in `imaging-workspace.tsx`. Click annotation → form pre-filled with annotationId. Findings list top, add-finding form bottom. Inline status badge selector.
- **D7** — TypeSpec ops: POST `/dental/imaging/images/{imageId}/findings` (createFinding), GET `/dental/imaging/images/{imageId}/findings` (listFindings), PATCH `/dental/imaging/findings/{findingId}` (updateFinding), DELETE `/dental/imaging/findings/{findingId}` (deleteFinding). New `ImagingFindings` interface.
- **D8** — Branch: `feat/v1.4-clinical-imaging` from `feat/v1.3-imaging-workspace`.

### Claude's Discretion
- Tooth numbering display: FDI or Universal — match existing chart numbering system.
- Note field: single-line text input, max 500 chars.
- Count badge on sidebar toggle button.

### Deferred Ideas (OUT OF SCOPE)
- Cephalometric workspace (Phase 12).
- Bulk finding import / auto-detection (v2 AI).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CIMG-01 | User can document structured imaging findings (caries, bone loss, periapical lesion, fracture, calculus, impaction, resorption, missing, implant, root canal, crown, bridge, filling, abscess, cyst, other) | D2 enum covers 15 types; CRUD via createFinding/listFindings handlers |
| CIMG-02 | Each finding is linked to tooth number, surface, image, annotation, visit, and provider | D1 schema: toothNumber, surfaces JSONB, imageId, annotationId, visitId, patientId (createdBy = provider) |
| CIMG-03 | Finding status follows workflow: suspected → confirmed → monitoring → resolved | D3 status enum; any→any; updateFinding PATCH |
| CIMG-04 | Finding can be linked to a treatment plan item | D4 treatmentId nullable FK; updateFinding PATCH with treatmentId field |
| CIMG-05 | User can use quick-select finding templates | Frontend only — pre-filled type chips in add-finding form |
| CIMG-06 | User can select affected teeth via dental chart | Frontend only — tooth number input in sidebar panel (single number v1, FDI/Universal) |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Finding persistence (create/list/update/delete) | API / Backend | — | All clinical data lives server-side; findings are medical records |
| Finding status lifecycle | API / Backend | — | Status transitions validated in handler; no client-side trust |
| Treatment plan linkage (treatmentId FK) | API / Backend | — | FK constraint enforced in DB; PATCH handler owns linking |
| Branch access control | API / Backend | — | `assertBranchAccess` pattern from existing imaging handlers |
| Sidebar panel UI + finding form | Frontend (Vite app) | — | In-workspace component; no SSR layer in this stack |
| Annotation click → finding form pre-fill | Frontend (Vite app) | — | SVG click event in `imaging-workspace.tsx` sets selected annotationId |
| Quick-select templates (CIMG-05) | Frontend (Vite app) | — | Client-side UX; just pre-fills the form type field |
| Tooth selection (CIMG-06) | Frontend (Vite app) | — | Numeric input; no chart-level API call needed for v1 |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (workspace version) | Schema definition + queries | Established in all dental-* modules |
| Hono | (workspace version) | HTTP handler context | All handlers use `BaseContext` from Hono |
| Zod | (workspace version) | Input validation | Used in `createMeasurement.ts`, required per CLAUDE.md |
| TanStack Query | (workspace version) | Frontend server state | Used in `use-measurements.ts`; pattern to copy |
| TypeSpec | (workspace version) | API definition | Mandatory TypeSpec-first workflow per CLAUDE.md |

[VERIFIED: live codebase — all imports confirmed in existing handler files]

---

## Architecture Patterns

### System Architecture Diagram

```
Dentist UI (imaging-workspace.tsx)
  │
  ├─ [click annotation on SVG] → sets selectedAnnotationId state
  │
  ├─ FindingsSidebarPanel
  │    ├─ use-imaging-findings(imageId) → GET /dental/imaging/images/{id}/findings
  │    ├─ FindingsList (top)
  │    └─ AddFindingForm (bottom)
  │         └─ POST /dental/imaging/images/{id}/findings
  │
  └─ [inline status chip] → PATCH /dental/imaging/findings/{findingId}
                          → DELETE /dental/imaging/findings/{findingId}

API (Hono)
  │
  ├─ ImagingFindings_createFinding.ts  → createFinding.ts
  ├─ ImagingFindings_listFindings.ts   → listFindings.ts
  ├─ ImagingFindings_updateFinding.ts  → updateFinding.ts
  └─ ImagingFindings_deleteFinding.ts  → deleteFinding.ts
       │
       └─ ImagingFindingRepository (imaging_finding.repo.ts)
            └─ imaging_finding table (imaging_finding.schema.ts)
                 ├─ FK → imaging_study_image.id
                 ├─ FK → imaging_annotation.id (nullable)
                 └─ FK → dental_treatment.id (nullable)
```

### Recommended Project Structure

```
services/api-ts/src/handlers/dental-imaging/
├── repos/
│   ├── imaging.schema.ts           (existing — no changes)
│   ├── imaging.repo.ts             (existing — no changes)
│   ├── imaging_finding.schema.ts   (NEW — enums + table)
│   └── imaging_finding.repo.ts     (NEW — CRUD methods)
├── ImagingFindings_createFinding.ts  (NEW delegate)
├── ImagingFindings_listFindings.ts   (NEW delegate)
├── ImagingFindings_updateFinding.ts  (NEW delegate)
├── ImagingFindings_deleteFinding.ts  (NEW delegate)
├── createFinding.ts                  (NEW implementation)
├── listFindings.ts                   (NEW implementation)
├── updateFinding.ts                  (NEW implementation)
├── deleteFinding.ts                  (NEW implementation)
└── imaging.test.ts                   (extend existing)

specs/api/src/modules/
└── dental-imaging.tsp                (EXTEND — add ImagingFindings interface)

apps/dentalemon/src/features/imaging/
├── hooks/
│   └── use-imaging-findings.ts       (NEW — copy use-measurements.ts pattern)
└── components/
    ├── imaging-workspace.tsx          (MODIFY — add sidebar panel + wiring)
    └── findings-sidebar-panel.tsx     (NEW component)
```

### Pattern 1: Handler Delegate File
**What:** Thin wrapper that receives `ValidatedContext` from generated OpenAPI validator and delegates to business logic file.
**When to use:** All ImagingFindings_* handler files.
**Example:**
```typescript
// Source: services/api-ts/src/handlers/dental-imaging/ImagingMgmt_createMeasurement.ts
import type { ValidatedContext } from '@/types/app';
import type { ImagingFindings_createFindingBody, ImagingFindings_createFindingParams } from '@/generated/openapi/validators';
import { createFinding } from './createFinding';

export async function ImagingFindings_createFinding(
  ctx: ValidatedContext<ImagingFindings_createFindingBody, never, ImagingFindings_createFindingParams>
): Promise<Response> {
  return createFinding(ctx as any);
}
```

### Pattern 2: Handler Implementation File
**What:** Actual business logic — auth check, repo call, response. Follows `createMeasurement.ts` structure exactly.
**When to use:** `createFinding.ts`, `listFindings.ts`, `updateFinding.ts`, `deleteFinding.ts`.
**Key steps in each handler:**
1. Extract `user` from `ctx.get('user')` — throw `UnauthorizedError` if absent.
2. Extract path params from `ctx.req.param()`.
3. Get `db` from `ctx.get('database')`.
4. Instantiate `ImagingFindingRepository(db)`.
5. Look up the image via `ImagingRepository.findImageById` to resolve `branchId`.
6. Call `assertBranchAccess(db, user.id, study.branchId)`.
7. Execute repo operation, return JSON.

### Pattern 3: Repository Class
**What:** `ImagingFindingRepository` class with constructor `(private readonly db: DatabaseInstance)`.
**When to use:** New `imaging_finding.repo.ts`.
**Methods needed:**
- `createFinding(data)` — insert + returning
- `listFindingsByImage(imageId)` — select where imageId, ordered by createdAt desc
- `findFindingById(id)` — select limit 1
- `updateFinding(id, patch)` — update set + returning
- `deleteFinding(id)` — hard delete (no soft-delete needed — no status='archived' pattern for findings)

**Example:**
```typescript
// Source: services/api-ts/src/handlers/dental-imaging/repos/imaging.repo.ts (pattern)
export class ImagingFindingRepository {
  constructor(private readonly db: DatabaseInstance) {}

  async createFinding(data: Omit<NewImagingFinding, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy' | 'updatedBy'>): Promise<ImagingFinding> {
    const [row] = await this.db.insert(imagingFindings).values(data as NewImagingFinding).returning();
    if (!row) throw new Error('Failed to create imaging finding');
    return row;
  }
}
```

### Pattern 4: TypeSpec Interface Extension
**What:** Append a new `ImagingFindings` interface block inside `DentalImagingModule` namespace.
**When to use:** `dental-imaging.tsp` — add after `PatientImageListing` interface.
**Example:**
```typespec
// Source: specs/api/src/modules/dental-imaging.tsp (pattern from ImagingManagement)
enum ImagingFindingTypeEnum {
  caries, `secondary-caries`, `bone-loss`, `furcation-involvement`,
  `periapical-lesion`, `root-resorption`, calculus, `crown-fracture`,
  `root-fracture`, `impacted-tooth`, `over-eruption`, `open-contact`,
  overhang, `crown-needed`, `implant-needed`,
}

enum ImagingFindingStatusEnum {
  suspected, confirmed, monitoring, resolved,
}

model ImagingFinding {
  id: string;
  imageId: string;
  annotationId: string | null;
  treatmentId: string | null;
  visitId: string;
  patientId: string;
  branchId: string;
  type: ImagingFindingTypeEnum;
  status: ImagingFindingStatusEnum;
  toothNumber: int32 | null;
  surfaces: string[] | null;
  note: string | null;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
  createdBy: string | null;
}

@route("/dental/imaging")
interface ImagingFindings {
  @post
  @route("/images/{imageId}/findings")
  createFinding(@path imageId: string, @body body: CreateFindingBody): ImagingFinding | ErrorResponse;

  @get
  @route("/images/{imageId}/findings")
  listFindings(@path imageId: string): FindingListResponse | ErrorResponse;

  @patch
  @route("/findings/{findingId}")
  updateFinding(@path findingId: string, @body body: UpdateFindingBody): ImagingFinding | ErrorResponse;

  @delete
  @route("/findings/{findingId}")
  deleteFinding(@path findingId: string): void | ErrorResponse;
}
```

**Note:** TypeSpec enum members with hyphens need backtick quoting (e.g., `` `secondary-caries` ``). Verify this compiles — if TypeSpec doesn't support hyphens in enum identifiers even with backticks, use underscores in the enum but map to hyphen strings in the Postgres enum. [ASSUMED — check TypeSpec compiler behavior]

### Pattern 5: Drizzle Schema for New Table
**What:** New file `imaging_finding.schema.ts` with two `pgEnum` + one `pgTable`.
**When to use:** Step 1 of backend wave (schema before migration).

```typescript
// Source: services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts (pattern)
import { pgTable, uuid, text, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { imagingStudyImages } from './imaging.schema';
import { imagingAnnotations } from './imaging.schema';
// dental_treatment imported from dental-visit

export const imagingFindingTypeEnum = pgEnum('imaging_finding_type', [
  'caries', 'secondary-caries', 'bone-loss', 'furcation-involvement',
  'periapical-lesion', 'root-resorption', 'calculus', 'crown-fracture',
  'root-fracture', 'impacted-tooth', 'over-eruption', 'open-contact',
  'overhang', 'crown-needed', 'implant-needed',
]);

export const imagingFindingStatusEnum = pgEnum('imaging_finding_status', [
  'suspected', 'confirmed', 'monitoring', 'resolved',
]);

export const imagingFindings = pgTable('imaging_finding', {
  ...baseEntityFields,
  imageId: uuid('image_id').notNull().references(() => imagingStudyImages.id),
  annotationId: uuid('annotation_id').references(() => imagingAnnotations.id),
  treatmentId: uuid('treatment_id'),   // no .references() — cross-module FK; enforce at app layer
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  branchId: uuid('branch_id').notNull(),
  type: imagingFindingTypeEnum('type').notNull(),
  status: imagingFindingStatusEnum('status').notNull().default('suspected'),
  toothNumber: integer('tooth_number'),
  surfaces: jsonb('surfaces').$type<string[]>(),
  note: text('note'),
}, (table) => ({
  imageIdx: index('imaging_finding_image_id_idx').on(table.imageId),
  patientIdx: index('imaging_finding_patient_id_idx').on(table.patientId),
}));
```

**Cross-module FK note:** `dental_treatment` lives in `dental-visit` module. Drizzle `.references()` requires importing that table. Two options:
1. Import `dentalTreatments` from `@/handlers/dental-visit/repos/treatment.schema` and use `.references()`.
2. Omit `.references()` for `treatmentId` (just `uuid('treatment_id')`) and document that referential integrity is app-enforced.

Option 2 is safer to avoid circular import risk; existing `visitId` on `imagingStudies` is also a bare uuid without `.references()` — same pattern. [VERIFIED: `imaging.schema.ts` line 59 — `visitId: uuid('visit_id')` has no `.references()`]

### Pattern 6: Frontend Hook
**What:** `use-imaging-findings.ts` — copy of `use-measurements.ts` with findings-specific types.
**When to use:** Consumed by `FindingsSidebarPanel`.

```typescript
// Source: apps/dentalemon/src/features/imaging/hooks/use-measurements.ts (pattern)
export function useImagingFindings(imageId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['imaging-findings', imageId]

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ImagingFinding[]> => {
      const res = await fetch(`/dental/imaging/images/${imageId}/findings`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { items: ImagingFinding[] }
      return data.items
    },
    enabled: Boolean(imageId),
    staleTime: 30_000,
  })
  // createFinding, updateFinding, deleteFinding mutations follow same optimistic pattern
}
```

### Pattern 7: Sidebar Panel Integration in ImagingWorkspace
**What:** Add sidebar state + `FindingsSidebarPanel` to the existing `ImagingWorkspace` component.
**Current structure:** `flex flex-col bg-black` container with toolbar rows + `flex-1` canvas area.
**Change:** Wrap the canvas area in a `flex flex-row` div; sidebar overlays on the right side.

```tsx
// Source: imaging-workspace.tsx — existing canvas section (pattern)
// Change: wrap the existing canvas+SVG block in a flex row
<div style={{ flex: 1 }} className="flex flex-row overflow-hidden">
  {/* Canvas + SVG (existing, takes remaining space) */}
  <div style={{ flex: 1, position: 'relative' }} className="overflow-hidden">
    ...existing canvas and SVG...
  </div>

  {/* Findings sidebar (collapsible) */}
  {findingsPanelOpen && (
    <FindingsSidebarPanel
      imageId={imageId}
      selectedAnnotationId={selectedAnnotationId}
      onClose={() => setFindingsPanelOpen(false)}
    />
  )}
</div>
```

**New state needed in ImagingWorkspace:**
- `findingsPanelOpen: boolean` — toggles sidebar
- `selectedAnnotationId: string | null` — set when annotation SVG element is clicked

**SVG annotation click wiring:** In `handleSvgClick`, add a `'finding'` tool mode that captures a single click and sets `selectedAnnotationId`. Or, add `onClick` directly to `AnnotationShape` elements to open the findings panel pre-filled. The simpler approach: add an `onAnnotationClick` prop to `AnnotationShape` and pass it down from `ImagingWorkspace`.

### Anti-Patterns to Avoid
- **Extending `imaging_finding` status to forward-only:** D3 explicitly allows any→any. Do not copy `TREATMENT_TRANSITIONS` guard from `treatment.schema.ts`.
- **Using `.references()` for `treatmentId` cross-module FK:** Risk of circular import. Use bare `uuid()` column, same as `visitId` in `imagingStudies`.
- **Putting findings logic in `imaging.repo.ts`:** Keep separate file for maintainability and to avoid adding bulk to an already-large repo file.
- **Editing generated files:** Never touch `src/generated/openapi/*`. TypeSpec → codegen → implement.
- **Hardcoding route strings in frontend:** Use the same `fetch('/dental/imaging/images/${imageId}/findings')` pattern as `use-measurements.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Branch access enforcement | Custom auth middleware | `assertBranchAccess(db, userId, branchId)` | Established in every imaging handler — one function covers all cases |
| Optimistic UI for findings mutations | Manual cache updates | TanStack Query `onMutate` pattern from `use-measurements.ts` | Already working with rollback on error |
| Zod validation for finding body | Inline type checks | `z.object({...}).safeParse()` | Used in `createMeasurement.ts` — same pattern |
| DB migration file | Handwritten SQL | `cd services/api-ts && bun run db:generate` | Drizzle generates migration SQL from schema diff |
| TypeScript types from schema | Manual interfaces | Drizzle `$inferSelect` / `$inferInsert` | `ImagingFinding = typeof imagingFindings.$inferSelect` |

**Key insight:** The entire backend pattern (delegate → implementation → repo) is templated by the existing 8 imaging handlers. Zero invention needed — only filling in finding-specific logic.

---

## Common Pitfalls

### Pitfall 1: TypeSpec Hyphen in Enum Values
**What goes wrong:** TypeSpec enum identifiers may not support hyphens (e.g., `secondary-caries`). Compilation fails.
**Why it happens:** TypeSpec uses identifier syntax for enum member names.
**How to avoid:** Use underscores in TypeSpec enum members (`secondary_caries`) but keep Postgres enum values with hyphens if needed — they're string values not identifiers. OR use string-literal union instead of enum in TypeSpec. Check compilation after writing the `.tsp` file before proceeding.
**Warning signs:** `bun run build` in `specs/api/` emits TypeSpec parse error on enum member.

### Pitfall 2: Migration Running Twice
**What goes wrong:** `bun run db:generate` creates a migration, but the server auto-runs migrations on start — if a previous migration already ran, a second run of generate on the same schema state creates a no-op.
**Why it happens:** Drizzle computes diff from `drizzle` metadata table.
**How to avoid:** Run `db:generate` once after schema changes. Commit the generated migration file. Do not manually edit it.

### Pitfall 3: `baseEntityFields` `createdBy`/`updatedBy` are Nullable
**What goes wrong:** Handler tries to insert `createdBy: user.id` (non-null) but schema accepts null. No error — this is fine. The risk is forgetting to set `createdBy` and having null provider records.
**How to avoid:** Always pass `createdBy: user.id` and `updatedBy: user.id` in insert/update data. See `createStudy` handler for the pattern.

### Pitfall 4: Sidebar Panel Breaks Canvas Sizing
**What goes wrong:** The canvas `width = canvas.offsetWidth` is computed on mount. If the sidebar opens/closes after mount, the canvas retains the wrong width.
**Why it happens:** Canvas dimensions captured in `useEffect` with `[imageId, ...]` dependency — doesn't re-fire on layout changes.
**How to avoid:** Either (a) always mount sidebar but use CSS `translate` / `width: 0` to collapse it (avoids layout shift), or (b) add `findingsPanelOpen` to the canvas size `useEffect` dependency array and re-compute `canvas.width`.

### Pitfall 5: Treatment Linkage 404
**What goes wrong:** `updateFinding` with `treatmentId` doesn't verify the treatment exists in the same branch. A bad ID silently stores a dangling FK.
**Why it happens:** No `.references()` on the column; no guard in handler.
**How to avoid:** In `updateFinding`, if `treatmentId` is provided, do a quick `db.select().from(dentalTreatments).where(eq(dentalTreatments.id, treatmentId))` check and throw `NotFoundError` if missing.

---

## Code Examples

### Existing: `assertBranchAccess` usage
```typescript
// Source: services/api-ts/src/handlers/dental-imaging/deleteMeasurement.ts
const annotation = await repo.findAnnotationById(measurementId);
if (!annotation) throw new NotFoundError('Measurement not found');
const image = await repo.findImageById(annotation.imageId);
if (!image) throw new NotFoundError('Parent image not found');
const study = await repo.findStudyById(image.studyId);
if (!study) throw new NotFoundError('Parent imaging study not found');
await assertBranchAccess(db, user.id, study.branchId);
```
For findings: same chain, but start from `findFindingById` → get `finding.imageId` → `findImageById` → `findStudyById` → `assertBranchAccess`.

### Existing: Mock DB for tests
```typescript
// Source: services/api-ts/src/handlers/dental-imaging/imaging.test.ts (lines 127-147)
insert: (_table: any) => ({
  values: (_data: any) => ({
    returning: () => Promise.resolve([study ?? MOCK_STUDY]),
  }),
}),
update: (_table: any) => ({
  set: (_data: any) => ({
    where: (_cond: any) => ({
      then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject),
      returning: () => Promise.resolve([image ?? MOCK_IMAGE]),
    }),
  }),
}),
```
Extend `makeDb` to add `delete` chain and a `finding` mock object for finding-specific tests.

### Existing: TanStack Query optimistic mutation pattern
```typescript
// Source: apps/dentalemon/src/features/imaging/hooks/use-measurements.ts (lines 47-70)
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData<ImagingAnnotation[]>(queryKey)
  // Optimistic update with temp ID
  queryClient.setQueryData(queryKey, (old) => [...(old ?? []), tempItem])
  return { previous }
},
onError: (_err, _input, context) => {
  if (context?.previous !== undefined) {
    queryClient.setQueryData(queryKey, context.previous)
  }
},
onSettled: () => void queryClient.invalidateQueries({ queryKey }),
```

---

## Runtime State Inventory

Not applicable — greenfield table addition, no rename/refactor. No existing runtime state references `imaging_finding`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Build + test | Confirmed (workspace uses it) | 1.0+ | — |
| PostgreSQL | DB migration | Confirmed (existing migrations run) | — | — |
| TypeSpec compiler | `specs/api/` codegen | Confirmed (existing `.tsp` files compiled) | — | — |

Step 2.6: No new external dependencies. All tools confirmed available from v1.3 phase.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (`bun:test`) |
| Config file | None — `bun test` discovers `*.test.ts` |
| Quick run command | `cd /path/to/services/api-ts && bun test src/handlers/dental-imaging/imaging.test.ts` |
| Full suite command | `cd /path/to/services/api-ts && bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CIMG-01 | createFinding returns 201 with finding row | unit | `bun test imaging.test.ts` | ❌ Wave 0 (extend existing) |
| CIMG-02 | createFinding stores imageId, annotationId, visitId, patientId, createdBy | unit | `bun test imaging.test.ts` | ❌ Wave 0 |
| CIMG-03 | updateFinding with any status transition succeeds | unit | `bun test imaging.test.ts` | ❌ Wave 0 |
| CIMG-04 | updateFinding with valid treatmentId stores link; invalid treatmentId → 404 | unit | `bun test imaging.test.ts` | ❌ Wave 0 |
| CIMG-05 | FindingsSidebarPanel renders type chip buttons | unit (frontend) | Playwright E2E | ❌ Wave 0 |
| CIMG-06 | Tooth number input accepts valid range | unit (frontend) | Playwright E2E | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bun test src/handlers/dental-imaging/imaging.test.ts`
- **Per wave merge:** `bun test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Extend `imaging.test.ts` with `MOCK_FINDING` constant and `makeDb` `delete` chain
- [ ] Add `findingId` test constant to existing test file header
- [ ] E2E spec: `apps/dentalemon/tests/e2e/imaging-findings.spec.ts` (referenced in CONTEXT.md)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `user = ctx.get('user')` → throw `UnauthorizedError` if absent — same as all imaging handlers |
| V3 Session Management | no | Session managed by Better-Auth; not handler concern |
| V4 Access Control | yes | `assertBranchAccess(db, user.id, branchId)` — mandatory in every finding handler |
| V5 Input Validation | yes | Zod schema on create/update body; validate `type` against enum, `toothNumber` 1–32, `note` max 500 |
| V6 Cryptography | no | No sensitive field encryption needed for finding metadata |

### Known Threat Patterns for dental imaging stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-patient finding access | Information Disclosure | `branchId` check via `assertBranchAccess`; `patientId` denormalized for query filter |
| Invalid finding type enum value | Tampering | Zod `.enum([...])` on input; Postgres enum constraint as secondary guard |
| Dangling treatmentId FK | Tampering | Explicit existence check in `updateFinding` before storing |
| Unauthenticated finding creation | Elevation of Privilege | `UnauthorizedError` on missing `user` — first check in every handler |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `ImagingMgmt_*` route registration | TypeSpec-generated routes + `ImagingMgmt_*` delegates | v1.3 phase | Must follow TypeSpec-first; no manual route registration |
| `use-measurements.ts` raw fetch + optimistic UI | TanStack Query pattern (established) | v1.3 phase | Copy pattern exactly for `use-imaging-findings.ts` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeSpec enum members with hyphens require backtick quoting (e.g., `` `secondary-caries` ``) | Pattern 4 / Pitfall 1 | TypeSpec compilation fails; must switch to underscore identifiers or string union type |
| A2 | `bun run db:generate` detects new schema files in `repos/` subdirectory without any extra config | Architecture Patterns | Migration not generated; must check if Drizzle config `glob` covers the new file path |

---

## Open Questions (RESOLVED)

1. **TypeSpec hyphen enum identifiers** — RESOLVED: Use underscores. TypeSpec identifiers cannot contain hyphens. `secondary_caries`, `bone_loss`, etc. are used throughout both TypeSpec and Postgres enum. CONTEXT.md D2 updated accordingly.

2. **Drizzle schema discovery scope** — RESOLVED: `drizzle.config.ts` uses glob `'./src/**/*schema.ts'` which matches `handlers/dental-imaging/repos/imaging_finding.schema.ts`. No config change needed.

---

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` — table pattern, baseEntityFields, enum pattern
- `services/api-ts/src/handlers/dental-imaging/repos/imaging.repo.ts` — repository class structure
- `services/api-ts/src/handlers/dental-imaging/createMeasurement.ts` — full handler implementation pattern
- `services/api-ts/src/handlers/dental-imaging/deleteMeasurement.ts` — delete handler pattern
- `services/api-ts/src/handlers/dental-imaging/listMeasurements.ts` — list handler pattern
- `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_createMeasurement.ts` — delegate file pattern
- `services/api-ts/src/handlers/dental-imaging/ImagingMgmt_listMeasurements.ts` — delegate file pattern
- `services/api-ts/src/handlers/dental-imaging/imaging.test.ts` — test harness with `buildApp`, `makeDb`, `MOCK_*` constants
- `specs/api/src/modules/dental-imaging.tsp` — TypeSpec interface structure
- `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts` — FK target + forward-only transition pattern (to NOT copy)
- `services/api-ts/src/core/database.schema.ts` — `baseEntityFields` definition
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — sidebar insertion point, canvas sizing, SVG click handler
- `apps/dentalemon/src/features/imaging/components/annotation-toolbar.tsx` — ToolMode pattern
- `apps/dentalemon/src/features/imaging/hooks/use-measurements.ts` — hook pattern to copy

### Secondary (MEDIUM confidence)
- None needed — all required patterns verified from live codebase.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from live imports
- Architecture: HIGH — all patterns exist in codebase, verified line by line
- Pitfalls: HIGH (A1, A2 are ASSUMED but low risk with early verification)

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (stable — no external dependencies)
