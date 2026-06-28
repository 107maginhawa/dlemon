/**
 * InsuranceCard — PP-2 (ISSUE-036) patient insurance profiles
 *
 * Lists the patient's insurance profiles on the patient-profile overview
 * (alongside the Household card) and lets staff create/edit them. Before this,
 * `createInsuranceProfile`/`updateInsuranceProfile` existed with zero FE
 * call-sites, so a profile had to be seeded via the API before any claim could
 * be filed. Creating one here invalidates the shared
 * `listPatientInsuranceProfilesQueryKey`, so the claim payer-picker
 * (claim-create.tsx) sees it immediately.
 */
import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { getErrorMessage } from '@/lib/error-toast';
import {
  usePatientInsuranceProfiles,
  useInsuranceProfileMutations,
} from '@/features/billing/hooks/use-insurance-claims';
import type {
  DentalPatientFinanceModuleInsuranceProfile,
  DentalPatientFinanceModuleCreateInsuranceProfileRequest,
} from '@monobase/sdk-ts/generated';

type InsuranceProfile = DentalPatientFinanceModuleInsuranceProfile;

export const PAYER_TYPE_OPTIONS = [
  { value: 'hmo', label: 'HMO' },
  { value: 'philhealth', label: 'PhilHealth' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'self_pay_assist', label: 'Self-pay assist' },
  { value: 'other', label: 'Other' },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other' },
] as const;

export interface InsuranceFormValues {
  insurerName: string;
  policyNumber: string;
  subscriberName: string;
  groupNumber: string;
  subscriberDob: string;
  relationship: 'self' | 'spouse' | 'child' | 'other';
  payerType: 'hmo' | 'philhealth' | 'corporate' | 'self_pay_assist' | 'other';
  notes: string;
  active: boolean;
}

export function emptyInsuranceForm(): InsuranceFormValues {
  return {
    insurerName: '',
    policyNumber: '',
    subscriberName: '',
    groupNumber: '',
    subscriberDob: '',
    relationship: 'self',
    payerType: 'hmo',
    notes: '',
    active: true,
  };
}

/** PP-2: the three identity fields the backend requires (insurerName, policyNumber, subscriberName). */
export function validateInsuranceProfileForm(v: Pick<InsuranceFormValues, 'insurerName' | 'policyNumber' | 'subscriberName'>): string[] {
  const errors: string[] = [];
  if (!v.insurerName.trim()) errors.push('Insurer name is required');
  if (!v.policyNumber.trim()) errors.push('Policy number is required');
  if (!v.subscriberName.trim()) errors.push('Subscriber name is required');
  return errors;
}

/** Map the form to the create-request wire shape — empty optionals dropped to undefined (stored null). */
export function buildInsuranceBody(v: InsuranceFormValues): DentalPatientFinanceModuleCreateInsuranceProfileRequest {
  const trimmed = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    insurerName: v.insurerName.trim(),
    policyNumber: v.policyNumber.trim(),
    subscriberName: v.subscriberName.trim(),
    groupNumber: trimmed(v.groupNumber),
    subscriberDob: trimmed(v.subscriberDob),
    relationship: v.relationship,
    payerType: v.payerType,
    notes: trimmed(v.notes),
  };
}

function profileToForm(p: InsuranceProfile): InsuranceFormValues {
  return {
    insurerName: p.insurerName ?? '',
    policyNumber: p.policyNumber ?? '',
    subscriberName: p.subscriberName ?? '',
    groupNumber: p.groupNumber ?? '',
    subscriberDob: p.subscriberDob ? String(p.subscriberDob).slice(0, 10) : '',
    relationship: (p.relationship as InsuranceFormValues['relationship']) || 'self',
    payerType: p.payerType ?? 'hmo',
    notes: p.notes ?? '',
    active: p.active,
  };
}

