# UI Consistency Spec
# Generated: 2026-05-31
# Source: infer-from-code
# spec_sha: pending
# audit_status: DRAFT (P3 cap — unblocks enforcement ui-consistency; human-curate via oli-spec-gate)
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
  spacing: [0, 4, 8, 12, 16, 24, 32, 48, 64]   # [VERIFY: inferred from Tailwind p-/m-/gap- distribution]
  radius: { none: 0, sm: 6, md: 8, lg: 12, full: 9999 }   # base --radius 0.75rem
  typography:
    font: { sans: "-apple-system/SF Pro Text", display: "-apple-system/SF Pro Display" }
    body: text-sm; label: text-xs font-medium; h1: text-2xl; caption: text-xs   # [VERIFY]
  z_index: { base: 0, dropdown: 50, sticky: 10, overlay: 40, modal: 50, popover: 50, toast: 100 }   # [VERIFY: shadcn defaults]

components:
  button:
    size: [default, sm, lg, icon]
    variant: [default, destructive, outline, secondary, ghost, link]
    source: "@monobase/ui button.tsx (cva)"
    forbidden_override_tokens: ["p-*","px-*","py-*","m-*","h-*","w-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist: ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*"]
    "[VERIFY: className-override count=5 of 49 instances]": true
  badge: { variant: [default, secondary, destructive, outline], source: "@monobase/ui badge.tsx (cva)" }
  card: { variant: [default], note: "plain component, no cva — [VERIFY: variants not enforced]" }
  input: { variant: [default], note: "plain component, no cva" }
  dialog: { source: "@monobase/ui dialog.tsx", role: modal }
  icon: { size: [16, 20, 24], note: "lucide; svg auto-sized [&_svg]:size-4 in button" }
  nav: { component_name: SidebarMenu, item_component: SidebarMenuButton, source: "@monobase/ui sidebar.tsx", forbidden_override_tokens: ["p-*","px-*","py-*","gap-*","bg-*","text-*"] }
  menu_item: { component_name: SidebarMenuItem, variant: [default, active], note: "active-state via isActive prop" }

layout:
  primitives:
    page_shell: { component_name: DashboardLayout, note: "_dashboard.tsx; SidebarProvider + AppSidebar + header" }
    workspace_shell: { component_name: WorkspaceLayout, note: "_workspace.tsx; tab-bar replaces sidebar" }
    nav: { component_name: AppSidebar, placement: [side], item_component: SidebarMenuButton }
    grid: { allowed_columns: [1, 2, 3, 4, 6, 12] }   # [VERIFY]
  composition:
    rule: "dashboard routes mount DashboardLayout; clinical routes mount WorkspaceLayout"
    skip_table: { tanstack: ["__root.tsx", "_dashboard.tsx", "_workspace.tsx", "index.tsx"] }

inferred_markers:
  - { section: tokens.spacing, confidence: 0.7, requires_verify: true }
  - { section: components.card.variant, confidence: 0.6, note: "no cva — variant set not enforced", requires_verify: true }
  - { section: components.button, confidence: 0.95, requires_verify: false }
  - { section: tokens.z_index, confidence: 0.5, requires_verify: true }
```

---

## Notes for human curation (oli-spec-gate)

- **Audit-only / DRAFT (P3 cap).** This spec was inferred from existing frontend code (`apps/dentalemon/src` + `@monobase/ui`). It unblocks the enforcement `ui-consistency` sub-check but is NOT authoritative until `[VERIFY]` markers are resolved via `oli-spec-gate`.
- **Authority hierarchy:** Master PRD / Module Spec > ARCHITECTURE.md > existing code patterns > DESIGN.md tokens > this blueprint. Never override upward.
- **High-confidence (no verify):** Button (cva-enforced 6 variants × 4 sizes), Badge (cva 4 variants), color tokens (globals.css), layout shells (DashboardLayout / WorkspaceLayout).
- **Needs verify:** spacing scale (distribution-inferred), z-index map (shadcn defaults assumed), Card/Input variants (plain components, no cva enforcement), typography enum.
- **Source primitives** live in `packages/ui/src/components/` and are re-exported via `@monobase/ui`. App-level overrides should respect `forbidden_override_tokens` per component.
