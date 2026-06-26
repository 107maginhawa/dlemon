# Continuation prompt — Workspace / visit-carousel UX review

> Paste the block below into a fresh session (after `/clear`).

---

Do a dedicated UX/UI expert review of the **patient workspace page** in `apps/dentalemon`
— the signature clinical surface. Route: `src/routes/_workspace/$patientId.tsx`; key
components: `features/workspace/components/timeline-carousel.tsx`,
`dental-chart.tsx` (+ `dental-chart.helpers.ts`), `treatment-table.tsx`.

Recent context: the chart axis/colour refine + status-layer spine just shipped (ADR-009,
`docs/decisions/ADR-009-*`). Design system = Apple HIG + lemon `#FFE97D` accent
(`DESIGN.md`); lemon is reserved for interaction, not status.

**Run a proper design/UX review (use `/plan-design-review` or `/design-review`), then
produce a PRIORITIZED improvement plan — do NOT auto-implement. This is a clinical
surface; I want to approve the plan first.**

Specific concerns to address (from a live chairside walkthrough), plus anything else
the experts surface:

1. **Workflow legibility / next-step guidance.** A dentist can keep clicking teeth to
   diagnose, but "what's next" is scattered (green "Visit in progress" banner, "34
   pending" chip, the Done column). There's no single guide/coach affordance for
   diagnose → plan (`diagnosed`→`planned`) → complete (`planned`→`performed`, a 2-step
   FSM) → finish/discard visit. Evaluate adding an explicit, lightweight next-step or
   help affordance.
2. **Treatment Breakdown gets pushed below the fold.** The disabled "New Visit" ghost
   card sits between the carousel and the breakdown only to say "finish the open visit
   first" — pure vertical cost while a visit is open. The breakdown can scroll off with
   unclear affordance when the list is long. Reclaim vertical space (collapse/relocate
   the New Visit placeholder while a visit is open) and make the breakdown scroll
   obvious.
3. **Scroll/orientation polish.** e.g. a sticky visit DATE at top-center as the user
   scrolls (date is primary orientation). Look for similar low-cost orientation wins.
4. **Anything else** the UX/UI reviewers flag on this page for optimal chairside flow.

Deliverable: a scored design review + a prioritized, plan-only improvement list
(P0/P1/P2 with rationale and rough effort), scoped to the workspace surface.

**Access (full stack already running):** app http://localhost:3003 · API :7213
(`/readyz` 200) · Postgres :5432 · MinIO :9000. Login `demo@dentalemon.com` /
`DemoClinic1!` → profile **Dr. Maria Reyes** → PIN `123456` → Patients → **Juan dela
Cruz** (multi-visit) → Open Workspace. PIN drops on hard refresh — navigate by clicking,
re-PIN if you reload. Use the gstack `/browse` tool, not human-verify checkpoints.
