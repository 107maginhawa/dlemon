import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/utils/guards'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: requireAuth,
  component: WorkspaceLayout,
})

function WorkspaceLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Glass top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
        <span className="text-sm font-semibold">Workspace</span>
      </header>

      {/* Main workspace content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Payment footer is rendered by the child page to access treatments state */}
    </div>
  )
}
