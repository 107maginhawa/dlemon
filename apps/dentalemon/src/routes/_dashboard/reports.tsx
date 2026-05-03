import { createFileRoute } from '@tanstack/react-router'
import { RevenueReport } from '../../features/reports/components/revenue-report'
import { canAccessReports } from '../../utils/rbac'
import type { DentalRole } from '../../utils/rbac'

export const Route = createFileRoute('/_dashboard/reports')({
  component: ReportsPage,
})

function ReportsPage() {
  const role = (localStorage.getItem('currentMemberRole') ?? 'dentist_owner') as DentalRole;
  const branchId = localStorage.getItem('currentBranchId') ?? '';

  if (!canAccessReports(role)) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <RevenueReport branchId={branchId} />
    </div>
  );
}
