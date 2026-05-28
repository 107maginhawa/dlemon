import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'
import { loadOrgContext } from '@/utils/load-org-context'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: async (opts) => {
    await requireAuth(opts)
    // Seed org context store from API so workspace can create visits,
    // check branch access, etc.
    await loadOrgContext()
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
