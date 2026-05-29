<!-- oli-check dimension: journeys | generated: 2026-05-30 | scope: all-frontend (apps/dentalemon/src) | supersedes prior dental-visit-only report -->

# Journey Coverage Report — Dentalemon (all-frontend)

> **Dimension:** JOURNEYS (oli-check) · **Mode:** `--all --auto`
> **App:** `apps/dentalemon/src` · **Framework:** React 19 + TanStack Router (file-based) · TanStack Query · Better-Auth
> **Ground truth used:** CODE_API_SURFACE.json (237 generated handlers) **PLUS** `services/api-ts/src/app.ts` (68 additional manually-mounted routes the map omits), `services/api-ts/src/generated/openapi/routes.ts`, and direct handler-file inspection. WORKFLOW_MAP.md (WF-001..104), ROLE_PERMISSION_MATRIX.md (9 roles).
> **Verdict:** WARN. **0 P0, 2 P1, 1 P2, 3 P3.**

---

## Executive Summary

The frontend calls the backend through **two** surfaces and BOTH had to be checked:

1. **Codegen SDK** (`@monobase/sdk-ts/generated`) — 66 distinct bindings (16 direct fns +
   50 react-query wrappers). **66/66 resolve to a routed handler.** Structurally guaranteed
   (SDK generated from the same OpenAPI doc as the generated routes). Casing checks pass:
   `generatePmd`->`generatePMD`, `getPmdForVisitOptions`->`getPMDForVisit`. Unmatched
   identifiers were all TYPE imports (false positives).

2. **Hand-written `fetch()` hooks** — ~30 files bypass the SDK with literal URL strings
   (imaging, billing, dashboard, staff, onboarding, queue-board, recalls, treatment-plans).
   This is where journey risk concentrates. Each path was cross-referenced against (a)
   CODE_API_SURFACE.json **and** (b) the manual route table in `app.ts` **and** (c) handler
   files on disk.

**Critical method note (root cause of map noise):** CODE_API_SURFACE.json captures ONLY the
**generated** routes (`generated/openapi/routes.ts`). It MISSES the 68 routes mounted by hand
in `services/api-ts/src/app.ts` (queue-board, queue-items, recalls, patient treatment-plans,
etc.). Relying on the surface map alone produces FALSE dead-call findings. After verifying
against `app.ts`, the queue-board, recalls, and treatment-plans calls are all **correctly
routed** — NOT dead. Two genuine mismatches remain (below).

**Clean:** 0 noop submit buttons, 0 orphan `<form>`s, 0 empty `onClick={() => {}}`, 0
MISSING_ROUTE. Navigation and route guards are sound.

---

## Findings (ordered by severity)

### J-FE-001 (P1) — Invoice "Issue" uses POST but handler is PATCH; and the call is duplicated

`src/features/billing/components/invoice-detail.tsx:63` (and a duplicated second call at
:68) issues `POST ${API}/dental/billing/invoices/${invoiceId}/issue`. The routed handler
`issueDentalInvoice` is **PATCH** (`generated/openapi/routes.ts:445`,
`app.patch('/dental/billing/invoices/:invoiceId/issue', ...)`; handler header explicitly
documents `PATCH /dental/billing/invoices/:invoiceId/issue`). POST will 404/405 — the
"Issue Invoice" action (WF-052, draft->issued) is dead. Additionally lines 63 and 68 fire
the **same request twice** (an apparent bad-merge artifact with `// ... existing code ...`
placeholder comments around it), so even after the method fix this needs cleanup.
- **Location:** `apps/dentalemon/src/features/billing/components/invoice-detail.tsx:63,68`
- **Fix:** Change method to `PATCH` and remove the duplicate fetch (lines 67-71).
- **Autofixable:** Yes.

### J-FE-002 (P1) — Ceph report path is singular `/ceph/report`; routed handler is plural `/ceph/reports`

