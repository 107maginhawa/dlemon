import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  FileText,
  Download,
  Eye,
  Clock,
  Users,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Banknote,
  PiggyBank,
  Target,
  Loader2,
  ExternalLink,
  Shield,
  BarChart3,
  Info
} from 'lucide-react'
import { useEarningsOverview, useEarningsStats } from '@/hooks/use-earnings'
import {
  useMyInvoices,
  useMyMerchantAccountStatus,
  useCreateMyMerchantAccount,
  useGetMyOnboardingUrl,
  useGetMyDashboardLink
} from '@monobase/sdk/react/hooks/use-billing'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monobase/ui/components/table"
import { Progress } from "@monobase/ui/components/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@monobase/ui/components/tooltip"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

export const Route = createFileRoute('/_dashboard/earnings')({
  component: EarningsPage,
})

type EarningsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year'
type TransactionStatus = 'completed' | 'pending' | 'failed' | 'refunded'
type TransactionType = 'consultation' | 'follow-up' | 'prescription' | 'lab-test' | 'report'

type Transaction = {
  id: string
  date: string
  patient: string
  type: TransactionType
  amount: number
  status: TransactionStatus
  paymentMethod: 'card' | 'bank' | 'cash'
  description: string
  consultationDuration?: number
}

function EarningsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<EarningsPeriod>('month')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month')

  // Merchant account setup hooks
  const { account, status, canAccessDashboard, isLoading: accountLoading } = useMyMerchantAccountStatus()
  const createAccountMutation = useCreateMyMerchantAccount()
  const getOnboardingMutation = useGetMyOnboardingUrl()
  const getDashboardLinkMutation = useGetMyDashboardLink()

  // Fetch real earnings data
  const { data: earningsOverview, isLoading: overviewLoading, error: overviewError } = useEarningsOverview()
  const { data: earningsStats, isLoading: statsLoading } = useEarningsStats(chartPeriod)
  const { data: invoicesData, isLoading: invoicesLoading } = useMyInvoices({ limit: 100 })

  const isLoading = overviewLoading || invoicesLoading || accountLoading || statsLoading

  // Transform invoices to transactions
  const transactions: Transaction[] = useMemo(() => {
    if (!invoicesData?.items) return []

    return invoicesData.items.map((invoice: Invoice) => ({
      id: invoice.id,
      date: invoice.paidAt || invoice.createdAt,
      patient: 'Patient', // Would need customer expansion
      type: 'consultation' as TransactionType,
      amount: invoice.total / 100,
      status: invoice.status === 'paid' ? 'completed' as TransactionStatus :
              invoice.status === 'open' ? 'pending' as TransactionStatus :
              'failed' as TransactionStatus,
      paymentMethod: 'card' as const,
      description: `Invoice ${invoice.invoiceNumber}`,
    }))
  }, [invoicesData])

  const currentData = earningsOverview?.[selectedPeriod] || { earnings: 0, consultations: 0, change: 0 }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesStatus = selectedStatus === 'all' || transaction.status === selectedStatus
      const matchesType = selectedType === 'all' || transaction.type === selectedType
      return matchesStatus && matchesType
    })
  }, [transactions, selectedStatus, selectedType])

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!earningsStats?.periods) return []

    return earningsStats.periods.map((period) => {
      const date = new Date(period.period)
      const label = chartPeriod === 'week'
        ? format(date, 'EEE')
        : chartPeriod === 'month'
        ? format(date, 'MMM d')
        : chartPeriod === 'quarter'
        ? format(date, 'MMM')
        : format(date, 'MMM yyyy')

      return {
        period: label,
        earnings: period.earnings,
        consultations: period.consultations,
        average: period.averagePerConsultation,
        growth: period.growth
      }
    })
  }, [earningsStats, chartPeriod])

  // Revenue breakdown for pie chart
  const revenueBreakdown = useMemo(() => {
    if (!earningsStats) return []

    const total = earningsStats.totalEarnings
    if (total === 0) return []

    // Mock breakdown by service type - in real app would come from API
    return [
      { name: 'Consultations', value: total * 0.6, color: '#3b82f6' },
      { name: 'Follow-ups', value: total * 0.2, color: '#10b981' },
      { name: 'Reports', value: total * 0.12, color: '#f59e0b' },
      { name: 'Other', value: total * 0.08, color: '#8b5cf6' },
    ]
  }, [earningsStats])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading earnings...</p>
      </div>
    )
  }

  // Error state
  if (overviewError) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold">Failed to load earnings</p>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {overviewError instanceof Error ? overviewError.message : 'Unknown error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="text-green-700 bg-green-100">Completed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">Pending</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'refunded':
        return <Badge variant="outline">Refunded</Badge>
    }
  }

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'refunded':
        return <RefreshCw className="h-4 w-4 text-gray-600" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return format(date, 'MMM d, yyyy')
  }

  const formatDateTime = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return format(date, 'MMM d, yyyy h:mm a')
  }

  const handleCreateAccount = () => {
    const refreshUrl = `${window.location.origin}/dashboard/earnings`
    const returnUrl = `${window.location.origin}/dashboard/earnings?setup=complete`

    createAccountMutation.mutate({
      refreshUrl,
      returnUrl,
    })
  }

  const handleContinueOnboarding = () => {
    if (!account) return

    const refreshUrl = `${window.location.origin}/dashboard/earnings`
    const returnUrl = `${window.location.origin}/dashboard/earnings?setup=complete`

    getOnboardingMutation.mutate({
      merchantAccountId: account.id,
      refreshUrl,
      returnUrl,
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings & Payouts</h1>
          <p className="text-muted-foreground">
            Track your revenue and manage payouts
          </p>
        </div>
        <div className="flex gap-2">
          {status === 'complete' && canAccessDashboard && (
            <Button
              variant="default"
              onClick={() => getDashboardLinkMutation.mutate(account!.id)}
              disabled={getDashboardLinkMutation.isPending}
            >
              {getDashboardLinkMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Stripe Dashboard
            </Button>
          )}
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Tax Documents
          </Button>
        </div>
      </div>

      {/* Merchant Account Setup States */}
      {status === 'none' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                  <h3 className="text-xl font-semibold text-blue-900">Set Up Payments</h3>
                </div>
                <p className="text-blue-800 mb-4">
                  Connect your Stripe account to start receiving payments for consultations.
                </p>
                <div className="space-y-2 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Secure setup via Stripe Connect</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    <span>Direct deposits to your bank account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Track earnings in real-time</span>
                  </div>
                </div>
              </div>
              <div>
                <Button
                  size="lg"
                  onClick={handleCreateAccount}
                  disabled={createAccountMutation.isPending}
                >
                  {createAccountMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Set Up Payments
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'incomplete' && account && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                  <h3 className="text-xl font-semibold text-yellow-900">Complete Stripe Setup</h3>
                </div>
                <p className="text-yellow-800">
                  Finish your Stripe account setup to start accepting payments.
                </p>
              </div>
              <div>
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleContinueOnboarding}
                  disabled={getOnboardingMutation.isPending}
                >
                  {getOnboardingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Complete Setup
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'complete' && account && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-900">Stripe Account Active</p>
                <p className="text-sm text-green-700">
                  Your account is set up and ready to receive payments
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'quarter', 'year'] as EarningsPeriod[]).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="capitalize"
              >
                {period === 'today' ? 'Today' : `This ${period}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Earnings Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedPeriod === 'today' ? 'Today' : `This ${selectedPeriod}`} Earnings
                </p>
                <p className="text-3xl font-bold">{formatCurrency(currentData.earnings)}</p>
                <div className="flex items-center gap-1 mt-1">
                  {currentData.change > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${
                    currentData.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Math.abs(currentData.change)}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs last {selectedPeriod}</span>
                </div>
              </div>
              <DollarSign className="h-12 w-12 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consultations</p>
                <p className="text-3xl font-bold">{currentData.consultations}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Avg: {formatCurrency(currentData.consultations > 0 ? currentData.earnings / currentData.consultations : 0)}
                </p>
              </div>
              <Users className="h-12 w-12 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Fee</p>
                <p className="text-3xl font-bold">{formatCurrency(currentData.earnings * 0.08)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  8% of gross earnings
                </p>
              </div>
              <Percent className="h-12 w-12 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Earnings</p>
                <p className="text-3xl font-bold">{formatCurrency(currentData.earnings * 0.92)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  After platform fees
                </p>
              </div>
              <PiggyBank className="h-12 w-12 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue Trend</CardTitle>
                  <CardDescription>Your earnings over time</CardDescription>
                </div>
                <Select value={chartPeriod} onValueChange={(value: any) => setChartPeriod(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last Week</SelectItem>
                    <SelectItem value="month">Last Month</SelectItem>
                    <SelectItem value="quarter">Last Quarter</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <RechartsTooltip
                    formatter={(value: any) => formatCurrency(value)}
                    labelFormatter={(label) => `Period: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Service</CardTitle>
                <CardDescription>Breakdown of earnings by service type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {revenueBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 space-y-2">
                  {revenueBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {earningsStats && (
                  <>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Monthly Goal Progress</span>
                        <span>{formatCurrency(earningsStats.totalEarnings)} / {formatCurrency(20000)}</span>
                      </div>
                      <Progress value={(earningsStats.totalEarnings / 20000) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round((earningsStats.totalEarnings / 20000) * 100)}% of monthly goal
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Consultation Target</span>
                        <span>{earningsStats.totalConsultations} / 200</span>
                      </div>
                      <Progress value={(earningsStats.totalConsultations / 200) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {Math.round((earningsStats.totalConsultations / 200) * 100)}% of target
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Average Per Consultation</span>
                        <span>{formatCurrency(earningsStats.averagePerConsultation)}</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Above average rate
                      </p>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform Fees (8%)</span>
                        <span className="text-orange-600">-{formatCurrency(earningsStats.platformFees)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="font-medium">Net Earnings</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(earningsStats.netEarnings)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Transaction Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex gap-4 flex-1">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="prescription">Treatment</SelectItem>
                      <SelectItem value="lab-test">Lab Test</SelectItem>
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

          {/* Transactions Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2" />
                          <p>No transactions found</p>
                          <p className="text-sm">Transactions will appear here once you start earning</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDate(transaction.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{transaction.patient}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-48">
                              {transaction.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {transaction.type === 'follow-up' ? 'Follow-up' :
                               transaction.type === 'lab-test' ? 'Lab Test' : transaction.type}
                            </Badge>
                            {transaction.consultationDuration && (
                              <span className="text-xs text-muted-foreground">
                                {transaction.consultationDuration}min
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(transaction.status)}
                            {getStatusBadge(transaction.status)}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            {transaction.paymentMethod}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {/* Consultation Volume Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Consultation Volume</CardTitle>
              <CardDescription>Number of consultations over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="consultations" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Growth Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Growth Trend</CardTitle>
              <CardDescription>Period-over-period growth percentage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip formatter={(value: any) => `${value}%`} />
                  <Line type="monotone" dataKey="growth" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Growing Revenue</p>
                    <p className="text-sm text-muted-foreground">
                      Your earnings are trending upward with consistent growth
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Goal Progress</p>
                    <p className="text-sm text-muted-foreground">
                      You're on track to meet your monthly earnings target
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Opportunity</p>
                    <p className="text-sm text-muted-foreground">
                      Consider adding weekend availability to increase earnings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-4">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">Payout Management</p>
                  <p className="text-sm text-blue-700 mt-1">
                    View and manage your payout schedules, banking details, and transaction history in your Stripe merchant dashboard.
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    Payouts are automatically processed according to your configured schedule (daily, weekly, or monthly).
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => account && getDashboardLinkMutation.mutate(account.id)}
                    disabled={!account || getDashboardLinkMutation.isPending}
                  >
                    {getDashboardLinkMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    Open Stripe Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Payouts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payouts</CardTitle>
              <CardDescription>Your recent payout history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Weekly Payout</p>
                      <p className="text-sm text-muted-foreground">Processed on {formatDate(new Date())}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(5420.50)}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium">Pending Payout</p>
                      <p className="text-sm text-muted-foreground">Scheduled for tomorrow</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(1280.00)}</p>
                    <p className="text-xs text-muted-foreground">Processing</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Banking Information */}
          <Card>
            <CardHeader>
              <CardTitle>Banking Information</CardTitle>
              <CardDescription>Your connected bank account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Banknote className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">•••• •••• •••• 1234</p>
                    <p className="text-sm text-muted-foreground">Bank of America</p>
                  </div>
                </div>
                <Badge variant="secondary">Default</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
