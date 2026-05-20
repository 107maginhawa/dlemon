# Phase 11: Structured Imaging Findings - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Dentist documents structured clinical findings (type, status, tooth, surface) on radiographs. Each finding links to: a specific image annotation (visual marker), a visit, and optionally a treatment plan item. Findings follow a status lifecycle: suspected → confirmed → monitoring → resolved.

**In scope (CIMG-01–CIMG-06):**
- New `imaging_finding` table + CRUD API
- Finding status lifecycle workflow
- Links: annotation (nullable FK), visit (from study), treatment plan item (nullable FK)
- Frontend: collapsible findings sidebar panel inside `imaging-workspace.tsx`
- TypeSpec-first: define ops in `dental-imaging.tsp`, generate, then implement

**Out of scope (defer):**
- Cephalometric workspace (Phase 12)
- Bulk finding import / auto-detection (v2 AI)

</domain>

<decisions>
## Implementation Decisions

### D1 — Data Model: New Table
New `imaging_finding` table (NOT extending `imaging_annotation`). Findings are clinically distinct from geometric annotations — they have their own lifecycle and treatment plan links.

Schema:
```typescript
imaging_finding {
  id: uuid (PK)
  ...baseEntityFields
  imageId: uuid → imaging_study_image.id  (NOT NULL)
  annotationId: uuid → imaging_annotation.id  (nullable — visual marker, optional)
  treatmentId: uuid → dental_treatment.id  (nullable — linked plan item, optional)
  visitId: uuid  (NOT NULL, denormalized from study for query efficiency)
  patientId: uuid  (NOT NULL, denormalized)
  branchId: uuid  (NOT NULL, denormalized)
  type: imaging_finding_type enum  (NOT NULL)
  status: imaging_finding_status enum  (NOT NULL, default 'suspected')
  toothNumber: integer  (nullable)
  surfaces: jsonb<string[]>  (nullable)
  note: text  (nullable — free-form observation)
}
```

### D2 — Finding Types Enum (15 types)
Postgres enum `imaging_finding_type` (underscores — TypeSpec identifiers cannot contain hyphens):
```
caries, secondary_caries, bone_loss, furcation_involvement, periapical_lesion,
root_resorption, calculus, crown_fracture, root_fracture, impacted_tooth,
over_eruption, open_contact, overhang, crown_needed, implant_needed
```

### D3 — Finding Status Enum
Postgres enum `imaging_finding_status`:
```
suspected, confirmed, monitoring, resolved
```
All transitions allowed (any → any) — no forward-only enforcement for v1.4 (differs from treatment status).

### D4 — Treatment Plan Linkage: Nullable FK
`imaging_finding.treatmentId` → `dental_treatment.id` (nullable). Single link per finding. Planner should consider a `linkFindingToTreatment` PATCH endpoint for after-the-fact linking.

### D5 — Annotation Linkage: Nullable FK
`imaging_finding.annotationId` → `imaging_annotation.id` (nullable). Finding can exist without a visual marker, but when the dentist draws an annotation and attaches a finding, the ID is stored.

### D6 — Frontend: Sidebar Panel
Collapsible right-side panel added to `imaging-workspace.tsx`. Pattern:
- Image canvas takes full height; sidebar overlays or shifts canvas
- Click on annotation → finding form opens in sidebar pre-filled with annotationId
- Findings list at top, add-finding form at bottom
- Inline status change (chip/badge selector)

### D7 — TypeSpec Operations (new interface `ImagingFindings`)
Minimum ops for CIMG-01–CIMG-06:
```
POST   /dental/imaging/images/{imageId}/findings      createFinding
GET    /dental/imaging/images/{imageId}/findings      listFindings
PATCH  /dental/imaging/findings/{findingId}           updateFinding (status, note, treatmentId)
DELETE /dental/imaging/findings/{findingId}           deleteFinding
```

### D8 — Branch
Create `feat/v1.4-clinical-imaging` from current `feat/v1.3-imaging-workspace`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `imaging_annotation` table — `annotationId` FK target in `imaging.schema.ts`
- `dental_treatment` table — `treatmentId` FK target in `dental-visit/repos/treatment.schema.ts`
- `baseEntityFields` from `@/core/database.schema` — standard id/created_at/updated_at pattern
- `imaging-workspace.tsx` — host component for the sidebar panel
- `annotation-toolbar.tsx` — click events to wire finding creation
- `ImagingMgmt_*` handler pattern — follow for new `ImagingFindings_*` handlers

### Established Patterns
- TypeSpec interface → generate → handler file per op (e.g., `ImagingFindings_createFinding.ts`)
- Handler tests in `imaging.test.ts` using real server (not mocked routes — feedback rule)
- E2E at `apps/dentalemon/tests/e2e/imaging-findings.spec.ts`
- Nullable FK columns: see `visitId` on `imagingStudies` (optional visit link pattern)

</code_context>

<specifics>
## Specific Ideas

- Finding sidebar should show tooth number as FDI or Universal (match existing chart numbering system)
- Note field: single-line text input, max 500 chars
- Findings list should show count badge on sidebar toggle button

</specifics>

<canonical_refs>
## Canonical References

- `services/api-ts/src/handlers/dental-imaging/repos/imaging.schema.ts` — existing imaging tables
- `services/api-ts/src/handlers/dental-visit/repos/treatment.schema.ts` — FK target for treatmentId
- `specs/api/src/modules/dental-imaging.tsp` — TypeSpec source to extend
- `apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx` — sidebar host
- `docs/prd/v3-dentalemon.md` — surface/tooth terminology
- `docs/decisions/ADR-002-concurrent-edit-policy.md` — last-write-wins applies here too

</canonical_refs>
