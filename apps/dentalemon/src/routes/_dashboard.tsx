import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'
import { AppSidebar, type NavGroup } from '@/components/app-sidebar'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@/components/sidebar"
import {
  Home,
  Users,
  Calendar,
  Receipt,
  BarChart3,
  UserCog,
  Settings,
} from 'lucide-react'

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: requireAuth,
  component: DashboardLayout,
})

function DashboardLayout() {
  const navGroups: NavGroup[] = [
    {
      label: "Clinical",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: Home,
          badge: null,
        },
        {
          title: "Patients",
          url: "/patients",
          icon: Users,
          badge: null,
        },
        {
          title: "Calendar",
          url: "/calendar",
          icon: Calendar,
          badge: null,
        },
      ]
    },
    {
      label: "Operations",
      items: [
        {
          title: "Billing",
          url: "/billing",
          icon: Receipt,
          badge: null,
        },
        {
          title: "Reports",
          url: "/reports",
          icon: BarChart3,
          badge: null,
        },
      ]
    },
    {
      label: "Admin",
      items: [
        {
          title: "Staff",
          url: "/staff",
          icon: UserCog,
          badge: null,
        },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          badge: null,
        },
      ]
    }
  ]

  return (
    <SidebarProvider>
      <AppSidebar
        navGroups={navGroups}
        headerTitle="DENTALEMON"
        headerSubtitle="Dental Practice"
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
