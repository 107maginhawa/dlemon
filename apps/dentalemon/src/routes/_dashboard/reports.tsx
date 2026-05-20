import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RevenueReport } from '../../features/reports/components/revenue-report'
import { TreatmentReport } from '../../features/reports/components/treatment-report'
import { PatientReport } from '../../features/reports/components/patient-report'
import { canAccessReports } from '../../utils/rbac'
import type { DentalRole } from '../../utils/rbac'
import { useOrgContextStore } from '@/stores/org-context.store'
import { requireRole } from '@/utils/guards'

export const Route = createFileRoute('/_dashboard/reports')({
  beforeLoad: requireRole('reports'),
  component: ReportsPage,
})

type ReportTab = 'revenue' | 'treatment' | 'patient'

const TABS: { key: ReportTab; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'patient', label: 'Patient' },
]

function ReportsPage() {
  const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole;
  const branchId = useOrgContextStore((s) => s.branchId) ?? '';
  const [activeTab, setActiveTab] = useState<ReportTab>('revenue');

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
      {/* Tab navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'revenue' && <RevenueReport branchId={branchId} />}
      {activeTab === 'treatment' && <TreatmentReport branchId={branchId} />}
      {activeTab === 'patient' && <PatientReport branchId={branchId} />}
    </div>
  );
}
