/**
 * ToothSlideout — stepper panel for recording tooth condition and treatment
 *
 * Steps: Condition → Surface → Treatment → Review
 * Slides in from the right; shrinks the main workspace area.
 *
 * Wireframe: docs/prd/context/wireframes/ws-tooth-slideout.html
 */

import React, { useState, useEffect } from 'react';
import { FiveSurfaceSelector } from './five-surface-selector.tsx';
import type { ToothSurface } from './five-surface-selector.helpers';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

type Step = 'condition' | 'surface' | 'treatment' | 'review';

const TOOTH_STATES = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'caries', label: 'Caries' },
  { value: 'fractured', label: 'Fractured' },
  { value: 'filled', label: 'Filled' },
  { value: 'crown', label: 'Crown' },
  { value: 'missing', label: 'Missing' },
  { value: 'implant', label: 'Implant' },
  { value: 'extracted', label: 'Extracted' },
  { value: 'watchlist', label: 'Watchlist' },
] as const;

export interface ToothSlideoutData {
  state: string;
  surfaces: ToothSurface[];
  cdtCode?: string;
  description?: string;
  /** Raw price string as entered by the user (e.g. "1500"). No cents conversion. */
  priceInput?: string;
  conditionCode?: string;
}

export interface ToothSlideoutProps {
  toothNumber: number | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: ToothSlideoutData) => void | Promise<void>;
  readOnly?: boolean;
}

export function ToothSlideout({ toothNumber, open, onClose, onSave, readOnly }: ToothSlideoutProps) {
  const [step, setStep] = useState<Step>('condition');
  const [state, setState] = useState('');
  const [conditionCode, setConditionCode] = useState('');
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [cdtCode, setCdtCode] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset all step state when a different tooth is selected (D11)
  useEffect(() => {
    setStep('condition');
    setState('');
    setConditionCode('');
    setSurfaces([]);
    setCdtCode('');
    setDescription('');
    setPriceInput('');
  }, [toothNumber]);

  if (!open || !toothNumber) return null;

  const steps: Step[] = ['condition', 'surface', 'treatment', 'review'];
  const stepIdx = steps.indexOf(step);

  function toggleSurface(surface: ToothSurface) {
    setSurfaces(prev =>
      prev.includes(surface) ? prev.filter(s => s !== surface) : [...prev, surface]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        state,
        surfaces,
        cdtCode: cdtCode || undefined,
        description: description || undefined,
        priceInput: priceInput || undefined,
        conditionCode: conditionCode || undefined,
      });
      onClose(); // only close on success
    } catch (err) {
      // Surface error — do NOT close so user can retry without losing data
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      data-testid="tooth-slideout"
      className="w-80 xl:w-96 flex flex-col border-l bg-background/95 backdrop-blur shrink-0 overflow-y-auto"
      aria-label={`Tooth ${toothNumber} details`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-base">Tooth {toothNumber}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close slideout"
          className="rounded p-1 hover:bg-secondary"
        >
          ✕
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex border-b">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={[
              'flex-1 py-2 text-xs font-medium capitalize border-b-2 transition-colors',
              step === s
                ? 'border-primary text-primary'
                : i < stepIdx
                  ? 'border-transparent text-muted-foreground/50'
                  : 'border-transparent text-muted-foreground',
            ].join(' ')}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 p-4 flex flex-col gap-4">
        {step === 'condition' && (
          <>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tooth State</label>
              <div className="grid grid-cols-3 gap-2">
                {TOOTH_STATES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setState(value)}
                    className={[
                      'rounded-lg border py-2 text-xs font-medium transition-colors',
                      state === value
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'border-border hover:bg-secondary',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="icd-code">ICD-10 Code (optional)</label>
              <input
                id="icd-code"
                type="text"
                value={conditionCode}
                onChange={e => setConditionCode(e.target.value)}
                placeholder="e.g. K02.0"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {step === 'surface' && (
          <FiveSurfaceSelector
            toothNumber={toothNumber}
            selectedSurfaces={surfaces}
            onToggle={toggleSurface}
          />
        )}

        {step === 'treatment' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="cdt-code">CDT Code (optional)</label>
              <input
                id="cdt-code"
                type="text"
                value={cdtCode}
                onChange={e => setCdtCode(e.target.value)}
                placeholder="e.g. D2391"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="treatment-desc">Description</label>
              <input
                id="treatment-desc"
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Resin composite, one surface"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="treatment-price">Price (₱)</label>
              <input
                id="treatment-price"
                type="number"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                placeholder="0"
                min="0"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border p-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tooth</span>
                <span className="font-medium">{toothNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">State</span>
                <span className="font-medium capitalize">{state || '—'}</span>
              </div>
              {surfaces.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surfaces</span>
                  <span className="font-medium capitalize">{surfaces.join(', ')}</span>
                </div>
              )}
              {cdtCode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CDT</span>
                  <span className="font-medium">{cdtCode}</span>
                </div>
              )}
              {priceInput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{CURRENCY_SYMBOL}{parseFloat(priceInput).toLocaleString(APP_LOCALE)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between p-4 border-t gap-2">
        {readOnly ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Close
          </button>
        ) : stepIdx > 0 ? (
          <button
            type="button"
            onClick={() => setStep(steps[stepIdx - 1]!)}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        )}

        {!readOnly && (stepIdx < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(steps[stepIdx + 1]!)}
            disabled={step === 'condition' && !state}
            className="px-4 py-2 rounded-lg bg-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !state}
            className="px-4 py-2 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        ))}
      </div>
    </aside>
  );
}
