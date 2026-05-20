# Phase 10: Comparison + Smoke Test — Discussion Log

**Date:** 2026-05-11
**Phase:** 10-comparison-smoke-test
**Duration:** Single session

---

## Areas Presented

| # | Area | Options | Decision |
|---|------|---------|----------|
| 1 | Comparison pane synchronization | Independent / Synchronized | **Independent** |
| 2 | Image picker UX | Select 2 from list / Compare-with button | **Select 2 from list** |

---

## Area 1: Comparison Pane Synchronization

**Question:** Should the comparison panes have synchronized pan/zoom?

**Options presented:**
- Independent — two ImagingWorkspace instances, each controls own state
- Synchronized — shared offset/scale state, requires lifting out of ImagingWorkspace

**User selected:** Independent (recommended)

**Rationale:** Simpler implementation; reuses ImagingWorkspace as-is with no changes. Synchronized pan/zoom deferred to v1.4+.

---

## Area 2: Image Picker UX

**Question:** How should the dentist pick the two images to compare?

**Options presented:**
- Select 2 from list — checkboxes on PatientImageList + Compare button
- Compare-with button — button on active image opens picker modal

**User selected:** Select 2 from list (recommended)

**Rationale:** No new UI patterns needed; extends existing PatientImageList component. Compare button enabled only when exactly 2 images are checked.

---

## Pre-answered (not discussed)

- **Offline placeholder text:** "Image not available offline" — specified in ROADMAP
- **Smoke test format:** Playwright E2E — consistent with phases 8 + 9 pattern
- **No backend work:** listPatientImages covers both panes; no new endpoints

## Deferred

- Synchronized pan/zoom — useful for tooth alignment, deferred to v1.4+

