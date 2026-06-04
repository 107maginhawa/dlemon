# UI Consistency Spec
# Generated: 2026-05-31
# Verified: 2026-06-02 (F18 — [VERIFY]/[INFERRED] markers resolved against codebase; see per-marker evidence below)
# Source: infer-from-code → code-verified
# spec_sha: pending
# audit_status: REVIEWED-PENDING-SIGNOFF
#   - Verified sections (colors, button, badge, card, input, radius, typography, z_index, grid): code-confirmed; ready for oli-spec-gate human sign-off.
#   - DRAFT remains on: tokens.spacing (annotated — px-list corrected to Tailwind step scale, needs ratify), components.card.variant (no cva — see note).
#   - Final promotion to "enforcing" requires human /oli-spec-gate sign-off.
# app: apps/dentalemon (React 19 + TanStack Router); primitives: @monobase/ui (shadcn+cva)

```yaml
tokens:
  colors:
    primitive:
      neutral: { background: "240 5% 96.9%", card: "0 0% 100%", border: "240 6% 90%", muted-fg: "240 1% 56%", fg: "0 0% 0%" }
      brand: { lemon: "#FFE97D", lemon-hover: "#F5DC60", lemon-foreground: "#4A4018" }
      status: { success: "#34C759", warning: "#FF9500", error: "#FF3B30", info: "#5AC8FA" }
      dental: { healthy: "#dcfce7", caries: "#FF3B30", fractured: "#FF9500", filled: "#5AC8FA", crown: "#FFD60A", missing: "#C7C7CC", implant: "#007AFF", extracted: "#111111", watchlist: "#fef9c3" }
    semantic: { brand: primary, surface: card, text: foreground, border: border, status: { error: destructive, warning: "#FF9500", success: "#34C759", info: "#5AC8FA" } }
  # [VERIFY → ANNOTATED 2026-06-02] The original px list was wrong: the app uses the
  # default Tailwind step scale, not raw px. Verified by usage counts across
  # apps/dentalemon/src/**/*.tsx (p-/px-/py-/m-/gap-): steps 1,2,3,4 dominate
  # (text/cards), then 5,6,8,12, with 16/24 for page gutters. Canonical = Tailwind
  # default scale (step n = n×4px). Recommend ratifying the allowed step set below.
  spacing:
    scale: tailwind-default          # step n = n × 0.25rem (4px)
    common_steps: [0, 1, 2, 3, 4, 5, 6, 8, 12, 16, 24]   # verified by grep distribution
    # observed counts: 2(505) 4(400) 1(363) 3(338) 0(127) 5(74) 6(50) 8(36) 12(10) 16(4) 24(2)
  radius:   # confirmed: globals.css --radius: 0.75rem (12px); button/badge/input use rounded-md, card uses rounded-xl
    base_rem: 0.75              # globals.css L15
    sm: 8    # calc(--radius - 4px) = 8px  (globals.css L127, tailwind rounded-sm)
    md: 10   # calc(--radius - 2px) = 10px (globals.css L128, tailwind rounded-md → button/badge/input)
    lg: 12   # var(--radius) = 12px        (globals.css L129)
    xl: 16   # calc(--radius + 4px) = 16px (globals.css L130, rounded-xl → Card)
    full: 9999
  typography:   # confirmed: tailwind.config fontFamily + grep text-* distribution
    font: { sans: "-apple-system/SF Pro Text", display: "-apple-system/SF Pro Display" }   # tailwind.config.ts L11-14; globals.css L148
    # text-* usage: text-sm(430) text-xs(333) text-2xl(23) text-lg(17) text-base(17) text-xl(15) text-3xl(7)
    body: text-sm; label: text-xs font-medium; h1: text-2xl font-semibold; caption: text-xs   # verified canonical
  # [VERIFY → RESOLVED 2026-06-02] Real z-index usage (grep z-NN in apps/dentalemon/src):
  # z-50(16) z-40(12) z-10(6) z-30(2) z-20(1) — shadcn's higher layers (toast:100) are
  # unused in-app. Canonical map reflects actual usage, not shadcn defaults:
  z_index: { base: 0, sticky: 10, raised: 20, header: 30, overlay_backdrop: 40, modal: 50, dropdown: 50, popover: 50 }

components:
  button:
    size: [default, sm, lg, icon]
    variant: [default, destructive, outline, secondary, ghost, link]
    source: "@monobase/ui button.tsx (cva)"
    forbidden_override_tokens: ["p-*","px-*","py-*","m-*","h-*","w-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist: ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*"]
    # [VERIFY → RESOLVED 2026-06-02] Confirmed cva-enforced in packages/ui/src/components/button.tsx:
    # 6 variants × 4 sizes, defaults {variant:default, size:default}. className is merged via cn()
    # so forbidden_override_tokens are advisory (lint-enforced), not type-blocked. High confidence.
    verified: "button.tsx cva — 6 variants, 4 sizes confirmed"
  badge: { variant: [default, secondary, destructive, outline], source: "@monobase/ui badge.tsx (cva)", verified: "badge.tsx cva — 4 variants confirmed 2026-06-02" }
  # [VERIFY → ANNOTATED 2026-06-02] Card (packages/ui/src/components/card.tsx) is a plain
  # forwardRef div with NO cva — base class "rounded-xl border bg-card text-card-foreground shadow".
  # There is genuinely only ONE visual variant; subparts (CardHeader/Title/Description/Content/Footer)
  # are layout slots, not variants. Recommended canonical: variant:[default] only; if future
  # elevated/outline card variants are wanted they must be added via cva (human ratify). Keeps DRAFT.
  card: { variant: [default], base: "rounded-xl border bg-card text-card-foreground shadow", subparts: [Header, Title, Description, Content, Footer], cva: false, status: DRAFT }
  # [VERIFY → RESOLVED 2026-06-02] Input (input.tsx) plain forwardRef, single style, no cva. Confirmed.
  input: { variant: [default], base: "h-9 rounded-md border border-input bg-transparent text-base md:text-sm", cva: false, verified: true }
  dialog: { source: "@monobase/ui dialog.tsx", role: modal }
  icon: { size: [16, 20, 24], note: "lucide; svg auto-sized [&_svg]:size-4 in button" }
  nav: { component_name: SidebarMenu, item_component: SidebarMenuButton, source: "@monobase/ui sidebar.tsx", forbidden_override_tokens: ["p-*","px-*","py-*","gap-*","bg-*","text-*"] }
  menu_item: { component_name: SidebarMenuItem, variant: [default, active], note: "active-state via isActive prop" }

layout:
  primitives:
    page_shell: { component_name: DashboardLayout, note: "_dashboard.tsx; SidebarProvider + AppSidebar + header" }
    workspace_shell: { component_name: WorkspaceLayout, note: "_workspace.tsx; tab-bar replaces sidebar" }
    nav: { component_name: AppSidebar, placement: [side], item_component: SidebarMenuButton }
    # [VERIFY → RESOLVED 2026-06-02] Real grid-cols usage (grep apps/dentalemon/src):
    # grid-cols-3(11) grid-cols-2(9) grid-cols-1(9) grid-cols-4(3) grid-cols-7(2 — week calendar)
    # grid-cols-16(1 — adult dentition row). Spec's [..6,12] were NOT observed; 7 and 16 ARE used.
    grid: { allowed_columns: [1, 2, 3, 4], domain_specific: { 7: "week calendar", 16: "dentition quadrant row" } }
  composition:
    rule: "dashboard routes mount DashboardLayout; clinical routes mount WorkspaceLayout"
    skip_table: { tanstack: ["__root.tsx", "_dashboard.tsx", "_workspace.tsx", "index.tsx"] }

inferred_markers:
  # Resolved 2026-06-02 (F18). Sections moved from inferred→verified are code-confirmed; two remain DRAFT (annotated).
  - { section: tokens.spacing, confidence: 0.9, status: ANNOTATED-DRAFT, resolution: "px-list corrected to Tailwind step scale; canonical step set proposed (needs ratify)" }
  - { section: components.card.variant, confidence: 0.9, status: ANNOTATED-DRAFT, resolution: "card is plain div, single variant, no cva — confirmed in card.tsx; future variants need cva" }
  - { section: components.button, confidence: 0.98, status: VERIFIED, resolution: "button.tsx cva — 6 variants × 4 sizes confirmed" }
  - { section: tokens.z_index, confidence: 0.95, status: VERIFIED, resolution: "remapped to actual usage (z-50/40/30/20/10); shadcn toast:100 unused" }
  - { section: tokens.radius, confidence: 0.98, status: VERIFIED, resolution: "globals.css --radius 0.75rem + derived sm/md/lg/xl confirmed" }
  - { section: tokens.typography, confidence: 0.95, status: VERIFIED, resolution: "fonts (tailwind.config) + text-* distribution confirmed; body=text-sm, label/caption=text-xs, h1=text-2xl" }
  - { section: components.input, confidence: 0.95, status: VERIFIED, resolution: "input.tsx plain, single style, no cva" }
  - { section: components.badge, confidence: 0.98, status: VERIFIED, resolution: "badge.tsx cva — 4 variants confirmed" }
  - { section: layout.primitives.grid, confidence: 0.9, status: VERIFIED, resolution: "allowed cols [1,2,3,4] + domain 7/16; spec's 6/12 not observed" }
```

