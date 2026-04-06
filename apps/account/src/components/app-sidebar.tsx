import * as React from "react"
import { Link } from "@tanstack/react-router"
import { type LucideIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@monobase/ui/components/sidebar"
import { Logo } from "@/components/logo"

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
    </Sidebar>
  )
}
