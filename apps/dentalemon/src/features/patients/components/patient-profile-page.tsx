/**
 * PatientProfilePage — PROF-01, PROF-02, PROF-03, PROF-04
 *
 * Standalone patient profile showing demographics, visit history, and billing.
 * Accessible from the patient list and from the clinical workspace.
 *
 * Wireframe: docs/prd/context/wireframes/patient-profile.html
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useOrgContextStore } from '@/stores/org-context.store';
import { BRAND_GOLD, BRAND_GOLD_TEXT, CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { usePatientProfile } from '@/hooks/use-patient-profile';
import { usePatientBilling } from '../hooks/use-patient-billing';
import { usePatientBalance } from '../hooks/use-patient-balance';
import { useVisits } from '@/features/workspace/hooks/use-visits';
import { isClosedVisit } from '@/features/workspace/lib/visit-status';
import { useUpdatePatient } from '../hooks/use-patient-actions';
import { FollowUpNotes } from './follow-up-notes';
import { HouseholdCard } from './household-card';
import { InsuranceCard } from './insurance-card';
import { PatientEditForm, normalizePhone } from './patient-edit-form';
import { PatientStatement } from './patient-statement';
import { PatientCredits } from './patient-credits';
import { PatientAuthorizations } from '@/features/billing/components/patient-authorizations';

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
    active: 'bg-success/15 text-success-foreground',
    archived: 'bg-muted text-muted-foreground',
    'in-session': 'bg-info/15 text-info-foreground',
  };
  const label: Record<string, string> = {
    active: 'Active',
    archived: 'Archived',
    'in-session': 'In Session',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] ?? styles['active']}`}>
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
        'px-4 py-3 min-h-[44px] text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-lemon text-lemon-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({ patientId }: { patientId: string }) {
  // GET /dental/visits requires branchId (it 400s without it) — pass the active
  // branch from org context, mirroring the workspace call site. Omitting it made
  // the profile's visit history silently 400.
  const branchId = useOrgContextStore((s) => s.branchId) ?? undefined;
  const { visits, isLoading } = useVisits({ patientId, branchId });
  // "N total" must equal the headline visit count, which is the server's
  // all-branch isCountedVisit tally (`usePatientProfile` is the same cached
  // query the header reads). Counting the branch-scoped `visits` list inline
  // diverged on multi-branch patients. See use-patient-profile.ts.
  const { data: profile } = usePatientProfile({ patientId });

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      {/* Facts rail: household + insurance pinned beside the visit history at desktop */}
      <div className="flex flex-col gap-4">
        {/* Household / guarantor — P1-27 */}
        <HouseholdCard patientId={patientId} />

        {/* Insurance profiles — PP-2 (ISSUE-036) */}
        <InsuranceCard patientId={patientId} />
      </div>

      {/* Recent Visits — PROF-02 */}
      <div
        data-testid="visit-history-section"
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Visits</h3>
          {/* Server-computed lifetime count (isCountedVisit: completed/locked,
              all branches) — same figure as the profile headline. The list below
              shows the recent branch-scoped visits incl. the open "Current" one. */}
          <span className="text-xs text-muted-foreground">
            {profile?.visitCount ?? 0} total
          </span>
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
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                    isClosedVisit(v.status)
                      ? 'bg-success/15 text-success-foreground'
                      : v.status === 'active'
                      ? 'bg-info/15 text-info-foreground'
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
  // Authoritative outstanding balance (slice 1.6): server-computed over non-voided
  // invoices, immune to invoice-list pagination. Fall back to the visible-rows sum
  // only while the balance endpoint is still loading.
  const { balance } = usePatientBalance({ patientId });
  const queryClient = useQueryClient();
  const totalBalance =
    balance?.outstandingBalanceCents ??
    // Match the server (getPatientBalance / getDentalPatient): a voided invoice
    // keeps its balanceCents, so it must be excluded or the fallback inflates.
    invoices
      .filter((inv) => inv.status !== 'voided')
      .reduce((sum, inv) => sum + (inv.balanceCents ?? 0), 0);
  const [showStatement, setShowStatement] = useState(false);
  const outstandingInvoices = invoices
    .filter((inv) => inv.status !== 'voided' && (inv.balanceCents ?? 0) > 0)
    .map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, balanceCents: inv.balanceCents }));

  return (
    <>
    <div className="rounded-xl border border-border bg-card">
      {showStatement && (
        <PatientStatement patientId={patientId} branchId={branchId} onClose={() => setShowStatement(false)} />
      )}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Payment History</h3>
        <div className="flex items-center gap-3">
          {invoices.length > 0 && (
            <span className="text-xs text-muted-foreground">{invoices.length} transactions</span>
          )}
          <button
            type="button"
            onClick={() => setShowStatement(true)}
            data-testid="view-statement-btn"
            className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            Statement
          </button>
        </div>
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
          <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-x-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
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
                      ? 'bg-success/15 text-success-foreground'
                      : // 'pending' was never a real DentalInvoiceStatus (draft|issued|
                        // partial|paid|overdue|voided) → this branch was always false.
                        inv.status === 'issued' || inv.status === 'partial' || inv.status === 'overdue'
                      ? 'bg-warning/15 text-warning-foreground'
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
              <span
                className="text-sm font-bold text-destructive"
                data-testid="patient-outstanding-balance"
              >
                {CURRENCY_SYMBOL}{formatCents(totalBalance)}
              </span>
            </div>
          )}
        </>
      )}
    </div>
    <PatientCredits
      patientId={patientId}
      outstandingInvoices={outstandingInvoices}
      onChanged={() => { void queryClient.invalidateQueries(); }}
    />
    <PatientAuthorizations patientId={patientId} />
    </>
  );
}