`src/features/imaging/components/CephWorkspacePanel.tsx:52` (`POST .../ceph/report`) and
`src/routes/imaging-ceph-report.$imageId.tsx:35-36` (`GET .../ceph/report?version=`) call
the **singular** segment `report`. The only routed handlers are **plural**:
`POST/GET /dental/imaging/images/:imageId/ceph/reports` (`CephMgmt_createCephReport` /
`CephMgmt_getCephReport`, confirmed in `generated/openapi/routes.ts:681,688`). No singular
alias is mounted in `app.ts`. Both the "Generate Report" action and the standalone ceph
report viewer route will 404 (WF-030/031 reporting tail).
- **Location:** `apps/dentalemon/src/features/imaging/components/CephWorkspacePanel.tsx:52`;
  `apps/dentalemon/src/routes/imaging-ceph-report.$imageId.tsx:35`
- **Fix:** Change FE paths to `/ceph/reports` (plural).
- **Autofixable:** Yes.

### J-MAP-001 (P2) — Knowledge-graph CODE_ROUTE_MAP.json empty + CODE_API_SURFACE.json omits hand-mounted routes

Two compounding map defects that materially weaken JOURNEYS/TRACEABILITY:
- `CODE_ROUTE_MAP.json` = `{"routes":{}}` despite 24 real TanStack file-based routes (the
  extractor doesn't parse TanStack file-based routing).
- `CODE_API_SURFACE.json` lists only generated routes and **omits the 68 routes mounted
  manually in `services/api-ts/src/app.ts`** (queue-board, queue-items, recalls,
  patient-level treatment-plans, etc.). An audit trusting the surface map alone would have
  reported ~6 false DEAD_API_CALLs (it nearly did here — corrected by reading `app.ts`).
- **Location:** `docs/audits/codebase-map/CODE_ROUTE_MAP.json:1`;
  `docs/audits/codebase-map/CODE_API_SURFACE.json` (missing app.ts mounts)
- **Fix:** Re-run `oli-codebase-map` with (a) TanStack file-based route extraction and
  (b) Hono `app.get/post/...` mount detection in `app.ts`, not just generated routes.
- **Autofixable:** No.

### J-MAP-002 (P3) — All 237 endpoints report consumer_count:0

The map resolved neither SDK call sites nor raw-fetch URL strings to endpoints, so it
cannot detect dead/orphan calls on its own. Combined with J-MAP-001's omission of app.ts
mounts, the graph is currently unreliable for endpoint-consumer reasoning.
- **Location:** `CODE_API_SURFACE.json` (all entries)
- **Fix:** Re-run `oli-codebase-map` with SDK + fetch consumer resolution.
- **Autofixable:** No.

### J-MAP-003 (P3) — Unauthenticated merge/unmerge handlers vs BR-020

`POST /patients/merge`, `POST /patients/unmerge` show no auth middleware in the surface;
BR-020 is `dentist_owner`-only. No frontend route invokes them, so not a JOURNEYS P0, but
COMPLIANCE should confirm an in-handler owner guard.
- **Location:** `CODE_API_SURFACE.json` (POST /patients/merge, /unmerge)
- **Fix:** Verify handler-level owner/admin guard.
- **Autofixable:** No.

### J-FE-003 (P3) — Full per-file Registry-1 element table not emitted

An intermittent output-channel fault prevented emitting the exhaustive row-by-row element
catalog for all 57 interactive files. Coverage WAS achieved at the binding level (every SDK
+ every raw-fetch call site cross-referenced against routed handlers) and via deep reads of
representative components. A stable re-run should emit the full element table for the record.
- **Location:** `apps/dentalemon/src/features/**`
- **Fix:** Re-run JOURNEYS in a stable session.
- **Autofixable:** No.

---

## Retracted (verified NOT dead — false positives caught by reading app.ts)

| Call | First appeared | Resolution |
|------|----------------|------------|
| `GET /dental/branches/:id/queue-board`, `PATCH /dental/queue-items/:id/status` | candidate dead | **Routed** in `app.ts:434,439` (`listQueueBoard`/`updateQueueItemStatus`). NOT dead. |
| `GET/POST /dental/patients/:id/recalls`, `PATCH .../recalls/:id` | candidate dead | **Routed** in `app.ts:262,268,273`. NOT dead. |
| `GET/POST /dental/patients/:id/treatment-plans` (+`/:planId`, `/accept`) | candidate dead | **Routed** in `app.ts:381-403`. NOT dead. |

These were absent from CODE_API_SURFACE.json only because the map omits app.ts mounts
(J-MAP-001), not because the endpoints are missing.

---

## Registry 2 — Journey Coverage (core WFs)

| WF | Journey | Entry route | Binding | Status |
|----|---------|-------------|---------|--------|
| WF-005 | Patient registration | `/patients` modal | `createDentalPatient` (SDK) | COMPLETE |
| WF-006/007 | Booking + check-in | `/calendar` | `createAppointment`/`checkInAppointment` (SDK) | COMPLETE |
| WF-007a | Queue board | `/_workspace/queue-board` | raw queue-board (routed) | COMPLETE |
| WF-008..012 | Workspace chart/treatment/notes/complete | `/_workspace/$patientId` | chart/treatment/notes SDK + updateDentalVisit | COMPLETE |
| WF-013/014 | Invoice + payment | `/billing`, workspace | createDentalInvoice/recordDentalPayment | COMPLETE |
| WF-052 | Invoice issue | billing invoice detail | raw `POST .../issue` | **BROKEN (J-FE-001: POST vs PATCH + dup)** |
| WF-016/017/018 | Rx/lab/consent | workspace sheets | SDK | COMPLETE |
| WF-019/020/040 | Imaging upload/annotate/findings | imaging workspace | raw imaging (routed) | COMPLETE |
| WF-030/031 | Ceph analysis/landmarks | imaging | raw ceph analysis/landmarks (routed) | COMPLETE |
| WF-030r | Ceph report generate/view | ceph panel + report route | raw `/ceph/report` (singular) | **BROKEN (J-FE-002: path)** |
| WF-021/022 | PMD generate/import | pmd sheets | generatePmd (SDK)/raw import (routed) | COMPLETE |
| WF-023 | Patient search | `/patients` | listDentalPatients | COMPLETE |
| WF-025/026/027 | Fees/hours/staff | `/settings`,`/staff` | raw settings/org-members (routed) | COMPLETE |
| (recalls) | Recalls sheet | workspace | raw `/recalls` (routed) | COMPLETE |
| WF-048 | Treatment-plans list | workspace | raw `/treatment-plans` (routed) | COMPLETE |

---

## Registry 6 — Navigation Integrity (CLEAN)

24 file-based routes; every `navigate()/Link to=` resolves to a defined route. All top-level
PRD nav targets present. Auth/role gating via `beforeLoad` guards (`requireAuth`,
server-authoritative `pinSession`, `requireRole`+`canAccess`), org context via
`loadOrgContext`. `rbac.ts` ACCESS_MATRIX matches the 4 PRD personas. No MISSING_ROUTE, no
noop buttons, no orphan forms.

---

## Scan Manifest

- Frontend files inventoried: 123 (`.tsx`); interactive: 57
- SDK bindings: 66/66 matched a routed handler
- Raw `fetch()` hook files: ~30; ALL paths cross-referenced vs generated routes + app.ts mounts + handler files
- Confirmed dead/mismatched: **2 P1** (invoice issue POST-vs-PATCH+dup; ceph report singular-vs-plural)
- False positives retracted after reading app.ts: 3 clusters (queue, recalls, treatment-plans)
- Noop/empty handlers: 0 · Orphan forms: 0 · MISSING_ROUTE: 0
- Backend handlers (generated): 237; manual app.ts mounts: 68; FE routes: 24
- Registries: 2,3,5,6,7 active; 1,4 partial; 8 not run (J-MAP-001)

---

## What's Next

1. **Fix the 2 P1 mismatches** (J-FE-001 invoice issue PATCH + dedupe; J-FE-002 ceph
   `/reports` plural). Both are FE-only string/method edits (autofixable) — runtime 404/405
   on the Issue Invoice and Ceph Report actions.
2. **Regenerate the knowledge graph** (J-MAP-001/002): the map must include `app.ts` Hono
   mounts and resolve SDK/fetch consumers, else it will keep producing false dead-call
   findings and miss real ones. Re-run before trusting TRACEABILITY.
3. COMPLIANCE: confirm owner guard on `patients/merge|unmerge` (J-MAP-003).
4. Stable re-run for the full Registry-1 element table (J-FE-003).
