import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'
import { apiBaseUrl } from '@/utils/config'
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
  beforeLoad: async (opts) => {
    // Require authentication first
    await requireAuth(opts)

    // FR7.5/FR9.8: If no dental org is set up yet, redirect to the setup wizard
    // (unless the user is already on the dental-onboarding route itself)
    const pathname = opts.location?.pathname ?? ''
    if (!pathname.includes('dental-onboarding')) {
      const currentBranchId = typeof localStorage !== 'undefined'
        ? localStorage.getItem('currentBranchId')
        : null
      if (!currentBranchId) {
        // Try to auto-detect org/branch from API (e.g. seeded via script)
        try {
          const res = await fetch(`${apiBaseUrl}/dental/org/context`, {
            credentials: 'include',
          })
          if (res.ok) {
            const ctx = await res.json() as any
            if (ctx.branch?.id) {
              localStorage.setItem('currentBranchId', ctx.branch.id)
              if (ctx.org?.id) localStorage.setItem('currentOrgId', ctx.org.id)
              if (ctx.member?.role) localStorage.setItem('currentMemberRole', ctx.member.role)
              // Context found — continue to dashboard instead of redirecting to onboarding
              return
            }
          }
        } catch {
          // API unreachable — fall through to onboarding
        }
        throw redirect({ to: '/dental-onboarding' as any })
      }
    }
  },
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
