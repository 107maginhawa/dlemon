/**
 * RxSheet — slide-up sheet for prescribing medication
 *
 * Fields: Drug name, RxNorm code (optional), Dosage, Frequency,
 *         Duration, Quantity, Instructions, Dispense as written
 *
 * QW-1/P1-1: when the server returns warnings.allergyConflicts the sheet
 * shows a prominent alert banner and requires an explicit clinician
 * acknowledgment before calling onSaved/onClose.
 *
 * Wireframe: docs/prd/context/wireframes/ws-rx-sheet.html
 */

import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { createPrescription, type Prescription } from '@monobase/sdk-ts/generated';

const FREQUENCY_OPTIONS = [
  'OD (once daily)',
  'BID (twice daily)',
  'TID (three times daily)',
  'QID (four times daily)',
  'PRN (as needed)',
  'Stat (immediately)',
] as const;

/** P2-13: DEA controlled-substance schedule (21 CFR 1308). `none` is the
 *  default for non-controlled drugs (incl. the ₱/PH flow). Record-only. */
const SCHEDULE_OPTIONS = [
  { value: 'none', label: 'None (not controlled)' },
  { value: 'II', label: 'Schedule II' },
  { value: 'III', label: 'Schedule III' },
  { value: 'IV', label: 'Schedule IV' },
  { value: 'V', label: 'Schedule V' },
] as const;

type ControlledSubstanceSchedule = (typeof SCHEDULE_OPTIONS)[number]['value'];

/** Narrow local type for the subset of the response that carries warnings.
 *  The generated Prescription type omits `warnings` because it is not yet in
 *  the OpenAPI spec — we read it via an intersection cast so we do not touch
 *  any generated file. */
type DrugInteraction = {
  interactingDrug: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
};

// Intersect the SDK Prescription with the `warnings` enrichment the spec omits
// (oli QA_ESCAPES §6 — the documented stale-spec / enrichment pattern), so tsc
// still checks the base prescription fields. TODO(spec): add `warnings` to the
// create-prescription response schema, regenerate, then drop the intersection.
type PrescriptionWithWarnings = Prescription & {
  warnings?: {
    allergyConflicts?: string[];
    /** P1-2: drug-drug interactions against active medications */
    drugInteractions?: DrugInteraction[];
  };
};

export interface RxSheetProps {
  visitId: string;
  patientId: string;
  prescriberMemberId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RxSheet({ visitId, patientId, prescriberMemberId, open, onClose, onSaved }: RxSheetProps) {
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const [drugName, setDrugName] = useState('');
  const [rxNormCode, setRxNormCode] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [quantity, setQuantity] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dispenseAsWritten, setDispenseAsWritten] = useState(false);
  // P2-13: US-context legal Rx fields (record-only). Optional + additive.
  const [controlledSubstanceSchedule, setControlledSubstanceSchedule] = useState<ControlledSubstanceSchedule>('none');
  const [prescriberDea, setPrescriberDea] = useState('');
  const [prescriberNpi, setPrescriberNpi] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /** Non-empty when the server flagged allergy conflicts; clinician must acknowledge. */
  const [allergyConflicts, setAllergyConflicts] = useState<string[]>([]);
  /** Non-empty when the server flagged drug-drug interactions; clinician must acknowledge. */
  const [drugInteractions, setDrugInteractions] = useState<DrugInteraction[]>([]);

  if (!open) return null;

