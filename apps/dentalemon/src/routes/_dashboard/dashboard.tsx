import { createFileRoute } from '@tanstack/react-router'
import { MorningBriefing } from '../../features/dashboard/components/morning-briefing'

export const Route = createFileRoute('/_dashboard/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  // In a real app, role would come from auth context
  // For now, default to dentist_owner
  const role = 'dentist_owner' as const;
  const branchId = '00000000-0000-4000-8000-000000000001';

  return (
    <div className="p-6">
      <MorningBriefing role={role} branchId={branchId} />
    </div>
  )
}