// ─── Follow-up Tab ─────────────────────────────────────────────────────────

function FollowupTab({ patientId }: { patientId: string }) {
  return <FollowUpNotes patientId={patientId} />;
}

// ─── Main component ────────────────────────────────────────────────────────

export function PatientProfilePage({ patientId }: PatientProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const { data, isLoading, error } = usePatientProfile({ patientId });
  const { update, isPending: isSaving, error: saveError } = useUpdatePatient(patientId);

  const branchId = useOrgContextStore((s) => s.branchId);

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
        <button
          type="button"
          data-testid="edit-patient-button"
          onClick={() => setEditOpen(true)}
          className="text-sm font-medium text-lemon-foreground hover:underline w-24 text-right"
        >
          Edit
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4 max-w-6xl mx-auto w-full">

        {/* Profile header card — PROF-01 */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-lemon-foreground shrink-0"
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

        {/* Tab content */}
        <div className="pt-4">
          {activeTab === 'overview' && <OverviewTab patientId={patientId} />}
          {activeTab === 'payment' && <PaymentTab patientId={patientId} branchId={branchId} />}
          {activeTab === 'followup' && <FollowupTab patientId={patientId} />}
        </div>

      </div>

      {/* FR2.4: demographics-correction modal. Conditionally rendered so it
          remounts on each open — otherwise the form's useState would retain
          stale values typed during a prior cancelled edit. */}
      {editOpen && (
      <PatientEditForm
        open={editOpen}
        initial={{
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ?? '',
          gender: data.gender ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
        }}
        disabled={data.status === 'archived'}
        error={saveError ? 'Could not save changes. Please try again.' : null}
        saving={isSaving}
        onClose={() => setEditOpen(false)}
        onSubmit={async (d) => {
          try {
            // #14 / ISSUE-029: send contactInfo only when a non-empty contact
            // value actually changed. Compare the form's canonical value against
            // the *canonicalized* stored value (trim email, E.164-normalize phone)
            // — otherwise an untouched phone stored with display spaces
            // ("+63 917 …") always differs from its normalized form (ISSUE-015)
            // and gets re-sent, silently mutating an unedited field and firing a
            // spurious `patient.contact.update` audit. The server merges, so
            // omitted sub-fields keep their stored value; explicit single-field
            // clear is a V2 item.
            const contactInfo: { email?: string; phone?: string } = {};
            if (d.email && d.email !== (data.email ?? '').trim()) contactInfo.email = d.email;
            if (d.phone && d.phone !== normalizePhone(data.phone ?? '')) contactInfo.phone = d.phone;
            const contactChanged = contactInfo.email !== undefined || contactInfo.phone !== undefined;
            await update({
              firstName: d.firstName,
              lastName: d.lastName,
              dateOfBirth: d.dateOfBirth,
              gender: d.gender,
              ...(contactChanged ? { contactInfo } : {}),
            });
            setEditOpen(false);
          } catch {
            // Error surfaced via saveError; keep the modal open for retry.
          }
        }}
      />
      )}
    </div>
  );
}
