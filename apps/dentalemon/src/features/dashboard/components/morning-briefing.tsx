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
 * staff_scheduling has no dashboard access (enforced at route level).
 *
 * Wireframe: docs/prd/context/wireframes/dashboard.html
 */

import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { canViewFinancials } from '../../../utils/rbac';
import { MetricCard } from './metric-card';
import type { DentalRole } from '../../../utils/rbac';
import { useDashboardSummary } from '../hooks/use-dashboard-summary';

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatTodayDate(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function calcTrend(today: number, yesterday: number): string {
  if (yesterday === 0 && today === 0) return '\u2014';
  if (yesterday === 0) return '+100%';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct > 0) return `+${pct}%`;
  if (pct < 0) return `${pct}%`;
  return '0%';
}

export function groupAppointmentsByStatus(appointments: { status: string }[]): {
  done: typeof appointments;
  now: typeof appointments;
  upcoming: typeof appointments;
} {
  const done: typeof appointments = [];
  const now: typeof appointments = [];
  const upcoming: typeof appointments = [];

  for (const appt of appointments) {
    switch (appt.status) {
      case 'completed':
      case 'no_show':
        done.push(appt);
        break;
      case 'checked_in':
        now.push(appt);
        break;
      case 'scheduled':
      default:
        upcoming.push(appt);
        break;
    }
  }

  return { done, now, upcoming };
}

export function getNextAppointment<T extends { status: string; scheduledAt: string }>(
  appointments: T[],
): T | null {
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'checked_in',
  );
  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return upcoming[0] ?? null;
}

export function sumOutstanding(invoices: { balanceCents: number }[]): number {
  return invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);
}

export function formatPaymentPlanSubtitle(count: number, behind: number | null): string {
  if (behind != null && behind > 0) {
    return `active plans \u00B7 ${behind} behind`;
  }
  return 'active plans';
}

export function formatLabOrderSubtitle(pending: number, overdue: number | null): string {
  if (overdue != null && overdue > 0) {
    return `${pending} pending \u00B7 ${overdue} overdue`;
  }
  return `${pending} pending delivery`;
}

export function countPendingTreatments(appointments: { status: string }[]): number {
  return appointments.filter((a) => a.status === 'scheduled').length;
}

export function formatDailyCollections(cents: number | null): string {
  if (cents == null) return '\u20B1\u2014';
  const pesos = cents / 100;
  return `\u20B1${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCents(cents: number): string {
  const pesos = cents / 100;
  return `\u20B1${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getInitials(name?: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-muted/40 h-32 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-muted/40 h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        <div className="rounded-2xl bg-muted/40 h-48 animate-pulse" />
        <div className="rounded-2xl bg-muted/40 h-48 animate-pulse" />
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
          className="h-11 px-4 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold flex items-center gap-1.5 hover:bg-[#F5DC60] transition-colors"
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
                  <div className="w-6 h-6 rounded-full bg-[#FFE97D] text-[#4A4018] text-[9px] font-bold flex items-center justify-center flex-shrink-0">
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
                      let slotClass = 'bg-gray-200';
                      if (appt.status === 'completed' || appt.status === 'no_show')
                        slotClass = 'bg-green-500';
                      if (appt.status === 'checked_in') slotClass = 'bg-sky-400';
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
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                          <span className="text-[13px] font-medium truncate">
                            {inv.patientName ?? inv.invoiceNumber}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold text-red-500 tabular-nums">
                          {formatCents(inv.balanceCents)}
                        </span>
                      </div>
                    ))}
                    {overdueTotal > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Total outstanding:{' '}
                        <strong className="text-red-500">{formatCents(overdueTotal)}</strong>
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
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">
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
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
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
                  className="text-xs font-medium text-[#4A4018] hover:underline"
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
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">
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
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
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
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                  <div>
                    <p className="text-[13px] font-medium">Reorder composite resin (A2)</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Stock below threshold
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-start py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0 mt-1.5" />
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
