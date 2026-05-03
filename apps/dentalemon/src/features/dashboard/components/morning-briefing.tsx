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

import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { canViewFinancials } from '../../../utils/rbac';
import { MetricCard } from './metric-card';
import type { DentalRole } from '../../../utils/rbac';
import { apiBaseUrl } from '@/utils/config';

const API = apiBaseUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Appointment {
  id: string;
  patientId: string;
  patientName?: string;
  scheduledAt: string;
  durationMinutes?: number;
  status: string;
  procedureType?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName?: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueDate?: string;
  createdAt: string;
}

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

export function groupAppointmentsByStatus(appointments: Appointment[]): {
  done: Appointment[];
  now: Appointment[];
  upcoming: Appointment[];
} {
  const done: Appointment[] = [];
  const now: Appointment[] = [];
  const upcoming: Appointment[] = [];

  for (const appt of appointments) {
    switch (appt.status) {
      case 'completed':
      case 'noShow':
        done.push(appt);
        break;
      case 'checkedIn':
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

export function getNextAppointment(appointments: Appointment[]): Appointment | null {
  const upcoming = appointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'checkedIn'
  );
  if (upcoming.length === 0) return null;
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return upcoming[0] ?? null;
}

export function sumOutstanding(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);
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
// Component
// ---------------------------------------------------------------------------

export interface MorningBriefingProps {
  role: DentalRole;
  branchId: string;
}

export function MorningBriefing({ role, branchId }: MorningBriefingProps) {
  const navigate = useNavigate();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState<Appointment[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [dailyCollectionsCents, setDailyCollectionsCents] = useState<number | null>(null);
  const [activePaymentPlans, setActivePaymentPlans] = useState<number | null>(null);
  const [pendingLabOrders, setPendingLabOrders] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showFinancials = canViewFinancials(role);

  useEffect(() => {
    loadDashboardData();
  }, [branchId]);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    try {
      const fetches: Promise<Response>[] = [
        fetch(`${API}/dental/appointments?date=${today}`, { credentials: 'include' }),
        fetch(`${API}/dental/appointments?date=${tomorrow}`, { credentials: 'include' }),
        fetch(`${API}/dental/dashboard/summary`, { credentials: 'include' }),
      ];

      if (showFinancials) {
        fetches.push(
          fetch(`${API}/dental/billing/invoices?status=overdue`, { credentials: 'include' }),
          fetch(`${API}/dental/billing/invoices?branchId=${encodeURIComponent(branchId)}`, { credentials: 'include' }),
        );
      }

      const responses = await Promise.all(fetches);

      // Only throw on core appointment fetches; summary/financial are best-effort
      if (!responses[0]!.ok || !responses[1]!.ok) throw new Error('Failed to load appointments');

      const todayData = await responses[0]!.json();
      const tomorrowData = await responses[1]!.json();
      const summaryData = responses[2]?.ok ? await responses[2].json() : null;

      setTodayAppointments(
        Array.isArray(todayData) ? todayData : todayData.appointments ?? []
      );
      setTomorrowAppointments(
        Array.isArray(tomorrowData) ? tomorrowData : tomorrowData.appointments ?? []
      );

      if (summaryData) {
        setActivePaymentPlans(summaryData.activePaymentPlans?.count ?? 0);
        setPendingLabOrders(summaryData.labOrders?.totalPending ?? 0);
      }

      // Financial data at indices 3 and 4 (pushed conditionally)
      if (showFinancials && responses[3]) {
        const invoiceData = await responses[3].json();
        setOverdueInvoices(
          Array.isArray(invoiceData) ? invoiceData : invoiceData.invoices ?? []
        );
      }

      if (showFinancials && responses[4]) {
        const allInvoicesData = await responses[4].json();
        const allInvoices: Invoice[] = Array.isArray(allInvoicesData)
          ? allInvoicesData
          : allInvoicesData.invoices ?? [];
        const todayStr = today;
        const collected = allInvoices
          .filter((inv) => inv.status === 'paid' || inv.status === 'partial')
          .filter((inv) => inv.createdAt?.slice(0, 10) === todayStr)
          .reduce((sum, inv) => sum + (inv.paidCents ?? inv.totalCents - inv.balanceCents), 0);
        setDailyCollectionsCents(collected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const dateLabel = formatTodayDate(now);
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
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading dashboard...
        </div>
      )}

      {!loading && (
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
                      if (appt.status === 'completed' || appt.status === 'noShow')
                        slotClass = 'bg-green-500';
                      if (appt.status === 'checkedIn') slotClass = 'bg-sky-400';
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

            {/* Daily Collections (financial roles only) */}
            {showFinancials ? (
              <MetricCard
                title="Daily Collections"
                value={dailyCollectionsCents !== null ? formatCents(dailyCollectionsCents) : '\u20B1\u2014'}
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
                subtitle={`patients with overdue balances`}
                accentColor="red"
                action={{ label: 'View all', onClick: () => navigate({ to: '/billing' }) }}
              >
                {/* Overdue patient list (first 3) */}
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
            {/* Pending Treatments (proxy via active visits) */}
            <MetricCard
              title="Pending Treatments"
              value={todayAppointments.filter((a) => a.status === 'scheduled').length}
              subtitle="scheduled appointments pending"
              action={{ label: 'View all', onClick: () => navigate({ to: '/patients' }) }}
            >
              <p className="text-[11px] text-muted-foreground">
                Check workspace for treatment details
              </p>
            </MetricCard>

            {/* Payment Plans (financial only) */}
            {showFinancials ? (
              <MetricCard
                title="Payment Plans"
                value={activePaymentPlans !== null ? activePaymentPlans : '\u2014'}
                subtitle="active plans"
                action={{ label: 'Manage', onClick: () => navigate({ to: '/billing' }) }}
              />
            ) : (
              <MetricCard
                title="Checked In"
                value={groups.now.length}
                subtitle="patients currently checked in"
                accentColor="lemon"
              />
            )}

            {/* Lab Orders */}
            <MetricCard
              title="Lab Orders"
              value={pendingLabOrders !== null ? pendingLabOrders : '\u2014'}
              subtitle="pending delivery"
            />
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
                    {appt.procedureType ?? '\u2014'}
                  </span>
                </div>
              ))}
            </div>

            {/* Reminders (static) */}
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