---

## Notes for human curation (oli-spec-gate)

- **Status: REVIEWED-PENDING-SIGNOFF (was DRAFT).** All `[VERIFY]`/`[INFERRED]` markers were resolved on 2026-06-02 (F18) against the actual codebase. Most are now `VERIFIED` (code-confirmed); two are `ANNOTATED-DRAFT` (resolved with a recommended canonical value awaiting human ratify). Promotion to **enforcing** still requires a human `/oli-spec-gate` sign-off — but the verification legwork is done, so sign-off should be a quick yes/no.
- **Authority hierarchy:** Master PRD / Module Spec > ARCHITECTURE.md > existing code patterns > DESIGN.md tokens > this blueprint. Never override upward.

### Verified (code-confirmed — ready to ratify as-is)
- **Colors** — `apps/dentalemon/tailwind.config.ts` + `globals.css`. Lemon token confirmed as a first-class Tailwind color: `lemon` { DEFAULT `#FFE97D`, hover `#F5DC60`, foreground `#4A4018`, soft, focus } (tailwind.config L49-55); `primary` maps to `hsl(var(--primary))`. (Aligns with F14's primary/lemon token work — token name in code is `lemon`, not a CSS-var alias.)
- **Button** — `packages/ui/src/components/button.tsx`: cva, 6 variants × 4 sizes. ✅
- **Badge** — `badge.tsx`: cva, 4 variants. ✅
- **Input** — `input.tsx`: plain forwardRef, single style, no cva. ✅
- **Radius** — `globals.css` L15/127-130: `--radius: 0.75rem` (12px) with sm/md/lg/xl derived. Card=`rounded-xl`, button/badge/input=`rounded-md`. ✅
- **Typography** — fonts in `tailwind.config.ts` L11-14; canonical sizes by real distribution: body `text-sm`, label/caption `text-xs`, h1 `text-2xl font-semibold`. ✅
- **z-index** — remapped to *actual* app usage (z-50 modal/dropdown/popover, z-40 backdrop, z-30 header, z-20 raised, z-10 sticky). shadcn `toast:100` is unused in-app. ✅
- **Grid** — allowed columns `[1,2,3,4]` + domain-specific `7` (week calendar) / `16` (dentition row). The blueprint's `6`/`12` were never observed. ✅
- **Layout shells** — `DashboardLayout` (`_dashboard.tsx`) / workspace shell (`_workspace.tsx`). ✅

### Still DRAFT (annotated — needs a human ratify, not more investigation)
- **tokens.spacing** — corrected from a bogus px list to the **Tailwind default step scale**; recommended canonical step set `[0,1,2,3,4,5,6,8,12,16,24]` is backed by usage counts. Ratify the allowed step set (or accept Tailwind default wholesale).
- **components.card.variant** — Card is a plain div with exactly one variant (no cva). Recommended: keep `variant:[default]`; any future elevated/outline variants must be added via cva. Ratify "single-variant is intentional."

- **Source primitives** live in `packages/ui/src/components/` and are re-exported via `@monobase/ui`. App-level overrides should respect `forbidden_override_tokens` per component (lint-enforced advisory; `cn()` merge means they are not type-blocked).
