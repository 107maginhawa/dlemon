# ADR-008: Cross-Visit Chart Layers Are Read-Time Status Overlays (Interim)

**Status**: Accepted
**Date**: 2026-06-10
**Context**: The dental chart is one cumulative odontogram rendered through status-filtered layers — Baseline (existing dentition), Proposed (planned treatment), Completed (performed work), and Declined (refused recommendation). A prior change made Baseline a true living document by carrying the patient's existing dentition forward into each new visit (commit `19926439`). But Proposed and Completed were still effectively per-visit: `completedToothNumbers` was derived from the *current visit's* treatments only, so prior-visit performed work did not show on a later visit's chart, and Proposed was driven by the chart's frozen `entryClassification` rather than the authoritative cumulative treatment list.

Research into Open Dental, Dentrix/Eaglesoft, FHIR R4, and dental-charting convention converged on one model: the three views must be **status filters over one cumulative per-patient record set**. Proposed and Completed are both cumulative-for-patient; performing planned work is a non-destructive status transition (proposed → completed); prior-visit pending work must stay visible.

---

## Decision

**Render the Proposed / Completed / Declined chart layers from CUMULATIVE treatment status computed at READ time, not from per-visit chart classification, and do it without a new endpoint.**

- The patient-level `getTreatmentPlan` aggregate (`GET /dental/patients/:patientId/treatment-plan`) — already fetched on the workspace route and already iterating ALL the patient's visits — is the single cross-visit source. It already returns every pending treatment (`toothNumber`, `status`, `carriedOver`); it was extended with **`completedToothNumbers`** (performed/verified, cumulative). No second endpoint, one cache key, and it inherits the V-VIS-011 patient-branch authorization.
- The FE derives `{ proposed, completed, declined, carriedOver }` tooth-number sets (`deriveChartLayerSets`) and the chart resolves each tooth's layer with precedence **completed > proposed > declined > entryClassification** (`resolveToothLayer`).
- **`entryClassification = 'treatment_plan'` is no longer a chart-native "proposed" source.** Whether a tooth is proposed/completed lives on the treatment record; deriving it from the frozen chart classification resurrected stale red after a treatment was dismissed (two sources of truth disagreeing). Only `condition` (a finding that can exist before any treatment record) remains chart-native.
- **Declined** is shown distinctly via a desaturated-gray diagonal hatch (a stroke/pattern, not a fourth saturated fill; the double-slash stays reserved for extraction) — legible in grayscale (WCAG 1.4.1).
- The **active** chart is cumulative ("Current — all visits"); historical timeline-carousel cards stay per-visit snapshots ("Visit snapshot"). **(Superseded by [ADR-009](./ADR-009-open-visit-scoped-cumulative-and-status-layer-spine.md): "active" here was read as the *centered* card, which mis-attributed today's status to centered historical visits. The cumulative overlay now binds to the genuine OPEN visit by identity, never the centered card.)**

## Consequences / Known limitation (why "interim")

This is a **read-time overlay**: the chart's persisted tooth state (`dental_chart` / baseline) and the treatment records remain two stores reconciled at render time. The durable model — matching Eaglesoft's walkout and FHIR's `Procedure`/`Condition` resolution — is **write-time chart sync**: a treatment status transition mutates the persisted living-document tooth state (e.g. caries → filled when a restoration is performed), making the chart itself the single source of truth and eliminating read-time reconciliation entirely.

We chose the read-time overlay because it is cheap, reversible, and low-lock-in (extending an endpoint we already own rather than building new persistence + a transition trigger + un-perform/correction handling). The deliberate trap avoided: a brand-new `chart-overlay` endpoint + hook would have *entrenched* the dual-source read model and made the eventual write-time migration harder to back out.

**When to revisit**: if chart/treatment divergence causes clinician-visible bugs, or when implementing performed-treatment → tooth-state auto-charting, migrate to write-time sync on the treatment status transition and retire the read-time derivation.
