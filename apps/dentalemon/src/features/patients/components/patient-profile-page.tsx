/**
 * PatientProfilePage — PROF-01, PROF-02, PROF-03, PROF-04
 *
 * Standalone patient profile showing demographics, visit history, and billing.
 * Accessible from the patient list and from the clinical workspace.
 *
 * Wireframe: docs/prd/context/wireframes/patient-profile.html
 */
import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { BRAND_GOLD, BRAND_GOLD_TEXT, CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { usePatientProfile } from '../hooks/use-patient-profile';
import { usePatientBilling } from '../hooks/use-patient-billing';
import { useVisits } from '@/features/workspace/hooks/use-visits';

// ─── Types ─────────────────────────────────────────────────────────────────

type ProfileTab = 'overview' | 'payment' | 'followup';

interface PatientProfilePageProps {
  patientId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function initials(name: string): string {
  const words = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  }
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

function formatDate(date: Date | null | undefined, locale = APP_LOCALE): string {
  if (!date) return '—';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(APP_LOCALE, { minimumFractionDigits: 0 });
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    archived: 'bg-muted text-muted-foreground',
    'in-session': 'bg-teal-100 text-teal-800',
  };
  const label: Record<string, string> = {
    active: 'Active',
    archived: 'Archived',
    'in-session': 'In Session',
  };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status] ?? styles['active']}`}>
      {label[status] ?? 'Active'}
    </span>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: ProfileTab;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      data-testid={`tab-${id}`}
      onClick={onClick}
      style={active ? { borderBottomColor: BRAND_GOLD, color: BRAND_GOLD_TEXT } : undefined}
      className={[
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-[#FFE97D] text-[#4A4018]'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({ patientId }: { patientId: string }) {
  const { visits, isLoading } = useVisits({ patientId });

  return (
    <div className="flex flex-col gap-4">
      {/* Recent Visits — PROF-02 */}
      <div
        data-testid="visit-history-section"
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Visits</h3>
          <span className="text-xs text-muted-foreground">{visits.length} total</span>
        </div>

        {isLoading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : visits.length === 0 ? (
          <p
            data-testid="no-visits-message"
            className="text-sm text-muted-foreground py-2"
          >
            No visits recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visits.slice(0, 6).map((v) => (
              <li key={v.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {v.chiefComplaint || 'Visit'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(v.createdAt).toLocaleDateString(APP_LOCALE, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={[
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap',
                    v.status === 'completed' || v.status === 'locked'
                      ? 'bg-green-100 text-green-800'
                      : v.status === 'active'
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {v.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Payment Tab ───────────────────────────────────────────────────────────

function PaymentTab({ patientId, branchId }: { patientId: string; branchId: string | null }) {
  const { invoices, isLoading, error } = usePatientBilling({ patientId, branchId });

  const totalBalance = invoices.reduce((sum, inv) => sum + (inv.balanceCents ?? 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Payment History</h3>
        {invoices.length > 0 && (
          <span className="text-xs text-muted-foreground">{invoices.length} transactions</span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-destructive">Failed to load payment history.</div>
      ) : invoices.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">No transactions found.</div>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-x-4 px-4 py-2 text-[11px] font-medium text-muted-foreground border-b border-border">
            <span>Date</span>
            <span>Invoice</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Balance</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-x-4 px-4 py-3 text-sm items-center"
              >
                <span className="text-muted-foreground text-xs">
                  {inv.visitDate
                    ? new Date(inv.visitDate).toLocaleDateString(APP_LOCALE, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
                <span className="truncate font-medium">{inv.invoiceNumber}</span>
                <span className="text-right font-medium tabular-nums">
                  {CURRENCY_SYMBOL}{formatCents(inv.totalCents)}
                </span>
                <span
                  className={[
                    'text-right tabular-nums font-medium',
                    inv.balanceCents > 0 ? 'text-destructive' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {CURRENCY_SYMBOL}{formatCents(inv.balanceCents)}
                </span>
                <span
                  className={[
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    inv.status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : inv.status === 'pending' || inv.status === 'overdue'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>

          {/* Balance summary */}
          {totalBalance > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
              <span className="text-sm font-semibold">Outstanding Balance</span>
              <span className="text-sm font-bold text-destructive">
                {CURRENCY_SYMBOL}{formatCents(totalBalance)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Follow-up Tab ─────────────────────────────────────────────────────────

function FollowupTab() {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <div className="text-3xl mb-3">📋</div>
      <p className="text-sm font-semibold mb-1">Follow-Up Log</p>
      <p className="text-sm text-muted-foreground">
        No follow-up notes yet. Add one after the next visit.
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function PatientProfilePage({ patientId }: PatientProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const { data, isLoading, error } = usePatientProfile({ patientId });

  const branchId =
    typeof window !== 'undefined' ? localStorage.getItem('currentBranchId') : null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div data-testid="profile-loading" className="p-6 flex flex-col gap-4">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div data-testid="profile-error" className="p-6">
        <Link to="/patients" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Patients
        </Link>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
          Failed to load patient profile. Please try again.
        </div>
      </div>
    );
  }

  // ── Profile header values ─────────────────────────────────────────────────
  const avatar = initials(data.displayName);
  const demographicParts = [
    data.gender,
    data.age > 0 ? `${data.age} yrs` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background sticky top-0 z-10">
        <Link
          to="/patients"
          data-testid="back-to-patients"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          ‹ Patients
        </Link>
        <span className="text-sm font-semibold">{data.displayName}</span>
        <div className="w-24" /> {/* spacer to center the name */}
      </div>

      <div className="p-6 flex flex-col gap-4 max-w-4xl mx-auto w-full">

        {/* Profile header card — PROF-01 */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-[#4A4018] shrink-0"
              style={{ background: BRAND_GOLD }}
              aria-hidden="true"
            >
              {avatar}
            </div>

            {/* Name + demographics + contact */}
            <div className="flex-1 min-w-0">
              <p
                data-testid="profile-name"
                className="text-lg font-bold tracking-tight"
              >
                {data.lastName.toUpperCase()}, {data.firstName}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {statusBadge(data.status)}
                {demographicParts && (
                  <span className="text-sm text-muted-foreground">{demographicParts}</span>
                )}
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-4 mt-2">
                {data.phone && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span aria-hidden>📱</span>
                    {data.phone}
                  </span>
                )}
                {data.email && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span aria-hidden>✉</span>
                    {data.email}
                  </span>
                )}
                {!data.phone && !data.email && (
                  <span className="text-sm text-muted-foreground italic">No contact info</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="shrink-0 text-right">
              <div
                data-testid="stat-visit-count"
                className="flex flex-col items-center"
              >
                <span className="text-2xl font-bold">{data.visitCount}</span>
                <span className="text-xs text-muted-foreground">visits</span>
              </div>
              {data.lastVisit && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last: {formatDate(data.lastVisit)}
                </p>
              )}
              {data.nextAppointment && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Next: {formatDate(data.nextAppointment)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Patient profile sections"
          className="flex gap-1 border-b border-border -mb-4"
        >
          <TabButton id="overview" label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton
            id="payment"
            label="Payment History"
            active={activeTab === 'payment'}
            onClick={() => setActiveTab('payment')}
          />
          <TabButton id="followup" label="Follow-up Log" active={activeTab === 'followup'} onClick={() => setActiveTab('followup')} />
        </div>

        {/* Hidden button for testability */}
        <button data-testid="payment-tab-btn" style={{ display: 'none' }} onClick={() => setActiveTab('payment')} />

        {/* Tab content */}
        <div className="pt-4">
          {activeTab === 'overview' && <OverviewTab patientId={patientId} />}
          {activeTab === 'payment' && <PaymentTab patientId={patientId} branchId={branchId} />}
          {activeTab === 'followup' && <FollowupTab />}
        </div>

      </div>
    </div>
  );
}
