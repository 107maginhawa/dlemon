/**
 * MorningBriefing -- main dashboard component (command-center home)
 *
 * Composition root for the redesigned Home: greeting + quick actions, then a
 * Today timeline hero alongside an action rail (Needs-attention queue + a
 * compact KPI ribbon), then a shrunk Tomorrow "Up next" strip. Data-only —
 * reuses the existing useDashboardSummary query; no new endpoints.
 *
 * Role-based: staff_full sees a non-financial view (AttentionQueue drops
 * financial items; KPI ribbon drops collections). staff_scheduling is denied
 * the dashboard module at NAV + LANDING (rbac canAccess=false hides the nav
 * link; getDefaultRoute lands them on /patients). The /dashboard route itself
 * is the intentional ungated universal-redirect fallback (_dashboard.tsx), so
 * denial is not a hard route block.
 */

import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Skeleton } from '@monobase/ui';
import { canViewFinancials } from '@/lib/rbac';
import type { DentalRole } from '@/lib/rbac';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';
import { ScheduleTimeline } from './schedule-timeline';
import { AttentionQueue } from './attention-queue';
import { KpiRibbon } from './kpi-ribbon';
import {
  getGreeting, formatTodayDate,
  groupAppointmentsByStatus,
  buildAttentionItems,
  formatTime, getInitials,
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
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <Skeleton className="rounded-2xl h-80" />
        <div className="flex flex-col gap-4">
          <Skeleton className="rounded-2xl h-40" />
          <Skeleton className="rounded-2xl h-24" />
        </div>
      </div>
      <Skeleton className="rounded-2xl h-32" />
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
  const paymentPlansBehind = data?.paymentPlansBehind ?? null;
  const overdueLabOrders = data?.overdueLabOrders ?? null;

  const groups = groupAppointmentsByStatus(todayAppointments);
  const attentionItems = buildAttentionItems({
    appointments: todayAppointments,
    overdueInvoices,
    overdueLabOrders,
    paymentPlansBehind,
    showFinancials,
  });

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
          {/* Command center: Today timeline (hero) + action rail (queue + KPIs) */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
            <ScheduleTimeline
              appointments={todayAppointments}
              now={now}
              showFinancials={showFinancials}
              onAdd={() => navigate({ to: '/calendar' })}
              onViewWeek={() => navigate({ to: '/calendar' })}
            />

            <div className="flex flex-col gap-4">
              <AttentionQueue
                items={attentionItems}
                onSelect={(route) => navigate({ to: route })}
              />
              <KpiRibbon
                showFinancials={showFinancials}
                dailyCollectionsCents={dailyCollectionsCents}
                doneCount={groups.done.length}
                remainingCount={groups.upcoming.length}
              />
            </div>
          </div>

          {/* Up next -- Tomorrow preview (kept, shrunk) */}
          <div className="bg-background rounded-2xl shadow-sm p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                Up next &mdash; Tomorrow{' '}
                <span className="normal-case tracking-normal text-muted-foreground/80">
                  {new Date(Date.now() + 86400000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  &middot; {tomorrowAppointments.length} appt{tomorrowAppointments.length !== 1 ? 's' : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate({ to: '/calendar' })}
                className="text-xs font-medium text-lemon-foreground hover:underline"
              >
                Open calendar
              </button>
            </div>

            {tomorrowAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">
                No appointments scheduled for tomorrow.
              </p>
            ) : (
              tomorrowAppointments.slice(0, 5).map((appt) => (
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
                    {appt.serviceType ?? '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
