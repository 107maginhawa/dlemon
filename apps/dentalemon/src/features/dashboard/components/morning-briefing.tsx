/**
 * MorningBriefing -- main dashboard component
 *
 * Aggregates data from existing dental APIs to show:
 * - Quick actions (New Patient, New Appointment, Open Workspace)
 * - Today's schedule, daily collections, overdue alerts
 * - Pending treatments, payment plans, lab orders
 * - Tomorrow preview, reminders
 *
 * Role-based: staff_full sees simplified view (no financials).
 * staff_scheduling is denied the dashboard module at NAV + LANDING (rbac
 * canAccess=false hides the nav link; getDefaultRoute lands them on /patients).
 * The /dashboard route itself is the intentional ungated universal-redirect
 * fallback (_dashboard.tsx), so denial is not a hard route block.
 *
 * Wireframe: docs/prd/context/wireframes/dashboard.html
 */

import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Skeleton } from '@monobase/ui';
import { canViewFinancials } from '@/lib/rbac';
import { MetricCard } from './metric-card';
import type { DentalRole } from '@/lib/rbac';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import {
  getGreeting, formatTodayDate, calcTrend,
  groupAppointmentsByStatus, getNextAppointment,
  sumOutstanding, formatPaymentPlanSubtitle, formatLabOrderSubtitle,
  countPendingTreatments, formatDailyCollections,
  formatCents, formatTime, getInitials,
} from './morning-briefing.helpers';

export { getGreeting, formatTodayDate, calcTrend } from './morning-briefing.helpers';
export { groupAppointmentsByStatus, getNextAppointment, sumOutstanding } from './morning-briefing.helpers';
export { formatPaymentPlanSubtitle, formatLabOrderSubtitle, countPendingTreatments, formatDailyCollections } from './morning-briefing.helpers';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="rounded-2xl h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="rounded-2xl h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        <Skeleton className="rounded-2xl h-48" />
        <Skeleton className="rounded-2xl h-48" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MorningBriefingProps {
  role: DentalRole;
  branchId: string;
}

