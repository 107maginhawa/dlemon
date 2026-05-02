/**
 * Billing route -- invoice list with detail sheet and payment plan view
 *
 * State: selectedInvoiceId, detailOpen, planViewOpen, filterStatus
 * Renders BillingList with filter, InvoiceDetail sheet, PaymentPlanView modal
 */

import { createFileRoute } from '@tanstack/react-router'
import React, { useState } from 'react'
import { BillingList } from '../../features/billing/components/billing-list'
import { InvoiceDetail } from '../../features/billing/components/invoice-detail'
import { PaymentPlanView } from '../../features/billing/components/payment-plan-view'

export const Route = createFileRoute('/_dashboard/billing')({
  component: BillingPage,
})

function BillingPage() {
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[17px] font-semibold tracking-tight">Billing</h1>
      </div>

      <BillingList onInvoiceClick={handleInvoiceClick} />

      {selectedInvoiceId && (
        <InvoiceDetail
          invoiceId={selectedInvoiceId}
          open={detailOpen}
          onClose={handleDetailClose}
          onUpdated={() => {
            // Trigger list refresh by closing and reopening
          }}
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