function payerLabel(value: string): string {
  return PAYER_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function InsuranceCard({ patientId }: { patientId: string }) {
  const { profiles, isLoading, error } = usePatientInsuranceProfiles(patientId);
  const [editing, setEditing] = useState<InsuranceProfile | 'new' | null>(null);

  if (isLoading) {
    return (
      <div data-testid="insurance-loading" className="rounded-xl border border-border bg-card p-4">
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="insurance-error" className="rounded-xl border border-border bg-card p-4 text-sm text-destructive">
        Failed to load insurance.
      </div>
    );
  }

  return (
    <div data-testid="insurance-card" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Insurance</h3>
        <button
          type="button"
          data-testid="add-insurance-btn"
          onClick={() => setEditing('new')}
          className="text-xs font-semibold px-2.5 py-1 rounded-md bg-secondary border border-border hover:bg-background transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none"
        >
          + Add
        </button>
      </div>

      {profiles.length === 0 ? (
        <p data-testid="insurance-empty" className="text-sm text-muted-foreground">
          No insurance on file.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.id} data-testid="insurance-row" className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.insurerName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {payerLabel(p.payerType)} · {p.policyNumber}
                  {!p.active && <span className="ml-1.5 text-muted-foreground">(inactive)</span>}
                </p>
              </div>
              <button
                type="button"
                data-testid={`edit-insurance-${p.id}`}
                onClick={() => setEditing(p)}
                className="text-xs font-medium text-lemon-foreground hover:underline shrink-0"
                aria-label={`Edit ${p.insurerName} insurance`}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <InsuranceProfileForm
          patientId={patientId}
          profile={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Form sheet ──────────────────────────────────────────────────────────────

function InsuranceProfileForm({
  patientId,
  profile,
  onClose,
}: {
  patientId: string;
  profile: InsuranceProfile | null;
  onClose: () => void;
}) {
  const { containerRef } = useSheetA11y({ open: true, onClose });
  const isEdit = !!profile;
  const { create, update, isSaving } = useInsuranceProfileMutations(patientId);
  const [form, setForm] = useState<InsuranceFormValues>(() => (profile ? profileToForm(profile) : emptyInsuranceForm()));
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof InsuranceFormValues>(key: K, value: InsuranceFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    const errs = validateInsuranceProfileForm(form);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    try {
      if (profile) {
        await update({ profileId: profile.id, body: { ...buildInsuranceBody(form), active: form.active } });
      } else {
        await create(buildInsuranceBody(form));
      }
      onClose();
    } catch (err) {
      setErrors([getErrorMessage(err, 'Could not save the insurance profile. Please try again.')]);
    }
  }

  const inputClass = 'w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none';
  const labelClass = 'text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block';
  const title = isEdit ? 'Edit Insurance' : 'Add Insurance';

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div data-testid="insurance-form" className="relative w-full max-w-[480px] max-h-[calc(100vh-80px)] bg-background rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-[52px] border-b flex-shrink-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {errors.length > 0 && (
            <div data-testid="insurance-form-error" className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.map((e) => <p key={e}>{e}</p>)}
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="ins-insurer">Insurer / carrier *</label>
            <input id="ins-insurer" data-testid="ins-insurer" className={inputClass} value={form.insurerName} onChange={(e) => set('insurerName', e.target.value)} placeholder="e.g. Maxicare" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="ins-policy">Policy number *</label>
              <input id="ins-policy" data-testid="ins-policy" className={inputClass} value={form.policyNumber} onChange={(e) => set('policyNumber', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={labelClass} htmlFor="ins-group">Group number</label>
              <input id="ins-group" data-testid="ins-group" className={inputClass} value={form.groupNumber} onChange={(e) => set('groupNumber', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ins-payer">Payer type</label>
            <select id="ins-payer" data-testid="ins-payer" className={inputClass} value={form.payerType} onChange={(e) => set('payerType', e.target.value as InsuranceFormValues['payerType'])}>
              {PAYER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="h-px bg-border" />

          <div>
            <label className={labelClass} htmlFor="ins-subscriber">Subscriber name *</label>
            <input id="ins-subscriber" data-testid="ins-subscriber" className={inputClass} value={form.subscriberName} onChange={(e) => set('subscriberName', e.target.value)} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="ins-relationship">Relationship</label>
              <select id="ins-relationship" data-testid="ins-relationship" className={inputClass} value={form.relationship} onChange={(e) => set('relationship', e.target.value as InsuranceFormValues['relationship'])}>
                {RELATIONSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass} htmlFor="ins-dob">Subscriber DOB</label>
              <input id="ins-dob" type="date" data-testid="ins-dob" className={inputClass} value={form.subscriberDob} onChange={(e) => set('subscriberDob', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="ins-notes">Notes</label>
            <textarea id="ins-notes" data-testid="ins-notes" rows={2} className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" data-testid="ins-active" checked={form.active} onChange={(e) => set('active', e.target.checked)} className="w-4 h-4 rounded" />
              <span className="text-sm">Active</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 h-16 border-t flex-shrink-0">
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Cancel</button>
          <button
            type="button"
            data-testid="save-insurance-btn"
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 px-5 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Insurance'}
          </button>
        </div>
      </div>
    </div>
  );
}