export function MorningBriefing({ role, branchId }: MorningBriefingProps) {
  const navigate = useNavigate();
  const showFinancials = canViewFinancials(role);

  const { data, isLoading, error } = useDashboardSummary({ branchId, showFinancials });

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateLabel = formatTodayDate(now);

  const todayAppointments = data?.todayAppointments ?? [];
  const tomorrowAppointments = data?.tomorrowAppointments ?? [];
  const overdueInvoices = data?.overdueInvoices ?? [];
  const dailyCollectionsCents = data?.dailyCollectionsCents ?? null;
  const activePaymentPlans = data?.activePaymentPlans ?? null;
  const paymentPlansBehind = data?.paymentPlansBehind ?? null;
  const pendingLabOrders = data?.pendingLabOrders ?? null;
  const overdueLabOrders = data?.overdueLabOrders ?? null;

  const groups = groupAppointmentsByStatus(todayAppointments);
  const nextAppt = getNextAppointment(todayAppointments);
  const overdueTotal = sumOutstanding(overdueInvoices);

  return (
    <div className="flex flex-col gap-4" data-testid="morning-briefing">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting} <span aria-hidden="true">&#128075;</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateLabel}</p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          data-testid="quick-new-patient"
          onClick={() => navigate({ to: '/patients' })}
          className="h-11 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold flex items-center gap-1.5 hover:bg-lemon-hover transition-colors"
        >
          <span className="text-base leading-none">+</span> New Patient
        </button>
        <button
          type="button"
          data-testid="quick-new-appointment"
          onClick={() => navigate({ to: '/calendar' })}
          className="h-11 px-4 rounded-xl bg-background border border-border text-sm font-medium flex items-center gap-1.5 hover:bg-secondary/50 transition-colors"
        >
          <span className="text-base leading-none">+</span> New Appointment
        </button>
        <button
          type="button"
          data-testid="quick-open-workspace"
          onClick={() => navigate({ to: '/patients' })}
          className="h-11 px-4 rounded-xl bg-background border border-border text-sm font-medium flex items-center gap-1.5 hover:bg-secondary/50 transition-colors"
        >
          Open Workspace
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && <DashboardSkeleton />}

      {!isLoading && !error && (
        <>
          {/* Row 1: Schedule, Collections, Overdue */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Today's Schedule */}
            <MetricCard
              title="Today's Schedule"
              value={todayAppointments.length}
              subtitle="appointments today"
              action={{ label: 'View all', onClick: () => navigate({ to: '/calendar' }) }}
            >
              {/* Next patient */}
              {nextAppt && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-lemon text-lemon-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(nextAppt.patientName)}
                  </div>
                  <span className="text-[13px] font-medium truncate">
                    {nextAppt.patientName ?? nextAppt.patientId}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                    {formatTime(nextAppt.scheduledAt)}
                  </span>
                </div>
              )}

              {/* Slot bar */}
              {todayAppointments.length > 0 && (
                <>
                  <div
                    className="flex gap-1 mt-3"
                    aria-label={`${todayAppointments.length} appointment slots`}
                  >
                    {todayAppointments.map((appt) => {
                      let slotClass = 'bg-muted';
                      if (appt.status === 'completed' || appt.status === 'no_show')
                        slotClass = 'bg-success';
                      if (appt.status === 'checked_in') slotClass = 'bg-info';
                      return (
                        <div
                          key={appt.id}
                          className={`flex-1 h-1.5 rounded-full ${slotClass}`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {groups.done.length} done · {groups.now.length} now · {groups.upcoming.length} remaining
                  </p>
                </>
              )}
            </MetricCard>

            {/* FR0.4: Daily Collections (financial roles only) */}
            {showFinancials ? (
              <MetricCard
                title="Daily Collections"
                value={formatDailyCollections(dailyCollectionsCents)}
                subtitle={dailyCollectionsCents !== null ? 'collected today' : 'loading...'}
                action={{ label: 'Details', onClick: () => navigate({ to: '/billing' }) }}
              />
            ) : (
              <MetricCard
                title="Follow-ups"
                value={groups.upcoming.length}
                subtitle="remaining appointments today"
              />
            )}

            {/* Overdue Alerts (financial roles only) */}
            {showFinancials ? (
              <MetricCard
                title="Overdue Alerts"
                value={overdueInvoices.length}
                subtitle="patients with overdue balances"
                accentColor="red"
                action={{ label: 'View all', onClick: () => navigate({ to: '/billing' }) }}
              >
                {overdueInvoices.length > 0 && (
                  <div className="flex flex-col mt-2">
                    {overdueInvoices.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                          <span className="text-[13px] font-medium truncate">
                            {inv.patientName ?? inv.invoiceNumber}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold text-destructive-emphasis tabular-nums">
                          {formatCents(inv.balanceCents)}
                        </span>
                      </div>
                    ))}
                    {overdueTotal > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Total outstanding:{' '}
                        <strong className="text-destructive-emphasis">{formatCents(overdueTotal)}</strong>
                      </p>
                    )}
                  </div>
                )}
              </MetricCard>
            ) : (
              <MetricCard
                title="Today's Completed"
                value={groups.done.length}
                subtitle="appointments completed"
                accentColor="green"
              />
            )}
          </div>

          {/* Row 2: Treatments, Plans, Lab */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* FR0.3: Pending Treatments (proxy via scheduled appointments) */}
            <MetricCard
              title="Pending Treatments"
              value={countPendingTreatments(todayAppointments)}
              subtitle="scheduled appointments pending"
              action={{ label: 'View all', onClick: () => navigate({ to: '/patients' }) }}
            >
              <p className="text-[11px] text-muted-foreground">
                Check workspace for treatment details
              </p>
            </MetricCard>

            {/* FR0.7: Payment Plans (financial only) */}
            {showFinancials ? (
              <MetricCard
                title="Payment Plans"
                value={activePaymentPlans !== null ? activePaymentPlans : '\u2014'}
                subtitle={formatPaymentPlanSubtitle(activePaymentPlans ?? 0, paymentPlansBehind)}
                accentColor={paymentPlansBehind != null && paymentPlansBehind > 0 ? 'amber' : undefined}
                action={{ label: 'Manage', onClick: () => navigate({ to: '/billing' }) }}
              >
                {paymentPlansBehind != null && paymentPlansBehind > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-warning/15 text-warning-foreground">
                    {paymentPlansBehind} behind
                  </span>
                )}
              </MetricCard>
            ) : (
              <MetricCard
                title="Checked In"
                value={groups.now.length}
                subtitle="patients currently checked in"
                accentColor="lemon"
              />
            )}

            {/* FR0.8: Lab Orders */}
            <MetricCard
              title="Lab Orders"
              value={pendingLabOrders !== null ? pendingLabOrders : '\u2014'}
              subtitle={formatLabOrderSubtitle(pendingLabOrders ?? 0, overdueLabOrders)}
              accentColor={overdueLabOrders != null && overdueLabOrders > 0 ? 'red' : undefined}
            >
              {overdueLabOrders != null && overdueLabOrders > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-destructive/15 text-destructive-emphasis">
                  {overdueLabOrders} overdue
                </span>
              )}
            </MetricCard>
          </div>

          {/* Row 3: Tomorrow Preview + Reminders */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            {/* Tomorrow Preview */}
            <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Tomorrow Preview
                </span>
                <button
                  type="button"
                  onClick={() => navigate({ to: '/calendar' })}
                  className="text-xs font-medium text-lemon-foreground hover:underline"
                >
                  Open Calendar
                </button>
              </div>

              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-lg font-bold tracking-tight">
                  {new Date(Date.now() + 86400000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-info/15 text-info-foreground">
                  {tomorrowAppointments.length} appointment{tomorrowAppointments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {tomorrowAppointments.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No appointments scheduled for tomorrow.
                </p>
              )}

              {tomorrowAppointments.slice(0, 5).map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
                >
                  <span className="text-xs font-medium text-muted-foreground tabular-nums w-[52px] flex-shrink-0">
                    {formatTime(appt.scheduledAt)}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {getInitials(appt.patientName)}
                  </div>
                  <span className="text-[13px] font-medium truncate">
                    {appt.patientName ?? appt.patientId}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                    {appt.serviceType ?? '\u2014'}
                  </span>
                </div>
              ))}
            </div>

            {/* Reminders (static — no backend endpoint yet) */}
            <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                  Reminders
                </span>
              </div>

              <div className="flex flex-col gap-0">
                <div className="flex gap-2 items-start py-2 border-b border-border">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0 mt-1.5" />
                  <div>
                    <p className="text-[13px] font-medium">Reorder composite resin (A2)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Stock below threshold
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-start py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-info flex-shrink-0 mt-1.5" />
                  <div>
                    <p className="text-[13px] font-medium">X-ray calibration due</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Scheduled: next maintenance window
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
