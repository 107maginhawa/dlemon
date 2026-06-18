import { createFileRoute } from '@tanstack/react-router'
import { MorningBriefing } from '../../features/dashboard/components/morning-briefing'
import type { DentalRole } from '@/lib/rbac'
import { useOrgContextStore } from '@/stores/org-context.store'

export const Route = createFileRoute('/_dashboard/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const branchId = useOrgContextStore((s) => s.branchId) ?? ''
  const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <MorningBriefing role={role} branchId={branchId} />
    </div>
  )
}
