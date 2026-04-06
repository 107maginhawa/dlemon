import { useMemo } from 'react'
import { useMyInvoices } from '@monobase/sdk/react/hooks/use-billing'
import {
  calculateTotalEarnings,
  calculatePeriodEarnings,
  countInvoicesByStatus,
} from '@monobase/sdk/services/billing'
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns'

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Get merchant invoices (provider earnings)
 * Fetches invoices for the current provider's person (merchant account linked via person)
 *
 * @param params - Optional filter parameters
 * @returns Query result with merchant invoices
 */
// Removed - use useMyInvoices from SDK instead

/**
 * Calculate earnings overview for different time periods
 * Returns earnings stats for today, week, month, quarter, and year
 *
 * @returns Earnings overview with stats for each period
 */
export function useEarningsOverview() {
  const { data: invoicesData, isLoading, error } = useMyInvoices({ limit: 100 })
  const invoices = invoicesData?.items || []

  const overview = useMemo(() => {
    const now = new Date()

    const todayStart = startOfToday()
    const todayEnd = endOfToday()
    const todayEarnings = calculatePeriodEarnings(invoices, todayStart, todayEnd)
    const todayConsultations = invoices.filter((inv) => {
      if (!inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= todayStart && paidDate <= todayEnd
    }).length

    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)
    const weekEarnings = calculatePeriodEarnings(invoices, weekStart, weekEnd)
    const weekConsultations = invoices.filter((inv) => {
      if (!inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= weekStart && paidDate <= weekEnd
    }).length

    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const monthEarnings = calculatePeriodEarnings(invoices, monthStart, monthEnd)
    const monthConsultations = invoices.filter((inv) => {
      if (!inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= monthStart && paidDate <= monthEnd
    }).length

    const quarterStart = startOfQuarter(now)
    const quarterEnd = endOfQuarter(now)
    const quarterEarnings = calculatePeriodEarnings(invoices, quarterStart, quarterEnd)
    const quarterConsultations = invoices.filter((inv) => {
      if (!inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= quarterStart && paidDate <= quarterEnd
    }).length

    const yearStart = startOfYear(now)
    const yearEnd = endOfYear(now)
    const yearEarnings = calculatePeriodEarnings(invoices, yearStart, yearEnd)
    const yearConsultations = invoices.filter((inv) => {
      if (!inv.paidAt) return false
      const paidDate = new Date(inv.paidAt)
      return paidDate >= yearStart && paidDate <= yearEnd
    }).length

    return {
      today: {
        earnings: todayEarnings,
        consultations: todayConsultations,
        change: 0, // Would need historical data to calculate
      },
      week: {
        earnings: weekEarnings,
        consultations: weekConsultations,
        change: 0,
      },
      month: {
        earnings: monthEarnings,
        consultations: monthConsultations,
        change: 0,
      },
      quarter: {
        earnings: quarterEarnings,
        consultations: quarterConsultations,
        change: 0,
      },
      year: {
        earnings: yearEarnings,
        consultations: yearConsultations,
        change: 0,
      },
    }
  }, [invoices])

  return {
    data: overview,
    isLoading,
    error,
  }
}

/**
 * Get earnings statistics
 * Returns aggregated stats about earnings
 *
 * @returns Earnings statistics
 */
export function useEarningsStats() {
  const { data: invoicesData, isLoading, error } = useMyInvoices({ limit: 100 })
  const invoices = invoicesData?.items || []

  const stats = useMemo(() => {
    const totalEarnings = calculateTotalEarnings(invoices)
    const pendingCount = countInvoicesByStatus(invoices, 'open')
    const paidCount = countInvoicesByStatus(invoices, 'paid')

    const pendingEarnings = invoices
      .filter((inv) => inv.status === 'open')
      .reduce((sum, inv) => sum + inv.total, 0) / 100

    const averageTransaction = paidCount > 0 ? totalEarnings / paidCount : 0

    return {
      totalEarnings,
      pendingEarnings,
      pendingCount,
      paidCount,
      averageTransaction,
    }
  }, [invoices])

  return {
    data: stats,
    isLoading,
    error,
  }
}
