/**
 * ToothSlideout — stepper panel for recording tooth condition and treatment
 *
 * Steps: Overview → Treatment (CDT) → Review
 * The overview step handles per-surface condition assignment (focus surface → pick condition).
 * Slides in from the right; shrinks the main workspace area.
 *
 * Wireframe: docs/prd/context/wireframes/ws-tooth-slideout.html
 * Spec:      docs/superpowers/specs/2026-05-09-workspace-reconciliation-design.md §4.3
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import type { ToothSurface } from './five-surface-selector.helpers';
import { getSurfacesForTooth } from './five-surface-selector.helpers';
import type { ToothState, ChartEntryClassification } from './dental-chart.helpers';
import { getToothFillColor, getToothInfo } from './dental-chart.helpers';
import { ToothOverviewStep } from './tooth-overview-step';
import { CdtCodeBrowser } from './cdt-code-browser';
import type { CdtCodeSelection } from './cdt-code-browser';
import { AmendmentForm } from './amendment-form';
import { AmendmentsList } from './amendments-list';
import { logger } from '@/lib/logger';
import { FindingsPanel } from './findings-panel';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';

type Step = 'overview' | 'treatment' | 'review';

export interface ToothSlideoutData {
  state: ToothState;
  surfaces: ToothSurface[];
  cdtCode?: string;
  description?: string;
  /** Raw price string as entered by the user (e.g. "1500"). No cents conversion. */
  priceInput?: string;
  conditionCode?: string;
  /** Clinical notes from CDT browser. Persisted to backend via createDentalTreatment. */
  clinicalNotes?: string;
  /** Per-surface condition map for richer save data */
  surfaceConditionMap?: Record<string, ToothState>;
  /** Chart entry classification: how this finding should be categorized */
  entryClassification?: ChartEntryClassification;
}

export interface ToothSlideoutProps {
  toothNumber: number | null;
  patientId: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: ToothSlideoutData) => void | Promise<void>;
  /** Called after save when the user wants to record the next tooth without closing the panel. */
  onSaveAndNext?: () => void;
  readOnly?: boolean;
  /** Required when readOnly=true to enable amendment creation */
  visitId?: string;
  /** ID of the original treatment record being viewed (for amendment reference) */
  originalRecordId?: string;
  /** P0-D: why this tooth shows its current odontogram layer/color (derived from
   *  the same resolveToothLayer the chart uses, so it can't disagree). */
  layerExplanation?: { layer: string; label: string; reason: string };
}

