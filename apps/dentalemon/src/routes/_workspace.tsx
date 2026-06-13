import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { requireAuth } from '@/lib/guards'
import { loadOrgContext } from '@/lib/load-org-context'
import { pinSession } from '@/lib/pin-session'
import { PushOptInPrompt } from '@/features/notifications/push-opt-in-prompt'

export const Route = createFileRoute('/_workspace')({
  beforeLoad: async (opts) => {
    await requireAuth(opts)

    // CC-2: Enforce PIN session for the workspace route tree, matching the
    // _dashboard guard. Without this, navigating workspace → dashboard would
    // always redirect to pin-select even with a valid in-memory session, because
    // the workspace could be reached without PIN auth and the session would never
    // exist. Both route trees now require an active, un-expired, unlocked PIN
    // session so crossing between them within a single browser session is seamless.
    const session = pinSession.getSession()
    const pinExpired = pinSession.isExpired()
    const pinLocked = pinSession.isLocked()
    if (!session || pinExpired || pinLocked) {
      throw redirect({ to: '/auth/pin-select' as any })
    }

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
      {/* FIX-002 (Q2): prompt push opt-in at the first relevant clinical action —
          opening a patient workspace — not on a cold login screen. Renders nothing
          when push is unconfigured or already handled. */}
      <PushOptInPrompt />
    </div>
  )
}
