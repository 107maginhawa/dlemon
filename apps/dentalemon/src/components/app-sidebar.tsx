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
} from "@/components/sidebar"
import { Logo } from "@/components/logo"
import { useSession, useSignOut } from "@monobase/sdk-ts/react/hooks/use-auth"

export interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  badge?: string | number | null
}

export interface NavGroup {
  label: string
  items: NavItem[]
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
        <Logo variant="horizontal" size="md" />
        {headerSubtitle && (
          <p className="text-xs text-sidebar-foreground/60">{headerSubtitle}</p>
        )}
      </SidebarHeader>
      <SidebarContent>
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
            onClick={handleSignOut}
            disabled={signOut.isPending}
            className="shrink-0 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
