import { createFileRoute } from '@tanstack/react-router'
import { MorningBriefing } from '../../features/dashboard/components/morning-briefing'
import type { DentalRole } from '../../utils/rbac'

export const Route = createFileRoute('/_dashboard/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  // Role and branchId come from localStorage (set during dental onboarding or PIN auth)
  const branchId = localStorage.getItem('currentBranchId') ?? ''
  const role = (localStorage.getItem('currentMemberRole') ?? 'dentist_owner') as DentalRole

  return (
    <div className="p-6">
      <MorningBriefing role={role} branchId={branchId} />
    </div>
  )
}
