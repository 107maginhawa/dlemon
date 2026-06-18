/**
 * ClaimCreate — originate an insurance claim from the worklist (Phase 1b · A).
 *
 * Flow: search a patient → pick their insurance profile (payer) → pick an anchor
 * invoice. The claim's lines derive from that invoice server-side (POST omits
 * `lines`). Mirrors the PaymentPlanCreate sheet idiom for a consistent, iOS/macOS-
 * style presentation (Esc-to-close + focus trap via useSheetA11y, 44px targets,
 * focus-visible rings, footer-anchored primary action).
 */

import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { getErrorMessage } from '@/lib/error-toast';
import { usePatients } from '@/features/patients/hooks/use-patients';
import { usePatientBilling } from '@/features/patients/hooks/use-patient-billing';
import { usePatientInsuranceProfiles, useClaimMutations } from '../hooks/use-insurance-claims';
import { formatPeso } from './insurance.helpers';

export interface ClaimCreateProps {
  branchId?: string | null;
  open: boolean;
  onClose: () => void;
  onCreated?: (claimId: string) => void;
}

export interface ClaimSelection {
  patientId: string;
  insuranceProfileId: string;
  invoiceId: string;
}

/** A claim can be filed only once all three anchors are chosen. */
export function canFileClaim(sel: ClaimSelection): boolean {
  return Boolean(sel.patientId && sel.insuranceProfileId && sel.invoiceId);
}

// An invoice is claimable when it has been issued and still owes money.
const CLAIMABLE_STATUSES = new Set(['issued', 'partial', 'overdue']);

export function ClaimCreate({ branchId, open, onClose, onCreated }: ClaimCreateProps) {
  useSheetA11y({ open, onClose });
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [insuranceProfileId, setInsuranceProfileId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showResults = query.trim().length >= 2 && !patientId;
  // ponytail: no manual debounce — react-query dedupes/caches keystrokes; add one
  // if the patient-list endpoint shows load.
  const { patients } = usePatients({ branchId: branchId ?? undefined, searchQuery: query });
  const { profiles } = usePatientInsuranceProfiles(patientId || null);
  const { invoices } = usePatientBilling({ patientId, branchId: branchId ?? null });
  const { create, isCreating } = useClaimMutations({ branchId });

  if (!open) return null;

  const claimableInvoices = invoices.filter(
    (inv) => CLAIMABLE_STATUSES.has(inv.status) && (inv.balanceCents ?? 0) > 0,
  );
  const activeProfiles = profiles.filter((p) => p.active);
  const sel: ClaimSelection = { patientId, insuranceProfileId, invoiceId };

  function resetPatient() {
    setPatientId('');
    setPatientName('');
    setInsuranceProfileId('');
    setInvoiceId('');
  }

  async function handleFile() {
    if (!canFileClaim(sel)) return;
    setError(null);
    try {
      const claim = (await create({ patientId, insuranceProfileId, invoiceId })) as { id: string };
      onCreated?.(claim.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to file claim'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="File Insurance Claim">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div data-testid="claim-create" className="relative w-full max-w-[520px] max-h-[88vh] bg-background rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-base font-semibold tracking-tight">File Insurance Claim</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">✕</button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5 overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          {/* 1 — Patient */}
          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patient</span>
            {patientId ? (
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm font-medium">{patientName}</span>
                <button type="button" onClick={resetPatient} className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Change</button>
              </div>
            ) : (
              <>
                <input
                  data-testid="claim-patient-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name…"
                  aria-label="Search patient"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
                {showResults && (
                  <ul className="rounded-xl border border-border divide-y divide-border max-h-44 overflow-y-auto">
                    {patients.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-muted-foreground">No patients match “{query}”.</li>
                    ) : (
                      patients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            data-testid={`claim-patient-opt-${p.id}`}
                            onClick={() => { setPatientId(p.id); setPatientName(p.displayName); setQuery(''); }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/60 transition-colors"
                          >
                            {p.displayName}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </>
            )}
          </section>

          {/* 2 — Insurance profile (payer) */}
          {patientId && (
            <section className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payer</span>
              {activeProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-border px-3 py-2.5" data-testid="claim-no-profile">
                  No active insurance profile on file for this patient.
                </p>
              ) : (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Insurance profile">
                  {activeProfiles.map((p) => {
                    const active = insuranceProfileId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`claim-profile-opt-${p.id}`}
                        onClick={() => setInsuranceProfileId(p.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-lemon ring-2 ring-ring bg-lemon/5' : 'border-border hover:bg-secondary/40'}`}
                      >
                        <span className="text-sm font-medium">{p.insurerName}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">{p.payerType} · {p.policyNumber}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* 3 — Anchor invoice */}
          {patientId && (
            <section className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anchor invoice</span>
              {claimableInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-border px-3 py-2.5" data-testid="claim-no-invoice">
                  No issued invoice with a balance to claim against.
                </p>
              ) : (
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Anchor invoice">
                  {claimableInvoices.map((inv) => {
                    const active = invoiceId === inv.id;
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`claim-invoice-opt-${inv.id}`}
                        onClick={() => setInvoiceId(inv.id)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-lemon ring-2 ring-ring bg-lemon/5' : 'border-border hover:bg-secondary/40'}`}
                      >
                        <span className="text-sm font-medium">{inv.invoiceNumber}</span>
                        <span className="text-sm tabular-nums">{formatPeso(inv.balanceCents)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Claim lines are derived from the selected invoice.</p>
            </section>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 h-16 border-t flex-shrink-0">
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
          <button
            type="button"
            data-testid="file-claim-btn"
            onClick={handleFile}
            disabled={!canFileClaim(sel) || isCreating}
            className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Filing…' : 'File Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
