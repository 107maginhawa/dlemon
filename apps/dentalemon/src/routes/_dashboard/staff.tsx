import { createFileRoute } from '@tanstack/react-router'
import { StaffList } from '@/features/staff/components/staff-list'
import { StaffAccessDenied } from '@/features/staff/components/staff-list'

export const Route = createFileRoute('/_dashboard/staff')({
  component: StaffPage,
})

function StaffPage() {
  const branchId = localStorage.getItem('currentBranchId') ?? ''
  // FR8.13: Only dentist_owner can access the staff module
  const memberRole = localStorage.getItem('currentMemberRole') ?? ''
  if (memberRole && memberRole !== 'dentist_owner') {
    return <StaffAccessDenied />
  }

  return (
    <div className="p-6">
      <StaffList branchId={branchId} />
    </div>
  )
}