export function ToothSlideout({ toothNumber, patientId, open, onClose, onSave, onSaveAndNext, readOnly, visitId, originalRecordId, layerExplanation }: ToothSlideoutProps) {
  // WCAG 2.4.3: Escape closes the slideout; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const [step, setStep] = useState<Step>('overview');
  // Per-surface condition state — replaces single state + surfaces[]
  const [surfaceConditions, setSurfaceConditions] = useState<Record<string, ToothState>>({});
  const [focusedSurface, setFocusedSurface] = useState<ToothSurface | null>(null);
  const [conditionCode, setConditionCode] = useState('');
  const [cdtCode, setCdtCode] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [entryClassification, setEntryClassification] = useState<ChartEntryClassification | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [showAmendment, setShowAmendment] = useState(false);
  // FIX-007: bump to refetch the read-only amendments list after a new one is saved.
  const [amendmentReloadToken, setAmendmentReloadToken] = useState(0);

  // Reset all step state when a different tooth is selected (D11)
  useEffect(() => {
    setStep('overview');
    setSurfaceConditions({});
    setFocusedSurface(null);
    setConditionCode('');
    setCdtCode('');
    setDescription('');
    setPriceInput('');
    setClinicalNotes('');
    setEntryClassification(undefined);
    setShowAmendment(false);
    setAmendmentReloadToken(0);
  }, [toothNumber, open]);

  // Build review summary: group surfaces by condition (must be before early returns)
  const conditionGroups = useMemo(() => {
    const groups: Record<string, ToothSurface[]> = {};
    for (const [surface, condition] of Object.entries(surfaceConditions)) {
      if (!groups[condition]) groups[condition] = [];
      groups[condition]!.push(surface as ToothSurface);
    }
    return groups;
  }, [surfaceConditions]);

  if (!open) return null;

  // Save & Next mode — tooth saved, waiting for next selection
  if (!toothNumber) {
    return (
      <aside
        data-testid="tooth-slideout"
        className="fixed right-0 top-[56px] bottom-[56px] w-[340px] flex flex-col border-l bg-card shadow-xl z-30"
        aria-label="Select next tooth"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-lg">Tooth saved</h2>
          <button type="button" onClick={onClose} aria-label="Close slideout" className="rounded p-1 hover:bg-secondary">✕</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
          <span className="text-4xl">🦷</span>
          <p className="text-sm font-medium">Tap a tooth on the chart to record the next finding</p>
        </div>
      </aside>
    );
  }

  // Derive primary state and surfaces from the surfaceConditions map (backward compatible)
  const assignedSurfaces = Object.keys(surfaceConditions) as ToothSurface[];
  // Primary state = most frequent condition, or first assigned
  const primaryState: ToothState | '' = (() => {
    if (assignedSurfaces.length === 0) return '';
    const counts: Record<string, number> = {};
    for (const s of assignedSurfaces) {
      const cond = surfaceConditions[s]!;
      counts[cond] = (counts[cond] ?? 0) + 1;
    }
    let maxCount = 0;
    let maxState = '';
    for (const [state, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxState = state;
      }
    }
    return maxState as ToothState;
  })();

  const steps: Step[] = ['overview', 'treatment', 'review'];
  const stepIdx = steps.indexOf(step);

  // FIX-007: an amendment may only be filed against a resolvable original record.
  // createAmendment requires originalRecordId to be a real UUID, so the affordance is
  // gated on having one (a read-only tooth with no treatment record on this visit
  // cannot be amended). The read-only amendments LIST is independent of this gate.
  const canAmend = !!(readOnly && visitId && originalRecordId);

  function handleFocusSurface(surface: ToothSurface) {
    setFocusedSurface(surface);
  }

  function handleAssignCondition(condition: ToothState) {
    if (!focusedSurface) return;
    setSurfaceConditions(prev => {
      // Toggle: if same condition, clear it; otherwise set it
      if (prev[focusedSurface] === condition) {
        const next = { ...prev };
        delete next[focusedSurface];
        return next;
      }
      return { ...prev, [focusedSurface]: condition };
    });

    // Auto-advance focus to next unassigned surface
    if (toothNumber) {
      const allSurfaces = getSurfacesForTooth(toothNumber);
      const currentIdx = allSurfaces.indexOf(focusedSurface);
      // Look for next unassigned surface after current
      for (let i = 1; i <= allSurfaces.length; i++) {
        const nextSurface = allSurfaces[(currentIdx + i) % allSurfaces.length]!;
        if (!surfaceConditions[nextSurface] && nextSurface !== focusedSurface) {
          setFocusedSurface(nextSurface);
          return;
        }
      }
      // All assigned — stay on current
    }
  }

  function handleCdtSelect(selection: CdtCodeSelection) {
    setCdtCode(selection.code);
    setDescription(selection.description);
    setPriceInput(String(selection.priceCents / 100));
    setClinicalNotes(selection.clinicalNotes);
    // Auto-advance to review after selection
    setStep('review');
  }

  function buildSaveData(): ToothSlideoutData {
    return {
      state: primaryState as ToothState,
      surfaces: assignedSurfaces,
      cdtCode: cdtCode || undefined,
      description: description || undefined,
      priceInput: priceInput || undefined,
      conditionCode: conditionCode || undefined,
      clinicalNotes: clinicalNotes || undefined,
      surfaceConditionMap: Object.keys(surfaceConditions).length > 0 ? { ...surfaceConditions } : undefined,
      entryClassification,
    };
  }

  async function handleSave() {
    // IN-04: allow a classification-only entry (e.g. "Existing") even with no surface
    // condition — matches the Save button's enable condition; avoids a silent no-op.
    if (!primaryState && !entryClassification) return;
    setSaving(true);
    try {
      await onSave(buildSaveData());
      onClose();
    } catch (err) {
      // Surface error — do NOT close so user can retry without losing data
      logger.error('tooth-slideout', 'save failed', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndNext() {
    // IN-04: see handleSave — a classification-only entry is a valid save.
    if (!primaryState && !entryClassification) return;
    setSaving(true);
    try {
      await onSave(buildSaveData());
      // Notify parent to clear tooth selection but keep panel open
      onSaveAndNext?.();
    } catch (err) {
      logger.error('tooth-slideout', 'save failed', err);
    } finally {
      setSaving(false);
    }
  }

  const stepLabels: Record<Step, string> = {
    overview: 'Overview',
    treatment: 'Treatment',
    review: 'Review',
  };

  return (
    <aside
      data-testid="tooth-slideout"
      className="fixed right-0 top-[56px] bottom-[56px] w-[340px] flex flex-col border-l bg-card shadow-xl overflow-y-auto z-30 lg:translate-x-0 max-lg:bottom-0 max-lg:top-0 max-lg:w-full max-lg:z-50 max-lg:pb-[env(safe-area-inset-bottom)]"
      style={{ transform: 'translateX(0)' }}
      aria-label={`Tooth ${toothNumber} details`}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div>
          <h2 className="font-bold text-lg leading-tight">Tooth #{toothNumber}</h2>
          <p className="text-sm text-muted-foreground">{getToothInfo(toothNumber).name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close slideout"
          className="rounded p-1 hover:bg-secondary mt-0.5"
        >
          ✕
        </button>
      </div>

      {/* P0-D: explain why this tooth shows its current odontogram color/layer. */}
      {layerExplanation && (
        <div
          data-testid="tooth-layer-explanation"
          data-layer={layerExplanation.layer}
          className="px-4 py-2 border-b bg-muted/30 text-xs"
        >
          <span className="font-semibold">{layerExplanation.label}</span>
          <span className="text-muted-foreground"> — {layerExplanation.reason}</span>
        </div>
      )}

      {/* Step indicator — numbered circles with connecting lines */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {steps.map((s, i) => {
          const isActive = step === s;
          const isCompleted = i < stepIdx;
          // A tab is navigable when it represents a completed or active step.
          // Unreachable (future) steps stay non-interactive. In readOnly mode the
          // tabs remain focusable for review (setStep just changes the viewed step;
          // the content is read-only) — we use aria-disabled + an opacity class
          // instead of the `disabled` attr so a clinician can keyboard-review them.
          const navigable = isCompleted || isActive;
          return (
            <React.Fragment key={s}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${isCompleted ? 'bg-green-400' : 'bg-border'}`} />
              )}
              <button
                type="button"
                onClick={() => navigable && setStep(s)}
                aria-disabled={!navigable}
                className={`flex flex-col items-center gap-1 shrink-0 ${navigable ? '' : 'opacity-50 cursor-not-allowed'}`}
              >
                <span
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                    isActive
                      ? 'bg-lemon text-foreground'
                      : isCompleted
                        ? 'bg-green-400 text-white'
                        : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {isCompleted ? '✓' : i + 1}
                </span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stepLabels[s]}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {step === 'overview' && (
          <ToothOverviewStep
            toothNumber={toothNumber}
            patientId={patientId}
            surfaceConditions={surfaceConditions}
            focusedSurface={focusedSurface}
            onFocusSurface={handleFocusSurface}
            onAssignCondition={handleAssignCondition}
            entryClassification={entryClassification}
            onSelectEntryClassification={setEntryClassification}
          />
        )}

        {/* P0-C: structured findings (curated vocabulary) for this tooth. */}
        {step === 'overview' && !readOnly && visitId && (
          <FindingsPanel visitId={visitId} toothNumber={toothNumber} patientId={patientId} />
        )}

        {step === 'treatment' && (
          <CdtCodeBrowser onSelect={handleCdtSelect} initialCode={cdtCode || undefined} />
        )}

        {step === 'review' && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border p-3 flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tooth</span>
                <span className="font-medium">{toothNumber}</span>
              </div>

              {/* Per-surface condition summary */}
              {Object.keys(conditionGroups).length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground">Conditions</span>
                  {Object.entries(conditionGroups).map(([condition, surfs]) => {
                    const dotColor = getToothFillColor(condition as ToothState);
                    return (
                      <div key={condition} className="flex items-center gap-2 pl-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="font-medium capitalize">{condition}</span>
                        <span className="text-muted-foreground text-xs capitalize">
                          ({surfs.join(', ')})
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State</span>
                  <span className="font-medium">—</span>
                </div>
              )}

              {conditionCode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ICD-10</span>
                  <span className="font-medium">{conditionCode}</span>
                </div>
              )}
              {cdtCode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CDT</span>
                  <span className="font-medium">{cdtCode}</span>
                </div>
              )}
              {description && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Treatment</span>
                  <span className="font-medium text-right">{description}</span>
                </div>
              )}
              {priceInput && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-medium">{CURRENCY_SYMBOL}{parseFloat(priceInput).toLocaleString(APP_LOCALE)}</span>
                </div>
              )}
              {clinicalNotes && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Notes</span>
                  <p className="text-foreground text-xs bg-secondary rounded p-2">{clinicalNotes}</p>
                </div>
              )}
            </div>

            {!primaryState && (
              <p className="text-xs text-destructive">Assign at least one surface condition before saving.</p>
            )}
          </div>
        )}
      </div>

      {/* FIX-007 / FR1.16: read-only review of this visit's amendments (corrections),
          surfaced alongside the original record. Consumes the previously-orphaned
          listAmendments. Visible whenever the visit is read-only, independent of
          whether THIS tooth has a record that can be amended. */}
      {readOnly && visitId && (
        <AmendmentsList visitId={visitId} reloadToken={amendmentReloadToken} />
      )}

      {/* Amendment form — shown inline when the user clicks "Add Amendment". Gated on a
          resolvable originalRecordId (the validator requires a real UUID — an empty id
          would 400). */}
      {readOnly && showAmendment && visitId && originalRecordId && (
        <AmendmentForm
          visitId={visitId}
          patientId={patientId}
          originalRecordType="tooth_treatment"
          originalRecordId={originalRecordId}
          onClose={() => setShowAmendment(false)}
          onSaved={() => {
            setShowAmendment(false);
            setAmendmentReloadToken((t) => t + 1);
          }}
        />
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between p-4 border-t gap-2">
        {readOnly ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
            >
              Close
            </button>
            {canAmend && !showAmendment && (
              <button
                type="button"
                onClick={() => setShowAmendment(true)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Add Amendment
              </button>
            )}
          </>
        ) : stepIdx > 0 ? (
          <button
            type="button"
            onClick={() => setStep(steps[stepIdx - 1]!)}
            className="px-4 py-2 min-h-[44px] rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        )}

        {/* Treatment step has its own Continue button inside CdtCodeBrowser */}
        {!readOnly && step !== 'treatment' && (stepIdx < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(steps[stepIdx + 1]!)}
            disabled={step === 'overview' && !primaryState}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-primary text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <div className="flex gap-2">
            {onSaveAndNext ? (
              <>
                {/* Multi-tooth flow: "Save & Next" is the primary (lemon) action;
                    plain "Save" becomes the secondary/outline action. */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || (!primaryState && !entryClassification)}
                  className="px-4 py-2 min-h-[44px] rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  disabled={saving || !primaryState}
                  className="px-4 py-2 min-h-[44px] rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
                  title="Save and record next tooth"
                >
                  {saving ? '…' : 'Save & Next'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (!primaryState && !entryClassification)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
