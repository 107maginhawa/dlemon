/**
 * Billing route -- invoice list with detail sheet and payment plan view
 *
 * State: selectedInvoiceId, detailOpen, planViewOpen
 * Renders BillingList with filter, InvoiceDetail sheet, PaymentPlanView modal.
 * InvoiceDetail's "View Payment Plan" button opens PaymentPlanView.
 * onUpdated invalidates the invoices query cache.
 */

import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { requireRole } from '@/lib/guards'
import { useQueryClient } from '@tanstack/react-query'
import { canWriteBilling, type DentalRole } from '@/lib/rbac'
import { useOrgContextStore } from '@/stores/org-context.store'
import { BillingList } from '../../features/billing/components/billing-list'
import { CollectionsView } from '../../features/billing/components/collections-view'
import { ClaimsWorklist } from '../../features/billing/components/claims-worklist'
import { InvoiceDetail } from '../../features/billing/components/invoice-detail'
import { PaymentPlanView } from '../../features/billing/components/payment-plan-view'

export const Route = createFileRoute('/_dashboard/billing')({
  beforeLoad: requireRole('billing'),
  component: BillingPage,
})

type BillingTab = 'invoices' | 'collections' | 'insurance'

function BillingPage() {
  const queryClient = useQueryClient()
  const role = useOrgContextStore((s) => s.role) as DentalRole | null
  const branchId = useOrgContextStore((s) => s.branchId)
  // J-RBAC-001: roles like staff_full / billing_staff reach billing to record
  // payments but must NOT see issue/void actions.
  const canWrite = role ? canWriteBilling(role) : false
  const [tab, setTab] = useState<BillingTab>('invoices')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [planViewOpen, setPlanViewOpen] = useState(false)

  function handleInvoiceClick(invoice: { id: string }) {
    setSelectedInvoiceId(invoice.id)
    setDetailOpen(true)
  }

  function handleDetailClose() {
    setDetailOpen(false)
  }

  function handlePlanClose() {
    setPlanViewOpen(false)
  }

  function handleUpdated() {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[17px] font-semibold tracking-tight">Billing</h1>
        <div
          className="flex items-center gap-0.5 bg-secondary/50 rounded-xl p-0.5"
          role="tablist"
          aria-label="Billing section"
        >
          {(['invoices', 'collections', 'insurance'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-[44px] flex items-center justify-center px-3.5 rounded-lg text-[13px] font-medium tracking-tight transition-colors ${
                tab === t
                  ? 'bg-background shadow-sm font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'invoices' ? 'Invoices' : t === 'collections' ? 'Collections' : 'Insurance'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'invoices' ? (
        <BillingList branchId={branchId ?? undefined} onInvoiceClick={handleInvoiceClick} />
      ) : tab === 'collections' ? (
        <CollectionsView branchId={branchId} />
      ) : (
        <ClaimsWorklist branchId={branchId} canWrite={canWrite} />
      )}

      {selectedInvoiceId && (
        <InvoiceDetail
          invoiceId={selectedInvoiceId}
          open={detailOpen}
          onClose={handleDetailClose}
          onUpdated={handleUpdated}
          onViewPlan={() => setPlanViewOpen(true)}
          canWrite={canWrite}
        />
      )}

      {selectedInvoiceId && (
        <PaymentPlanView
          invoiceId={selectedInvoiceId}
          open={planViewOpen}
          onClose={handlePlanClose}
        />
      )}
    </div>
  )
}
