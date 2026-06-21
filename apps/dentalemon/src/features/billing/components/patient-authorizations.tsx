/**
 * PatientAuthorizations — Letter of Authorization (LOA) finance panel.
 *
 * Surfaces the coverage-authorization flow that previously had a fully-built
 * backend + hooks (usePatientAuthorizations / useAuthorizationMutations) but NO
 * UI, so no user could reach it (plan 013 "orphaned-UI" gap). Renders the patient's
 * authorizations with their FSM status, an inline "Add authorization" form
 * (insuranceProfileId + LOA number + optional approved cap), and approve/deny
 * actions on a 'requested' one. Mirrors the PatientCredits card it sits beside.
 */
import React, { useState } from 'react';
import {
  usePatientAuthorizations,
  useAuthorizationMutations,
  usePatientInsuranceProfiles,
} from '../hooks/use-insurance-claims';
import { formatPeso } from './insurance.helpers';

/** Visual accent per coverage-authorization FSM status (mirrors claimStatusClass). */
function statusClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'partial':
      return 'bg-blue-100 text-blue-800';
    case 'denied':
      return 'bg-red-100 text-red-800';
    case 'requested':
      return 'bg-amber-100 text-amber-800';
    default: // expired
      return 'bg-secondary text-muted-foreground';
  }
}

function toCents(pesos: string): number | undefined {
  const n = Number(pesos);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
}

export interface PatientAuthorizationsProps {
  patientId: string;
}

export function PatientAuthorizations({ patientId }: PatientAuthorizationsProps) {
  const { authorizations, isLoading, error } = usePatientAuthorizations(patientId);
  // Defensive: never `.map` a non-array. The hook already normalizes to [], but a
  // host page's test that stubs the hook/query can hand back a non-array — guarding
  // here keeps a render crash from cascading (and hanging the whole test runner).
  const list = Array.isArray(authorizations) ? authorizations : [];
  const { profiles } = usePatientInsuranceProfiles(patientId);
  const { create, approve, deny, isCreating, isUpdating, error: mutationError } =
    useAuthorizationMutations(patientId);

  const [showForm, setShowForm] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [loaNumber, setLoaNumber] = useState('');
  const [approvedPesos, setApprovedPesos] = useState('');

  // The profile list may load after mount, so fall back to the first profile —
  // a stale empty initializer would otherwise disable the form forever.
  const selectedProfileId = profileId || profiles[0]?.id || '';
  const insurerName = (id: string) => profiles.find((p) => p.id === id)?.insurerName ?? '—';

  async function handleCreate() {
    if (!selectedProfileId) return;
    try {
      await create({
        insuranceProfileId: selectedProfileId,
        loaNumber: loaNumber.trim() || undefined,
        approvedAmountCents: toCents(approvedPesos),
      });
      setShowForm(false);
      setProfileId('');
      setLoaNumber('');
      setApprovedPesos('');
    } catch {
      /* ISSUE-023: surfaced via mutationError below — never fail silently */
    }
  }

  async function handleApprove(id: string) {
    try {
      await approve({ authorizationId: id });
    } catch {
      /* surfaced via mutationError */
    }
  }

  async function handleDeny(id: string) {
    try {
      await deny({ authorizationId: id });
    } catch {
      /* surfaced via mutationError */
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card mt-4" data-testid="patient-authorizations">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Authorizations</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          data-testid="add-authorization-btn"
          className="h-8 px-3 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          {showForm ? 'Cancel' : 'Add authorization'}
        </button>
      </div>

      {showForm && (
        <div
          data-testid="authorization-form"
          className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-muted/30"
        >
          <select
            value={selectedProfileId}
            onChange={(e) => setProfileId(e.target.value)}
            aria-label="Insurance profile"
            data-testid="authorization-insurer-select"
            className="h-9 rounded-lg border border-border px-2 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            {profiles.length === 0 && <option value="">No insurance on file</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.insurerName}
                {p.policyNumber ? ` · ${p.policyNumber}` : ''}
              </option>
            ))}
          </select>
          <input
            value={loaNumber}
            onChange={(e) => setLoaNumber(e.target.value)}
            placeholder="LOA / approval no."
            aria-label="LOA number"
            data-testid="authorization-loa-input"
            className="w-44 h-9 rounded-lg border border-border px-3 text-sm bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
          />
          <input
            inputMode="decimal"
            value={approvedPesos}
            onChange={(e) => setApprovedPesos(e.target.value)}
            placeholder="Approved cap (optional)"
            aria-label="Approved amount"
            data-testid="authorization-amount-input"
            className="w-40 h-9 rounded-lg border border-border px-3 text-sm tabular-nums bg-background focus-visible:ring-2 focus-visible:ring-ring outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !selectedProfileId}
            data-testid="authorization-submit"
            className="h-9 px-4 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
          >
            {isCreating ? 'Saving…' : 'Save authorization'}
          </button>
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive" data-testid="authorizations-error">
            {error.message || 'Could not load authorizations.'}
          </div>
        ) : list.length === 0 ? (
          <div className="text-sm text-muted-foreground" data-testid="authorizations-empty">
            No authorizations yet.
          </div>
        ) : (
          list.map((a) => (
            <div
              key={a.id}
              data-testid={`authorization-row-${a.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 flex flex-col">
                <span className="text-sm font-medium truncate">{a.loaNumber || '—'}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {insurerName(a.insuranceProfileId)}
                  {a.approvedAmountCents != null ? ` · ${formatPeso(a.approvedAmountCents)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  data-testid={`authorization-status-${a.id}`}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(a.status)}`}
                >
                  {a.status}
                </span>
                {a.status === 'requested' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(a.id)}
                      disabled={isUpdating}
                      data-testid={`authorization-approve-${a.id}`}
                      className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeny(a.id)}
                      disabled={isUpdating}
                      data-testid={`authorization-deny-${a.id}`}
                      className="h-8 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring outline-none"
                    >
                      Deny
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {mutationError && (
          <div className="text-sm text-destructive" data-testid="authorization-error">
            {mutationError.message || 'Could not save the authorization.'}
          </div>
        )}
      </div>
    </div>
  );
}
