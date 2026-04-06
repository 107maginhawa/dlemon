import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { compareDesc } from 'date-fns'
import { formatDate } from '@monobase/ui/lib/format-date'
import {
  CreditCard,
  DollarSign,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  Receipt,
  Eye,
  Loader2,
} from 'lucide-react'
import { requireAuth, requireEmailVerified, requirePerson, composeGuards } from '@/utils/guards'
import { useMyInvoices, useInitiatePayment } from '@monobase/sdk/react/hooks/use-billing'
import type { Invoice, InvoiceStatus } from '@monobase/sdk/types'
import { useFormatCurrency } from '@monobase/ui/hooks/use-format-currency'
import { Button } from '@monobase/ui/components/button'
import {
  Card,
  CardContent,
} from '@monobase/ui/components/card'
import { Badge } from '@monobase/ui/components/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@monobase/ui/components/dropdown-menu'

export const Route = createFileRoute('/_dashboard/billing')({
  beforeLoad: composeGuards(requireAuth, requireEmailVerified, requirePerson),
  component: BillingPage,
})

// Helper functions
function getStatusColor(status: InvoiceStatus): 'secondary' | 'outline' | 'destructive' | 'default' {
  switch (status) {
    case 'paid':
      return 'secondary'
    case 'open':
      return 'outline'
    case 'draft':
      return 'outline'
    case 'void':
      return 'default'
    case 'uncollectible':
      return 'destructive'
    default:
      return 'outline'
  }
}

function getStatusIcon(status: InvoiceStatus) {
  switch (status) {
    case 'paid':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'open':
      return <Clock className="h-4 w-4 text-yellow-500" />
    case 'draft':
      return <Clock className="h-4 w-4 text-gray-500" />
    case 'void':
      return <AlertCircle className="h-4 w-4 text-gray-500" />
    case 'uncollectible':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

// formatCurrency function removed - now using useFormatCurrency hook

function getInvoiceDescription(invoice: Invoice): string {
  if (invoice.lineItems.length === 0) {
    return 'No description'
  }
  if (invoice.lineItems.length === 1) {
    return invoice.lineItems[0].description
  }
  return `${invoice.lineItems[0].description} and ${invoice.lineItems.length - 1} more items`
}

function BillingPage() {
  const { profile } = Route.useRouteContext()
  const { formatCurrency } = useFormatCurrency({ symbol: true })

  // Fetch invoices from API
  const { data: invoicesData, isLoading, error } = useMyInvoices({ customer: profile.personId })
  const payInvoiceMutation = useInitiatePayment()

  const invoices = invoicesData?.items || []

  // Calculate account summary from real data
  const outstandingBalance = invoices
    .filter((inv) => inv.status === 'open' || inv.status === 'uncollectible')
    .reduce((sum, inv) => sum + inv.total, 0)

  const lastPaidInvoice = invoices
    .filter((inv) => inv.status === 'paid' && inv.paidAt)
    .sort((a, b) => compareDesc(new Date(a.paidAt!), new Date(b.paidAt!)))[0]

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">Billing & Payments</h1>
          <p className="text-muted-foreground font-body">Manage your medical expenses and payment methods</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">Failed to load billing information</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Summary */}
      {!isLoading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className={outstandingBalance > 0 ? 'border-orange-200' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(outstandingBalance)}</p>
                    <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{invoices.length}</p>
                    <p className="text-xs text-muted-foreground">Total Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    {lastPaidInvoice ? (
                      <>
                        <p className="text-2xl font-bold">{formatCurrency(lastPaidInvoice.total)}</p>
                        <p className="text-xs text-muted-foreground">Last Payment</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(new Date(lastPaidInvoice.paidAt!), { format: 'medium' })}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold">$0.00</p>
                        <p className="text-xs text-muted-foreground">No payments yet</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Invoices List */}
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Invoices</h2>
            </div>

            {invoices.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <Card key={invoice.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <Receipt className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-sm">
                                  {getInvoiceDescription(invoice)}
                                </h4>
                                <Badge variant={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>{formatDate(new Date(invoice.createdAt), { format: 'medium' })}</span>
                                <span>Invoice #{invoice.invoiceNumber}</span>
                                {invoice.paymentDueAt && (
                                  <span>Due: {formatDate(new Date(invoice.paymentDueAt), { format: 'medium' })}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p
                                className={`font-semibold ${invoice.status === 'overdue' ? 'text-red-600' : ''}`}
                              >
                                {formatCurrency(invoice.total)}
                              </p>
                              {getStatusIcon(invoice.status)}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toast.info('Feature coming soon')}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toast.info('Feature coming soon')}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Download Invoice
                                </DropdownMenuItem>
                                {(invoice.status === 'open' || invoice.status === 'uncollectible') && (
                                  <DropdownMenuItem
                                    onClick={() => payInvoiceMutation.mutate({ invoiceId: invoice.id })}
                                    disabled={payInvoiceMutation.isPending}
                                  >
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Pay Now
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}