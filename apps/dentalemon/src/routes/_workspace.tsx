import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'
import { getRuntimeConfig } from '@/utils/config'
import { useOrgContextStore } from '@/stores/org-context.store'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: async (opts) => {
    await requireAuth(opts)

    // Seed org context store from API (same as dashboard layout)
    // so workspace can create visits, check branch access, etc.
    try {
      const { apiUrl } = await getRuntimeConfig()
      const res = await fetch(`${apiUrl}/dental/org/context`, { credentials: 'include' })
      if (res.ok) {
        const ctx = await res.json() as any
        if (ctx.branch?.id) {
          useOrgContextStore.getState().setContext({
            branchId: ctx.branch.id,
            orgId: ctx.org?.id ?? null,
            role: ctx.member?.role ?? null,
            memberId: ctx.member?.id ?? null,
          })
        }
      }
    } catch {
      // API unreachable — proceed with whatever is already in store
    }
  },
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Main workspace content — top bar rendered by child route */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
