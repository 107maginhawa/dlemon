# Module Experience & Standards Review

> Created 2026-06-02. An **outward-looking** review: benchmarks each module against how leading dental PMS products (Dentrix, Open Dental, Curve, CareStack, tab32) and clinical/legal standards actually work, then maps gaps onto dentalemon's codebase and live app — carousel-forward.

## Why this exists

dentalemon already has deep *inward* quality coverage (OLI: journeys 91% PASS, compliance/HIPAA PASS, spec↔code↔test traceability PASS, boundaries STABLE — see `docs/audits/` and `docs/trace/`). All of it answers "does the code match our own spec?" This review asks the questions OLI does not:

- Are our journeys / business rules / workflows **complete vs. industry + clinical standards**?
- Does the **UX/UI meet best practices** (Nielsen heuristics, WCAG 2.2 AA, dental-charting conventions) — not just "matches DESIGN.md"?
- How do the findings **feed the carousel** (the product's UX differentiator)?

## Method

1. **Targeted research** per module — competitor UX + clinical/legal standards, every claim sourced. Raw research in `research/`.
2. **Live-app audit** — drove the running app via the browser, screenshots in `screenshots/`, heuristic + accessibility checks. Findings in `LIVE_AUDIT_NOTES.md`.
3. **Scorecards** — per module, verifying the research checklist against the actual code. In `modules/`.
4. **Synthesis** — `IMPROVEMENT_BACKLOG.md` (ranked P0–P3) + `CAROUSEL_RECOMMENDATIONS.md`.

## Scorecard structure (each module)

1. What we have · 2. Industry benchmark · 3. Completeness gaps (table) · 4. UX/UI assessment · 5. Findings (P0–P3) · 6. Carousel implications.

Status legend: ✅ implemented · ⚠️ partial · ❌ missing · ❓ unverified.
Severity legend: **P0** broken / standards- or law-violating / blocks a core journey · **P1** material gap vs. industry norm · **P2** notable improvement · **P3** polish.

## Index

**Deep (clinical core):**
- [Visit Workspace + Dental Charting (carousel)](modules/visit-charting-review.md)
- [Periodontal Charting](modules/perio-review.md)
- [Imaging + Cephalometric Analysis](modules/imaging-ceph-review.md)
- [Treatment Planning](modules/treatment-planning-review.md)
- [Clinical Records (Rx · Consent · Lab · Med-Hx · Amendments)](modules/clinical-records-review.md)

**Light (table-stakes pass):**
- [Billing](modules/billing-review.md) · [Scheduling](modules/scheduling-review.md) · [Org/Auth & Staff](modules/org-auth-review.md) · [Patient Management](modules/patient-review.md) · [PMD & Audit](modules/pmd-audit-review.md)

**Synthesis:**
- [Improvement Backlog (ranked P0–P3)](IMPROVEMENT_BACKLOG.md)
- [Carousel Recommendations](CAROUSEL_RECOMMENDATIONS.md)

## Scope & limits

Deep modules verified against code + live app. Light modules benchmarked for table-stakes only. Research is competitor/clinical-standard focused (per scope decision). Market context: the app uses ₱ (Philippines); US-specific insurance mechanics (PPO downgrades, EPCS) are flagged but weighed against market relevance.

## How to refresh

Re-run the research agents (see `research/`), re-drive the live audit (app on `:3003`, API on `:7213`, login `demo@dentalemon.com` / `DemoClinic1!` / PIN `123456`), and re-verify scorecard status against current code.
