import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { requireAuth } from '@/lib/guards'
import { useOrgContextStore } from '@/stores/org-context.store'
import { loadOrgContext } from '@/lib/load-org-context'
import { pinSession } from '@/lib/pin-session'
import { AppSidebar, filterNavGroupsByRole, type NavGroup } from '@/components/app-sidebar'
import { NotificationBell } from '@/features/notifications/notification-bell'
import { ClinicActivationBanner } from '@/features/org/components/clinic-activation-banner'
import { usePushNotificationRouting } from '@/features/notifications/hooks/use-push-notification-routing'
import type { DentalRole } from '@/lib/rbac'
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger
} from "@monobase/ui"
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

    // CF-37/CF-89 (Slice H): Enforce server-side PIN session — Zustand store is
    // client-only and can be stale or spoofed. The in-memory pinSession is the
    // authoritative source: if no active PIN session exists (or it is locked /
    // expired), redirect to the PIN selection screen to force re-authentication.
    const session = pinSession.getSession()
    const pinExpired = pinSession.isExpired()
    const pinLocked = pinSession.isLocked()
    if (!session || pinExpired || pinLocked) {
      throw redirect({ to: '/auth/pin-select' as any })
    }

    // FR7.5/FR9.8: If no dental org is set up yet, redirect to the setup wizard
    // (unless the user is already on the dental-onboarding route itself)
    const pathname = opts.location?.pathname ?? ''
    if (!pathname.includes('dental-onboarding')) {
      // Always refresh org context from API
      // (e.g. after re-seeding, branch ID changes, or first load after onboarding)
      const branchId = await loadOrgContext()
      if (branchId) return

      // No branch found — redirect to onboarding if store also has nothing
      if (!useOrgContextStore.getState().branchId) {
        throw redirect({ to: '/dental-onboarding' as any })
      }
    }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  // Current org member role drives which nav links are shown. This is the SAME
  // source the route `requireRole(module)` guards read (org-context store), so
  // the sidebar and the route guards stay in lockstep (J-RBAC-NAV-001).
  const role = useOrgContextStore((s) => s.role) as DentalRole | null

  // FIX-002: register the push-notification click → deep-link router once the
  // authenticated shell is mounted (no-op when push is unconfigured).
  usePushNotificationRouting()

  // Each item declares the RBAC `module` that gates its route. `Dashboard` is
  // intentionally ungated — it is the universal redirect fallback every guard
  // bounces to, so it must always be reachable.
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
          module: "patients",
        },
        {
          title: "Calendar",
          url: "/calendar",
          icon: Calendar,
          badge: null,
          module: "calendar",
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
          module: "billing",
        },
        {
          title: "Reports",
          url: "/reports",
          icon: BarChart3,
          badge: null,
          module: "reports",
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
          module: "staff",
        },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          badge: null,
          module: "settings",
        },
      ]
    }
  ]

  const visibleNavGroups = filterNavGroupsByRole(navGroups, role)

  return (
    <SidebarProvider>
      <AppSidebar
        navGroups={visibleNavGroups}
        headerTitle="DENTALEMON"
        headerSubtitle="Dental Practice"
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" data-testid="sidebar-toggle" />
          <div className="ml-auto flex items-center">
            <NotificationBell />
          </div>
        </header>
        <ClinicActivationBanner />
        <main className="flex-1">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
