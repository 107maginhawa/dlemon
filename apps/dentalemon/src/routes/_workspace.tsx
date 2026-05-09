import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: requireAuth,
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
