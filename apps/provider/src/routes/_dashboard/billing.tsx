import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import {
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Receipt,
  Building,
  User,
  Shield,
  ExternalLink,
  Eye,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  X
} from 'lucide-react'
import { subDays, format } from 'date-fns'
import { useMyInvoices, useInitiatePayment } from '@monobase/sdk/react/hooks/use-billing'
import type { Invoice } from '@monobase/sdk/services/billing'
import { Button } from "@monobase/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@monobase/ui/components/card"
import { Badge } from "@monobase/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@monobase/ui/components/tabs"
import { Input } from "@monobase/ui/components/input"
import { Label } from "@monobase/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@monobase/ui/components/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@monobase/ui/components/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monobase/ui/components/table"
import { Separator } from "@monobase/ui/components/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@monobase/ui/components/dialog"
import { ScrollArea } from "@monobase/ui/components/scroll-area"
import { Progress } from "@monobase/ui/components/progress"

export const Route = createFileRoute('/_dashboard/billing')({
  component: BillingPage,
})

type InvoiceWithLineItems = Invoice & {
  lineItems?: Array<{
    id: string
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }>
}

function BillingPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithLineItems | null>(null)
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false)

  // Fetch invoices from API
  const { data: invoicesData, isLoading, error, refetch } = useMyInvoices({
    limit: 100,
  })

  const invoices = invoicesData?.items || []

  // Payment mutation
  const initiatePaymentMutation = useInitiatePayment()

  // Calculate account summary from real data
  const accountSummary = useMemo(() => {
    const openInvoices = invoices.filter((inv: Invoice) => inv.status === 'open')
    const paidInvoices = invoices.filter((inv: Invoice) => inv.status === 'paid')
    const overdueInvoices = openInvoices.filter((inv: Invoice) => {
      if (!inv.paymentDueAt) return false
      return new Date(inv.paymentDueAt) < new Date()
    })
    const recentPaidInvoices = paidInvoices
      .filter((inv: Invoice) => inv.paidAt)
      .sort((a: Invoice, b: Invoice) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
    const lastPaidInvoice = recentPaidInvoices[0]

    return {
      outstandingBalance: openInvoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0) / 100,
      pendingCharges: openInvoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0) / 100,
      overdueAmount: overdueInvoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0) / 100,
      lastPayment: lastPaidInvoice
        ? {
            amount: lastPaidInvoice.total / 100,
            date: lastPaidInvoice.paidAt!,
            method: 'Card',
          }
        : null,
      totalPaid: paidInvoices.reduce((sum: number, inv: Invoice) => sum + inv.total, 0) / 100,
      invoiceCount: {
        total: invoices.length,
        open: openInvoices.length,
        paid: paidInvoices.length,
        overdue: overdueInvoices.length,
      }
    }
  }, [invoices])

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices]

    // Filter by period
    if (selectedPeriod !== 'all') {
      const cutoffDate = selectedPeriod === '30days'
        ? subDays(new Date(), 30)
        : selectedPeriod === '90days'
        ? subDays(new Date(), 90)
        : selectedPeriod === '365days'
        ? subDays(new Date(), 365)
        : new Date()

      filtered = filtered.filter(inv => new Date(inv.createdAt) >= cutoffDate)
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.id.toLowerCase().includes(query)
      )
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return filtered
  }, [invoices, selectedPeriod, statusFilter, searchQuery])

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid': return 'secondary'
      case 'open': return 'outline'
      case 'draft': return 'default'
      case 'void': return 'destructive'
      case 'uncollectible': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'open': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'draft': return <FileText className="h-4 w-4 text-gray-500" />
      case 'void': return <X className="h-4 w-4 text-red-500" />
      case 'uncollectible': return <AlertCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const handlePayInvoice = (invoice: Invoice) => {
    const successUrl = `${window.location.origin}/dashboard/billing?payment=success&invoice=${invoice.id}`
    const cancelUrl = `${window.location.origin}/dashboard/billing?payment=cancelled&invoice=${invoice.id}`

    initiatePaymentMutation.mutate({
      invoiceId: invoice.id,
      successUrl,
      cancelUrl,
    })
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'MMM d, yyyy')
  }

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return format(d, 'MMM d, yyyy h:mm a')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading billing information...</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load billing information</p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Invoices</h1>
          <p className="text-muted-foreground">
            Manage your invoices and payment history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Account Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold">
                  ${accountSummary.outstandingBalance.toFixed(2)}
                </p>
                {accountSummary.invoiceCount.open > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {accountSummary.invoiceCount.open} open {accountSummary.invoiceCount.open === 1 ? 'invoice' : 'invoices'}
                  </p>
                )}
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue Amount</p>
                <p className={`text-2xl font-bold ${accountSummary.overdueAmount > 0 ? 'text-red-600' : ''}`}>
                  ${accountSummary.overdueAmount.toFixed(2)}
                </p>
                {accountSummary.invoiceCount.overdue > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {accountSummary.invoiceCount.overdue} overdue
                  </p>
                )}
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ${accountSummary.totalPaid.toFixed(2)}
                </p>
                {accountSummary.invoiceCount.paid > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {accountSummary.invoiceCount.paid} paid
                  </p>
                )}
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Payment</p>
                <p className="text-2xl font-bold">
                  ${accountSummary.lastPayment?.amount?.toFixed(2) || '0.00'}
                </p>
                {accountSummary.lastPayment?.date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(accountSummary.lastPayment.date)}
                  </p>
                )}
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="billing-history">Billing History</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                      <SelectItem value="365days">Last Year</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                      <SelectItem value="uncollectible">Uncollectible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  More Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Your invoices will appear here once generated'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {invoice.id.slice(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                        <TableCell>
                          {invoice.paymentDueAt ? (
                            <div>
                              <p>{formatDate(invoice.paymentDueAt)}</p>
                              {invoice.status === 'open' && new Date(invoice.paymentDueAt) < new Date() && (
                                <p className="text-xs text-red-600">Overdue</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">
                              ${(invoice.total / 100).toFixed(2)}
                            </p>
                            {invoice.tax && invoice.tax > 0 && (
                              <p className="text-xs text-muted-foreground">
                                incl. ${(invoice.tax / 100).toFixed(2)} tax
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(invoice.status)}
                            <Badge variant={getStatusColor(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedInvoice(invoice as InvoiceWithLineItems)
                                  setIsInvoiceDetailsOpen(true)
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              {invoice.status === 'open' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handlePayInvoice(invoice)}
                                    disabled={initiatePaymentMutation.isPending}
                                  >
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Pay Now
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Manage your payment methods and billing preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">•••• •••• •••• 4242</p>
                      <p className="text-sm text-muted-foreground">Expires 12/24</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Default</Badge>
                </div>

                <Button variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing Settings</CardTitle>
              <CardDescription>
                Configure your billing preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-pay Invoices</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically pay invoices when due
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Invoice Delivery</p>
                  <p className="text-sm text-muted-foreground">
                    Receive invoices via email
                  </p>
                </div>
                <Badge variant="secondary">Enabled</Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified before payment is due
                  </p>
                </div>
                <Badge variant="secondary">3 days before</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing History Tab */}
        <TabsContent value="billing-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Complete history of all billing transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {invoices
                    .filter((inv: Invoice) => inv.status === 'paid')
                    .sort((a: Invoice, b: Invoice) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime())
                    .slice(0, 20)
                    .map((invoice: Invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            invoice.status === 'paid' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {invoice.status === 'paid' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Receipt className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              Payment for {invoice.invoiceNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(invoice.paidAt || invoice.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            ${(invoice.total / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Paid</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Details Dialog */}
      <Dialog open={isInvoiceDetailsOpen} onOpenChange={setIsInvoiceDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              Invoice {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Date</p>
                  <p className="font-medium">{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {selectedInvoice.paymentDueAt
                      ? formatDate(selectedInvoice.paymentDueAt)
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedInvoice.status)}
                    <Badge variant={getStatusColor(selectedInvoice.status)}>
                      {selectedInvoice.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">
                    ${(selectedInvoice.total / 100).toFixed(2)} {selectedInvoice.currency.toUpperCase()}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Line Items</h4>
                <div className="space-y-2">
                  {selectedInvoice.lineItems?.map((item, index) => (
                    <div key={item.id || index} className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × ${(item.unitPrice / 100).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">
                        ${(item.amount / 100).toFixed(2)}
                      </p>
                    </div>
                  )) || (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">No line items available</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <p className="text-muted-foreground">Subtotal</p>
                  <p>${(selectedInvoice.subtotal / 100).toFixed(2)}</p>
                </div>
                {selectedInvoice.tax && selectedInvoice.tax > 0 && (
                  <div className="flex justify-between">
                    <p className="text-muted-foreground">Tax</p>
                    <p>${(selectedInvoice.tax / 100).toFixed(2)}</p>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <p className="font-medium">Total</p>
                  <p className="font-medium text-lg">
                    ${(selectedInvoice.total / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              {selectedInvoice.status === 'open' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handlePayInvoice(selectedInvoice)}
                    disabled={initiatePaymentMutation.isPending}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Now
                  </Button>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
