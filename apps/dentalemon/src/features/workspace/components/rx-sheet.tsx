/**
 * RxSheet — slide-up sheet for prescribing medication
 *
 * Fields: Drug name, RxNorm code (optional), Dosage, Frequency,
 *         Duration, Quantity, Instructions, Dispense as written
 *
 * Wireframe: docs/prd/context/wireframes/ws-rx-sheet.html
 */

import React, { useState } from 'react';
import { createPrescription } from '@monobase/sdk-ts/generated';

const FREQUENCY_OPTIONS = [
  'OD (once daily)',
  'BID (twice daily)',
  'TID (three times daily)',
  'QID (four times daily)',
  'PRN (as needed)',
  'Stat (immediately)',
] as const;

export interface RxSheetProps {
  visitId: string;
  patientId: string;
  prescriberMemberId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function RxSheet({ visitId, patientId, prescriberMemberId, open, onClose, onSaved }: RxSheetProps) {
  const [drugName, setDrugName] = useState('');
  const [rxNormCode, setRxNormCode] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [quantity, setQuantity] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dispenseAsWritten, setDispenseAsWritten] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

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
      await createPrescription({
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
        } as Parameters<typeof createPrescription>[0]['body'],
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
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
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
                className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none"
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
              className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none"
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
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save prescription'}
          </button>
        </div>
      </div>
    </div>
  );
}
