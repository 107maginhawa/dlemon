# Product

## Register

product

## Users

Dentalemon serves small, independent dental clinics (roughly 1–3 dentists), built local-first and bought once rather than rented. Four people touch it daily:

- **Chairside dentist** — works on iPad at the chair, charting teeth, diagnosing findings, planning and recording treatment, completing visits. Hands may be gloved; attention is on the patient, not the screen.
- **Front desk / receptionist** — books appointments, checks patients in, collects deposits and payments, issues receipts. Fast turnover, interruptions constant.
- **Practice owner / admin** — runs the business: revenue, accounts receivable, clinic settings, staff. Often the same person as the dentist in a tiny clinic.
- **Patient** — limited self-service portal (booking, access).

The job to be done: run a whole dental visit — schedule → chart → treat → bill → reconcile — in one place, without re-keying or jumping tools, and trust every number and clinical state it shows.

## Product Purpose

Dentalemon is the operating surface of a small dental practice. It replaces clunky legacy practice-management software with a calm, touch-first workspace that holds the entire visit lifecycle. Success is three things working together, not one:

1. **Faster, accurate clinical charting** — chart a tooth, plan and record treatment, complete a visit with zero errors.
2. **Getting paid correctly and easily** — estimates → deposits → payments → receipts with no double-charges and no billing confusion.
3. **The whole visit in one workspace** — schedule, chart, treat, bill, and reconcile without leaving the workspace or re-entering data.

It is local-first and owned outright, so it stays reliable for a clinic with flaky internet.

## Brand Personality

Warm, friendly, approachable — without ever feeling unserious about clinical and financial work. The voice is plain-spoken and human: it explains, reassures, and never scolds. Clinic staff are often not tech-savvy and are busy; the product should feel like a calm, competent colleague, not a dense control panel. Warmth lives in the words, the microcopy, and a few human touches — it is layered onto an Apple-clean, clinically precise canvas, never at the cost of legibility or trust.

## Anti-references

- **Clunky legacy dental software** (Dentrix/Eaglesoft era) — cluttered toolbars, tiny gray text, modal hell, Windows-PMS density. The thing we exist to replace.
- **Generic SaaS dashboard** — cookie-cutter card grids, gradient hero-metric tiles, purple-on-white startup template, eyebrows above every section.
- **Cramped data-table spreadsheet** — everything rendered as endless dense tables with no hierarchy and no breathing room.

## Design Principles

1. **The patient data is the hero; the interface recedes.** Color and chrome are earned. Every element starts neutral; brand and emphasis appear only when they carry meaning (active state, primary action, alert).
2. **Warmth through words, precision through layout.** Friendly tone and microcopy ride on a calm, clinical canvas. A warmer feeling never justifies softer hierarchy, lower contrast, or playful clutter.
3. **One workspace, whole visit.** Schedule → chart → treat → bill → reconcile belong together. Minimize context switches and never make staff re-key what the system already knows.
4. **Earn the user's trust on every number.** Money and clinical state must be coherent — summaries match the body they summarize, no double-charges, no payable that can't be paid. A number the user can't trust is worse than no number.
5. **iPad-first, touch-first, interruption-tolerant.** Chairside and front-desk reality: 44px targets, glanceable state, and flows that survive being abandoned mid-step and resumed.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA**: body text ≥4.5:1 contrast, large text ≥3:1, verified — never light gray "for elegance".
- **44px minimum touch targets** everywhere (iPad-first).
- **Color is never the sole signal.** The dental chart and status badges pair color with shape, label, or border (e.g. missing = gray + dashed) so it survives color blindness and grayscale.
- **Respect `prefers-reduced-motion`** — every transition has an instant or crossfade alternative.
- Plain-language copy and clear error messages for non-technical, time-pressured staff.
