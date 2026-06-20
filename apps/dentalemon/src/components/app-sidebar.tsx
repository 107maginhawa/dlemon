import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { type LucideIcon, LogOut } from "lucide-react"
import { useOrgContextStore } from '@/stores/org-context.store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@monobase/ui"
import { Logo } from "@monobase/ui"
import { useSession, useSignOut } from "@monobase/sdk-ts/react/hooks/use-auth"
import { canAccess, type DentalModule, type DentalRole } from '@/lib/rbac'

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  badge?: string | number | null
  /**
   * RBAC module that gates the item's route. When set, the link is only shown
   * if the current role `canAccess` this module — the SAME ACCESS_MATRIX the
   * route's `requireRole(module)` guard uses (single source of truth), so the
   * sidebar never advertises a link the guard would bounce back (J-RBAC-NAV-001).
   * Omit for links every authenticated role may see.
   */
  module?: DentalModule
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Filter nav groups by the current org member role using the RBAC ACCESS_MATRIX.
 *
 * - Items without a `module` are always kept (visible to everyone).
 * - Items with a `module` are kept only when `canAccess(role, module)`.
 * - While the role is still loading (`null`/`undefined`), module-gated items are
 *   hidden so privileged links never flash before access resolves.
 * - Groups left with no visible items are dropped entirely.
 */
export function filterNavGroupsByRole(
  groups: NavGroup[],
  role: DentalRole | null | undefined,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.module == null || (role != null && canAccess(role, item.module)),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

interface AppSidebarProps {
  navGroups: NavGroup[]
  headerTitle: string
  headerSubtitle?: string
}

export function AppSidebar({ navGroups, headerTitle, headerSubtitle }: AppSidebarProps) {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const signOut = useSignOut()

  async function handleSignOut() {
    useOrgContextStore.getState().clearContext()
    await signOut.mutateAsync()
    navigate({ to: '/auth/$authView', params: { authView: 'sign-in' } })
  }

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <Logo variant="horizontal" size="md" alt="Dentalemon" />
        {headerSubtitle && (
          <p className="text-xs text-sidebar-foreground/60">{headerSubtitle}</p>
        )}
      </SidebarHeader>
      <SidebarContent>
        {/* a11y: expose a navigation landmark with an accessible name so screen
            readers can jump to the primary nav (the shadcn Sidebar is a plain div). */}
        <nav aria-label="Main navigation">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link to={item.url}>
                        {item.icon && <item.icon className="w-4 h-4" />}
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto text-xs bg-sidebar-accent text-sidebar-accent-foreground px-1.5 py-0.5 rounded-md">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-sm font-medium">
            {session?.user?.name?.charAt(0)?.toUpperCase() ?? session?.user?.email?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {session?.user?.name ?? 'User'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {session?.user?.email ?? ''}
            </p>
          </div>
          <button
            data-testid="sign-out-btn"
            onClick={handleSignOut}
            disabled={signOut.isPending}
            className="shrink-0 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
