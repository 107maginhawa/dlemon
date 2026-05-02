import { createFileRoute } from '@tanstack/react-router'
import { StaffList } from '@/features/staff/components/staff-list'

export const Route = createFileRoute('/_dashboard/staff')({
  component: StaffPage,
})

function StaffPage() {
  // Placeholder branchId — will be wired to the auth/org context in a future phase
  const branchId = '00000000-0000-4000-8000-000000000001'

  return (
    <div className="p-6">
      <StaffList branchId={branchId} />
    </div>
  )
}