  function validate(): string[] {
    const errs: string[] = [];
    if (!drugName.trim()) errs.push('Drug name is required');
    if (!dosage.trim()) errs.push('Dosage is required');
    if (!frequency.trim()) errs.push('Frequency is required');
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    try {
      const result = await createPrescription({
        path: { visitId },
        body: {
          visitId,
          patientId,
          prescriberMemberId,
          drugName: drugName.trim(),
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          rxNormCode: rxNormCode.trim() || undefined,
          duration: duration.trim() || undefined,
          quantity: quantity.trim() || undefined,
          instructions: instructions.trim() || undefined,
          dispenseAsWritten,
          // P2-13: only send schedule when controlled; DEA/NPI when provided.
          controlledSubstanceSchedule:
            controlledSubstanceSchedule !== 'none' ? controlledSubstanceSchedule : undefined,
          prescriberDea: prescriberDea.trim() || undefined,
          prescriberNpi: prescriberNpi.trim() || undefined,
        } as Parameters<typeof createPrescription>[0]['body'],
      });

      // QW-1/P1-1: surface drug-allergy conflicts returned by the server.
      // P1-2: also surface drug-drug interaction warnings.
      // The generated type omits `warnings`; a single narrowing `as` widens to the
      // intersection above (no blind `as unknown as` — GAP-D).
      const data = result.data as PrescriptionWithWarnings | undefined;
      const conflicts = data?.warnings?.allergyConflicts ?? [];
      const interactions = data?.warnings?.drugInteractions ?? [];
      if (conflicts.length > 0 || interactions.length > 0) {
        // Prescription was saved — hold the sheet open and require acknowledgment.
        if (conflicts.length > 0) setAllergyConflicts(conflicts);
        if (interactions.length > 0) setDrugInteractions(interactions);
        return;
      }

      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleAcknowledge() {
    setAllergyConflicts([]);
    setDrugInteractions([]);
    onSaved?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Prescription sheet"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        data-testid="rx-sheet"
        className="relative w-full max-h-[75vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">Prescription</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close prescription sheet"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.map(e => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* QW-1/P1-1 — Allergy conflict warning banner */}
          {allergyConflicts.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg bg-amber-50 border-2 border-amber-400 px-4 py-3 flex flex-col gap-2"
            >
              <p className="text-sm font-semibold text-amber-900">
                Allergy conflict: {allergyConflicts.join(', ')}
              </p>
              <p className="text-xs text-amber-800">
                This patient has a recorded allergy to the prescribed drug or a related substance.
                Review the patient&apos;s allergy history before proceeding.
              </p>
              {drugInteractions.length === 0 && (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  className="self-start mt-1 px-4 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
                  aria-label="Acknowledge conflict and prescribe anyway"
                >
                  Prescribe anyway
                </button>
              )}
            </div>
          )}

          {/* P1-2 — Drug-drug interaction warning banner */}
          {drugInteractions.length > 0 && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-lg bg-orange-50 border-2 border-orange-400 px-4 py-3 flex flex-col gap-2"
            >
              <p className="text-sm font-semibold text-orange-900">
                Drug interaction warning
              </p>
              <ul className="text-xs text-orange-800 flex flex-col gap-1.5 list-none">
                {drugInteractions.map((interaction, i) => (
                  <li key={i} className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {interaction.interactingDrug}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        interaction.severity === 'major'
                          ? 'bg-red-100 text-red-700'
                          : interaction.severity === 'moderate'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {interaction.severity}
                      </span>
                    </span>
                    <span>{interaction.description}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-orange-700 italic">
                Note: interaction data is curated for dental use — not a comprehensive drug database.
              </p>
              <button
                type="button"
                onClick={handleAcknowledge}
                className="self-start mt-1 px-4 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
                aria-label="Acknowledge drug interaction and prescribe anyway"
              >
                Prescribe anyway
              </button>
            </div>
          )}

          {/* Drug name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-drug-name">
              Drug Name *
            </label>
            <input
              id="rx-drug-name"
              type="text"
              value={drugName}
              onChange={e => setDrugName(e.target.value)}
              placeholder="e.g. Amoxicillin"
              aria-label="Drug name"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>

          {/* RxNorm code */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-norm-code">
              RxNorm Code (optional)
            </label>
            <input
              id="rx-norm-code"
              type="text"
              value={rxNormCode}
              onChange={e => setRxNormCode(e.target.value)}
              placeholder="e.g. 723"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>

          {/* Dosage + Frequency side by side */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-dosage">
                Dosage *
              </label>
              <input
                id="rx-dosage"
                type="text"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                placeholder="e.g. 500mg"
                aria-label="Dosage"
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-frequency">
                Frequency *
              </label>
              <select
                id="rx-frequency"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                aria-label="Frequency selection"
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
              >
                <option value="">Select…</option>
                {FREQUENCY_OPTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-duration">
              Duration (optional)
            </label>
            <input
              id="rx-duration"
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 7 days"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-quantity">
              Quantity (optional)
            </label>
            <input
              id="rx-quantity"
              type="text"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="e.g. 21 tablets"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-instructions">
              Instructions (optional)
            </label>
            <textarea
              id="rx-instructions"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Prescription instructions…"
              rows={2}
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-lemon outline-none resize-none"
            />
          </div>

          {/* Dispense as written */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dispenseAsWritten}
              onChange={e => setDispenseAsWritten(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Dispense as written (no substitution)</span>
          </label>

          {/* P2-13 — Legal fields (US-context, optional). Hidden from the
              non-controlled PH flow until needed; kept compact + optional. */}
          <fieldset className="mt-1 rounded-xl border border-border p-3 flex flex-col gap-3">
            <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Legal (US, optional)
            </legend>

            {/* Controlled-substance schedule */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-cs-schedule">
                Controlled-Substance Schedule
              </label>
              <select
                id="rx-cs-schedule"
                value={controlledSubstanceSchedule}
                onChange={e => setControlledSubstanceSchedule(e.target.value as ControlledSubstanceSchedule)}
                aria-label="Controlled-substance schedule"
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
              >
                {SCHEDULE_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* DEA + NPI side by side */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-dea">
                  Prescriber DEA
                </label>
                <input
                  id="rx-dea"
                  type="text"
                  value={prescriberDea}
                  onChange={e => setPrescriberDea(e.target.value)}
                  placeholder="e.g. AB1234567"
                  aria-label="Prescriber DEA number"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="rx-npi">
                  Prescriber NPI
                </label>
                <input
                  id="rx-npi"
                  type="text"
                  value={prescriberNpi}
                  onChange={e => setPrescriberNpi(e.target.value)}
                  placeholder="10-digit NPI"
                  aria-label="Prescriber NPI"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
                />
              </div>
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || allergyConflicts.length > 0 || drugInteractions.length > 0}
            className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save prescription'}
          </button>
        </div>
      </div>
    </div>
  );
}
