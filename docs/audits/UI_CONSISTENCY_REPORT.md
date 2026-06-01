# UI Consistency Report — 2026-05-31; re-verified 2026-06-01 (PR #1, HEAD a3bfc9a5)

> **RE-VERIFY @ a3bfc9a5** — `git diff f1b38d8..a3bfc9a5 -- apps/dentalemon/src` = **0 files**. This cycle's commits (V-DG-002 erasure/legal-hold, GAP-001 localId) are backend/spec only. No className, token, z-index, color, icon, or loading-state surface changed. All metrics + findings carry forward identically. Spec sha + tailwind-config hash unchanged → no drift.
> **GENESIS RUN** — first audit against the inferred `UI_CONSISTENCY_SPEC.md` (created 2026-05-31 20:40). No regression possible; run #2 will enable trend tracking.
> **DRAFT-SPEC / AUDIT-ONLY (severity capped at P3).** Spec is `audit_status: DRAFT` with unresolved `[VERIFY]` markers (tokens.spacing, z_index, card/input variants, typography). Per stop_conditions, all findings are advisory until `/oli-spec-gate` curation promotes the spec to enforcing.

**VERDICT: WARN** — 0 P0/P1, draft-mode P3-capped findings only. UI unchanged vs prior run (the error-toast + RBAC commits this cycle touch logic, not tokens/className).

## Adherence (Now — genesis, no prior history)
| Category              | Now   |
|-----------------------|-------|
| Component contracts (Button) | 0.94 (46/49 conformant; 3 className overrides) |
| Spacing scale         | n/a (allow_tailwind_default; spec spacing `[VERIFY]`) |
| Color tokens          | ~0.98 (1 arbitrary `bg-[#FFE97D]` literal — equals brand token, off-class form) |
| z-index scale         | 0.99 (3 arbitrary `z-[N]` page-level) |
| Icon size lock        | 1.00 (lucide auto-sized via `[&_svg]:size-4`) |
| Page-shell coverage   | 1.00 (DashboardLayout/WorkspaceLayout pathless layouts wrap all child routes via `<Outlet/>`) |
| Typography (advisory) | n/a (enum `[VERIFY]`) |
| Loading-state hygiene | OK (registry v5: 0 unpaired suspense ceilings flagged) |

## Findings rollup
| Sev | NEW | KNOWN |
|-----|-----|-------|
| P0  | 0   | 0     |
| P1  | 0   | 0     |
| P2  | 0   | 0     |
| P3  | 0   | 4 (genesis: all KNOWN) |

(All findings P3-capped by DRAFT-spec mode. Underlying severity in parentheses below would apply once spec is curated to enforcing.)

## Top hot files
1. `features/onboarding/components/onboarding-wizard.tsx` — 3 findings
2. `features/scheduling/components/calendar-day.tsx` — 2 findings
3. `features/scheduling/components/calendar-week.tsx` — 1 finding

## Findings (grouped)

### P3 KNOWN — className-override on canonical Button (would-be P2; page-level)
`EU-CLASSNAME-OVERRIDE-onbwiz` — 3 instances in `features/onboarding/components/onboarding-wizard.tsx`:
- L243 `<Button variant="ghost" className="flex-1 h-11 rounded-xl border border-border text-sm ...">` — overrides forbidden `h-*`, `rounded-*`, `border-*`, `text-sm`.
- L246 same pattern ("Skip for now" advance button).
- L248 `<Button variant="ghost" className="... h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm ...">` — overrides `h-*`, `rounded-*`, `bg-*`, `text-*`; re-implements the lemon primary on a ghost variant.
- Fix (human-judgment, NOT auto-fixed): extend Button cva with a `lemon`/`xl` variant, or use `size="lg"` + a declared variant rather than re-styling `ghost`. Pre-existing code (last touched commit `ae0d17da`); not introduced this cycle.

### P3 KNOWN — arbitrary z-index off named scale (would-be P2; page-level)
`EU-ZINDEX-calendar` — `features/scheduling/components/calendar-day.tsx:78 (z-[5])`, `:123 (z-[2])`, `calendar-week.tsx:183 (z-[2])`. Local stacking inside calendar grid; values not in `_spec.tokens.z_index` (base/sticky/overlay/modal/...). Spec z_index is `[VERIFY]` (shadcn-default assumption) so confidence is low. Fix: map to a named layer or add a `grid-event` layer to the spec.

### P3 KNOWN — color literal off-class (would-be P2; page-level)
`EU-COLOR-onbwiz-lemon` — `onboarding-wizard.tsx:248` uses arbitrary `bg-[#FFE97D]`/`text-[#4A4018]`. Value MATCHES the brand `lemon` token but is expressed as an arbitrary hex class instead of the `bg-primary` / cva path. Consolidate to the token class.

### P3 KNOWN — placeholder-string regex hits (FALSE POSITIVE, informational)
`EU-PLACEHOLDER-skipfornow` — "Skip for now" at `onboarding-wizard.tsx:246`, `routes/onboarding.tsx:300`, `features/person/components/address-form.tsx:259`. These are **functional onboarding skip buttons that advance the wizard**, not incomplete-feature markers. Check-13 regex matches the literal but intent is legitimate. No action; suppress via `// oli-ui: placeholder-ok` if noise persists.

## Cross-check vs this cycle's changes
- This cycle's only UI commits — `bc387dd0` (error-toast centralization: hooks + `lib/error-toast.ts`) and `60e7464e` (RBAC: `lib/rbac.ts`, billing gating) — introduce **no** new className overrides, token literals, z-index, or loading-state regressions. `lib/error-toast.ts` is a pure toast helper (no JSX tokens). UI surface is unchanged vs the prior run, as expected for a backend-only (V-DG-001 retention) cycle.

## Spec mutations this PR
- `docs/product/UI_CONSISTENCY_SPEC.md` created 2026-05-31 (inferred-from-code DRAFT). Not laxer-than-baseline gaming; it is the first spec. Promote via `/oli-spec-gate`.

## Exemptions
Active: 0 / cap. Expiring: 0. Expired: 0.

## Recommended next steps
1. `/oli-spec-gate` to resolve `[VERIFY]` markers (spacing, z_index, typography, card/input variants) and flip spec to enforcing — promotes the 3 className-override + zindex + color findings from P3 to their real P2 severity.
2. Refactor `onboarding-wizard.tsx` lemon/ghost buttons onto a declared Button variant.
3. After enforcing-promotion, flip `baseline.ui_consistency.genesis = false` to enable ratchet trend tracking.
