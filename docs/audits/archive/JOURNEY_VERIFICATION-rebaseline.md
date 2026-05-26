# Journey Harness Re-baseline — 2026-05-19 (Post-P1.1–P1.4)

**Branch**: feat/v1.4-clinical-imaging  
**Run at**: 2026-05-19T14:56:57.201Z  
**Seed**: mixed (10 patients, imaging + ceph, addon tier)  
**API**: localhost:7213 (Hono + Drizzle, migrations 0000–0034 applied)

## Context

All P1.1–P1.4 clinical backend slices are committed. This run establishes the
post-P1.x baseline and triages unexpected verdicts.

| Slice | Commit | Journeys targeted |
|-------|--------|-------------------|
| P1.1 signed note + addendum | — | J02, J10 |
| P1.2 treatment-plan versioning | e65b4d0 | J09 |
| P1.3 chart entry-classification | 804330b | J01, J02, J05 |
| P1.4 informed refusal | 361d938 | J08 |

## Summary Table

```
J01  A   BROKEN   BROKEN      New-patient comprehensive oral evaluation
J02  A   BROKEN   BROKEN      Periodic recall exam (D0120)
J03  A   BROKEN   BROKEN      Periodontal charting linked to odontogram
J04  A   BROKEN   BROKEN      Revenue chain (flagship)
J05  A   BROKEN   BROKEN      Status integrity on the odontogram
J06  A   BROKEN   BROKEN      Multi-visit / phased treatment plan sequencing
J07  A   PASS     BROKEN   !  Charting granularity & mixed dentition
J08  A   BROKEN   BROKEN      Informed refusal
J09  A   BROKEN   BROKEN      Treatment-plan versioning
J10  A   BROKEN   BROKEN      Void / amend a signed entry
B01  B   BROKEN   BROKEN      Free-tier ceph gate  [registry fixed this run]
B02  B   PASS     BROKEN   !  Landmark placement -> SNA/SNB numeric
B03  B   PASS     BROKEN   !  Locked landmark immutability
B04  B   PASS     BROKEN   !  Report gate + immutable versioned snapshot
Total 14 | PASS 0 | BROKEN 14 | ERROR 0
```

`!` = unexpected (expectedVerdict != actualVerdict).

## Why J01–J10 remain BROKEN

P1.1–P1.4 added **backend features only** (TypeSpec -> DB migrations -> API handlers +
unit/contract tests). The journey specs exercise the full stack through Playwright.
The frontend UI for each feature was not added in this phase:

- **J01/J05**: No distinct Existing / Existing-Other status controls in tooth slideout
- **J02**: D0120 recall note DB column exists (P1.1) but UI still uses local React state
- **J08**: No decline/refusal control in Treatment Plan tab
- **J09**: No acceptance-capture or version-history control in Treatment Plan tab
- **J10**: No sign/lock button in SOAP notes sheet; addendum control absent

These are **correct BROKEN verdicts**. `expectedVerdict: BROKEN` is the right baseline.
Frontend wiring is Phase 2 work.

## Triage: 5 Unexpected BROKENs

### B01 — Registry stale (RESOLVED)

The spec file (`11-ceph-tier-gate.journey.spec.ts`) was updated to
`expectedVerdict: 'BROKEN'` in commit d2c7095 with note: demo org is PAID tier,
free-tier gate unreachable with current seed. The harness registry
(`run-journey-harness.ts` line 63) was not updated in that commit.

**Fix applied this run**: Registry updated `'PASS' -> 'BROKEN'`.
`journey-results.json` corrected to match. No code regression.

### J07 — Test design bug (OPEN — low priority)

**Failure**: "Independent read shows no persisted MOD surface set (surfacesPicked=3)"

**Root cause**: The independent-read URL in the spec is:
```
GET /dental/patients/{patientId}/chart
```
This endpoint **does not exist**. The API only exposes per-visit charts at
`GET /dental/visits/{visitId}/chart`. The spec falls back to the visits JSON
which does not contain tooth-level surface detail, so `hasMODSurfaces` is always
false.

The previous PASS was coincidental (visits list may have transiently included
chart data, or the endpoint existed at a prior revision).

**Fix needed**: Update J07 spec to read from `/dental/visits/{visitId}/chart`.
Keep `expectedVerdict: 'PASS'` — the underlying feature is implemented; the test
URL is wrong.

### B02 — Ceph math NaN (OPEN — medium priority)

**Failure**: SNA=NaN (exp 82), SNB=NaN (exp 80), ANB=NaN, convexity=NaN

**Root cause**: Landmark placement in the spec uses canvas element clicks. The
click coordinates map to null/zero landmark positions. `calculateCephAnalysis()`
receives undefined x/y and produces NaN for all angular measurements.

**Fix needed**: Replace canvas-click landmark placement with direct API injection
(POST landmarks with correct image-space coordinates). B04 is downstream and will
also fix when B02 is fixed.

### B03 — Locked landmark UI not disabled (OPEN — medium priority)

**Failure**: "Locked landmark S unchanged server-side but UI palette button is NOT
disabled"

**Root cause**: The API correctly returns 409 on mutation of a confirmed landmark.
But the ceph landmark palette component does not read `status: 'confirmed'` from
the GET response to disable the palette button.

**Fix needed**: In the palette component, set `disabled` when
`landmark.status === 'confirmed'`. ~2 lines.

### B04 — Snapshot wrong values (OPEN — downstream of B02)

**Failure**: numericFrozen=false (SNA=78.5 exp 82), byteIdentical=true

**Root cause**: Downstream of B02. Snapshot exists and is frozen (byteIdentical=true)
but was created from canvas-click coordinates, yielding SNA=78.5 instead of 82.
Will self-fix once B02 uses API-injected landmarks and snapshot is re-frozen.

## Infrastructure Fix Applied This Run

Drizzle migration tracking was out of sync: migrations 0029–0034 were applied
to the DB but not recorded in `drizzle."__drizzle_migrations"`. API refused to
start with "column clinical_notes already exists".

Fix: Inserted 6 missing hashes with their exact `folderMillis` timestamps from
`_journal.json`. All schema objects were already present; no DDL was re-run.

## Baseline After This Run

| Journey | expectedVerdict | Status |
|---------|----------------|--------|
| J01–J06, J08–J10 | BROKEN | Correct — no frontend wiring |
| J07 | PASS | Test bug (wrong URL) — open, low |
| B01 | BROKEN | Known seed limitation — acknowledged |
| B02 | PASS | Canvas NaN bug — open, medium |
| B03 | PASS | Palette button not disabled — open, medium |
| B04 | PASS | Downstream of B02 — open, medium |

## Next Steps (ordered)

1. **B03** (~30 min): Disable palette button when `landmark.status === 'confirmed'`
2. **B02 + B04** (~2h): Replace canvas clicks with API-injected landmark coordinates in spec
3. **J07** (~30 min): Fix independent-read URL to `/dental/visits/{visitId}/chart`
4. **Frontend Phase 2**: Wire P1.1–P1.4 backend features to UI (J01/J02/J05/J08/J09/J10)
