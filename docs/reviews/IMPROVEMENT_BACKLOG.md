# Improvement Backlog — Ranked

> 2026-06-02. Every item traces to a module scorecard in `modules/` or `LIVE_AUDIT_NOTES.md`. Ranked by severity, then leverage. No code changes made — this is the decide-what-to-build-next list.
>
> Severity: **P0** broken / standards- or law-violating / blocks a core journey · **P1** material gap vs. industry norm · **P2** notable improvement · **P3** polish / defer.
> Effort: **S** ≤1 day · **M** a few days · **L** 1–2+ weeks. 🎠 = advances the carousel differentiator.

## The one-paragraph story

dentalemon's backends and data models are strong and largely at or above the non-incumbent baseline; the gaps are concentrated in **presentation/UI**, a few **stranded capabilities** (perio has no frontend at all), and the **longitudinal-comparison experience** the carousel is supposed to deliver but doesn't yet. The cheapest, highest-leverage wins are mostly "surface data the backend already produces."

## Quick wins (high value / low effort — do these first)

| ID | Finding | Module | Eff | 🎠 |
|----|---------|--------|-----|----|
| QW-1 | **Surface the allergy warning the Rx backend already returns** (`createPrescription.ts:96` computes `warnings.allergyConflicts`; `rx-sheet.tsx:59-76` discards it). Patient-safety, data already there. | Clinical records | S | |
| QW-2 | **Fix dashboard appointments 400** — `use-dashboard-summary.ts:69-70` sends `date=`; API needs `date_from`/`date_to` (calendar hook already correct). Restores morning briefing. | Scheduling/Dashboard | S | |
| QW-3 | **Seed 4–6 patients with 3–6 longitudinal visits** so the carousel's comparison story is actually visible. Unblocks all carousel evaluation. | Visit/charting | S | 🎠 |
| QW-4 | **Fix currency leaks** — USD strings in a ₱/en-PH app (`treatment-plans-sheet.tsx:93`, others). | Treatment planning | S | |
| QW-5 | **Wire the notation toggle** — settings persists FDI/Universal/Palmer but `dental-chart.tsx` hardcodes FDI. | Visit/charting | S | 🎠 |

## P0 — blockers

| ID | Finding | Module | Type | Eff | Source |
|----|---------|--------|------|-----|--------|
| P0-1 | **Perio has a complete, tested backend but ZERO frontend** — no `features/perio`, no route, no SDK hook. The capability is fully stranded and unreachable. | Perio | Journey/UX | L | `perio-review.md` |

## P1 — material gaps vs. industry/clinical norm

| ID | Finding | Module | Type | Eff | 🎠 | Source |
|----|---------|--------|------|-----|----|--------|
| P1-1 | Allergy conflict computed but UI hides it (see QW-1) | Clinical records | Safety | S | | `clinical-records-review.md` |
| P1-2 | No drug-drug interaction check (only naive substring allergy match) | Clinical records | Safety | M | | `clinical-records-review.md` |
| P1-3 | Consent is title-only — no risks/alternatives/non-treatment content, no informed-refusal path | Clinical records | Legal | M | | `clinical-records-review.md` |
| P1-4 | Medical history lacks ASA classification + periodic re-confirmation prompt | Clinical records | Clinical | M | | `clinical-records-review.md` |
| P1-5 | No CAL — no gingival-margin/CEJ input, so attachment loss can't be computed | Perio | Clinical | M | | `perio-review.md` |
| P1-6 | No 2017 AAP/EFP staging + grading | Perio | Clinical | M | | `perio-review.md` |
| P1-7 | No multi-exam perio comparison | Perio | UX | M | 🎠 | `perio-review.md` |
| P1-8 | Only 2 of ~7 standard ceph analyses (Steiner+Ricketts); Downs/McNamara/Tweed/Jarabak absent | Imaging/ceph | Clinical | M | | `imaging-ceph-review.md` |
| P1-9 | No DICOM ingest (JPEG/PNG/TIFF/BMP only; PixelSpacing never parsed) | Imaging/ceph | Interop | M | | `imaging-ceph-review.md` |
| P1-10 | No auto/AI landmarking (fully manual) | Imaging/ceph | Clinical/UX | L | | `imaging-ceph-review.md` |
| P1-11 | Superimposition is side-by-side only — no registration overlay over time | Imaging/ceph | UX | L | 🎠 | `imaging-ceph-review.md` |
| P1-12 | Generic distance tool stays enabled uncalibrated and silently labels in `px` | Imaging/ceph | Safety | S | | `imaging-ceph-review.md` |
| P1-13 | Carousel undemonstrable — single-visit seed (see QW-3) | Visit/charting | UX/seed | S | 🎠 | `visit-charting-review.md` |
| P1-14 | No odontogram diff/compare affordance between snapshots | Visit/charting | UX | M | 🎠 | `visit-charting-review.md` |
| P1-15 | Chart layers are mutually-exclusive tabs, not combinable overlays | Visit/charting | UX | M | 🎠 | `visit-charting-review.md` |
| P1-16 | Notation toggle wired-but-dead (see QW-5) | Visit/charting | i18n/UX | S | 🎠 | `visit-charting-review.md` |
| P1-17 | Mixed dentition rendered binary (primary OR permanent), dropping mixed data | Visit/charting | Clinical | M | 🎠 | `visit-charting-review.md` |
| P1-18 | No clinical phasing/priority sequencing in treatment plans | Treatment planning | Clinical | M | | `treatment-planning-review.md` |
| P1-19 | No alternate cases (implant vs bridge, recommended + auto-reject siblings) | Treatment planning | Clinical/UX | M | | `treatment-planning-review.md` |
| P1-20 | No patient-facing case-presentation / accept-reject surface | Treatment planning | Conversion/UX | L | | `treatment-planning-review.md` |
| P1-21 | No plan→appointment scheduling linkage | Treatment planning | Workflow | M | | `treatment-planning-review.md` |
| P1-22 | USD currency leak in ₱ app (see QW-4) | Treatment planning | i18n/bug | S | | `treatment-planning-review.md` |
| P1-23 | Dashboard appointments 400 (see QW-2) | Scheduling | Bug | S | | `scheduling-review.md`, `LIVE_AUDIT_NOTES.md` |
| P1-24 | No automated reminders / recall dispatch (primary no-show lever) | Scheduling | Engagement | L | | `scheduling-review.md` |
| P1-25 | No online / self-service booking | Scheduling | Access | L | | `scheduling-review.md` |
| P1-26 | No insurance revenue cycle — no e-claims/EDI, eligibility, EOB/ERA posting | Billing | Billing | L | | `billing-review.md` |
| P1-27 | No household/guarantor billing model | Patient | Data model | M | | `patient-review.md` |
| P1-28 | Communication consent is a single boolean, not per-channel | Patient | Compliance | S | | `patient-review.md` |

