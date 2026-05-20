import { createFileRoute } from '@tanstack/react-router'
import { StaffList } from '@/features/staff/components/staff-list'
import { StaffAccessDenied } from '@/features/staff/components/staff-list'
import { useOrgContextStore } from '@/stores/org-context.store'
import { requireRole } from '@/utils/guards'

export const Route = createFileRoute('/_dashboard/staff')({
  beforeLoad: requireRole('staff'),
  component: StaffPage,
})

function StaffPage() {
  const branchId = useOrgContextStore((s) => s.branchId) ?? ''
  // FR8.13: Only dentist_owner can access the staff module
  const memberRole = useOrgContextStore((s) => s.role) ?? ''
  if (memberRole && memberRole !== 'dentist_owner') {
    return <StaffAccessDenied />
  }

  return (
    <div className="p-6">
      <StaffList branchId={branchId} />
    </div>
  )
}