> Market note: several US-specific billing items (PPO write-off automation, LEAT/alternate-benefit downgrades, EPCS) are weighed against the app's ₱/PH market — see scorecards; some are P2/defer rather than P1 in this market.

## P2 — notable improvements

| ID | Finding | Module | Eff |
|----|---------|--------|-----|
| P2-1 | Escape doesn't close sheets + no focus return (WCAG 2.4.3) | Visit/charting (a11y) | S |
| P2-2 | PIN session drops on workspace↔dashboard navigation | Org/auth | M |
| P2-3 | Furcation/suppuration/plaque per-tooth not per-site; calculus & MGJ absent | Perio | M |
| P2-4 | No voice/auto-advance entry against ~500-input full-mouth burden | Perio | L |
| P2-5 | No FMX anatomical mount (flat image list) | Imaging | M |
| P2-6 | Single hardcoded ceph norm population (no ethnicity selector) | Imaging | S |
| P2-7 | CBCT enum present but treated flat (no 3-D handling) | Imaging | L |
| P2-8 | Treatment-plan header FSM lacks `rejected`/`scheduled`; no per-transition status-history table | Treatment planning | M |
| P2-9 | Two parallel plan constructs (Approve vs Accept) unreconciled for users | Treatment planning | M |
| P2-10 | Shallow 106-code CDT catalog, no CDT-year stamp | Treatment planning | M |
| P2-11 | Lab FSM diverged richer than BR-018 spec text — reconcile doc/code | Clinical records | S |
| P2-12 | Lab orders missing shade/material capture + due-date alerting | Clinical records | M |
| P2-13 | Rx missing DEA/NPI/schedule/EPCS fields (US e-prescribing) | Clinical records | M |
| P2-14 | Billing: AR aging buckets, fee-schedule tiers, batch statements, card-on-file | Billing | M |
| P2-15 | Scheduling: waitlist/ASAP fill, confirmed-status lifecycle, drag-reschedule | Scheduling | M |
| P2-16 | Patient: no duplicate-detection (merge exists, detection doesn't) | Patient | M |
| P2-17 | Org/auth: coarse hard-coded roles (no permission grid), no auto-logoff, no provider-credential fields | Org/auth | M |
| P2-18 | PMD: no whole-patient / FHIR continuity-of-care export | PMD/audit | M |

## P3 — polish / deliberate defer

| ID | Finding | Module |
|----|---------|--------|
| P3-1 | Tooth inner `role="img"` may double-announce — verify with screen reader | Visit/charting (a11y) |
| P3-2 | Dev-env console noise (RuntimeConfig fallback, OneSignal init) | Cross-cutting |
| P3-3 | Ceph VTO / growth projection (honestly deferred to v2) | Imaging |
| P3-4 | US insurance machinery (LEAT/alternate-benefit downgrades, payer bundling) — out of PH market | Treatment planning / Billing |
| P3-5 | HIPAA §164.526 amendment-approval workflow is a deliberate 501 stub | Clinical records |

## Recommended sequence

1. **Quick wins (QW-1…5)** — patient-safety + demo-readiness + correctness, all small. Ship together.
2. **Carousel Phase 1–2** (`CAROUSEL_RECOMMENDATIONS.md`) — diff/compare + combinable layers + mixed-dentition rendering. The differentiator.
3. **Perio frontend (P0-1)** + CAL (P1-5) — unstrand a whole module and unlock perio comparison.
4. **Clinical-records safety/legal** (P1-2,3,4) — drug-drug check, real consent content, ASA/re-confirmation.
5. **Treatment-planning depth** (P1-18…21) — phasing, alternates, case presentation, scheduling linkage.
6. **Imaging** (P1-8…12) and **light-pass strategic gaps** (billing revenue cycle, scheduling engagement) as roadmap items.
