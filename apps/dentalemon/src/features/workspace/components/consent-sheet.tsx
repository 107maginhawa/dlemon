/**
 * ConsentSheet — slide-up sheet for consent form collection + e-signature
 *
 * Two modes (P1-3):
 *  - "consent" : select template → structured content (nature/benefits/risks/
 *                alternatives/risks-of-non-treatment) → draw signature → submit
 *                (immutable after signing, BR-014).
 *  - "refusal" : informed-refusal path — record the patient's explicit, attributed
 *                refusal of recommended treatment (procedure, reason, acknowledgement).
 *                Distinct from a granted consent; immutable once recorded.
 *
 * Wireframe: docs/prd/context/wireframes/ws-consent-form.html
 */

import React, { useState, useRef, useEffect } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import { createConsentForm, signConsentForm, recordConsentRefusal } from '@monobase/sdk-ts/generated';
import type { ConsentForm } from '@monobase/sdk-ts/generated';

// FR8.4b fallback only: used when the clinic has not configured any consent
// templates (or no branch is in context). Once an owner adds templates in
// Settings → Consent Forms, those are passed in via `templates` and these
// hardcoded names are not shown. Hardcoded legal text must not be the source
// of truth for a clinic that has configured its own.
const CONSENT_TEMPLATES = [
  { id: 'tpl-general', name: 'General Dental Consent' },
  { id: 'tpl-extraction', name: 'Tooth Extraction Consent' },
  { id: 'tpl-root-canal', name: 'Root Canal Consent' },
  { id: 'tpl-implant', name: 'Implant Surgery Consent' },
  { id: 'tpl-xray', name: 'Radiograph Consent' },
] as const;

export interface ConsentTemplateOption {
  id: string;
  name: string;
}

type SheetMode = 'consent' | 'refusal';

export interface ConsentSheetProps {
  visitId: string;
  patientId: string;
  /** Member who presents the treatment — attributed on an informed refusal record */
  currentMemberId?: string;
  /**
   * Branch-configured consent templates (FR8.4b). When present and non-empty,
   * these replace the hardcoded fallback list so each clinic presents its own
   * consent text. Sourced by the parent via useConsentTemplates(branchId).
   */
  templates?: ConsentTemplateOption[];
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ConsentSheet({ visitId, patientId, currentMemberId, templates, open, onClose, onSaved }: ConsentSheetProps) {
  const templateOptions: ReadonlyArray<ConsentTemplateOption> =
    templates && templates.length > 0 ? templates : CONSENT_TEMPLATES;
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  useSheetA11y({ open, onClose });

  const [mode, setMode] = useState<SheetMode>('consent');

  // ── Consent (grant) state ──────────────────────────────────────────────
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  // ADA-required structured consent content (P1-3)
  const [procedureNature, setProcedureNature] = useState('');
  const [benefits, setBenefits] = useState('');
  const [risks, setRisks] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [risksOfNonTreatment, setRisksOfNonTreatment] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [signed, setSigned] = useState(false);

  // ── Refusal state ──────────────────────────────────────────────────────
  const [procedureDescription, setProcedureDescription] = useState('');
  const [refusalReason, setRefusalReason] = useState('');
  const [patientAcknowledgement, setPatientAcknowledgement] = useState('');
  const [refusalRecorded, setRefusalRecorded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setMode('consent');
      setTemplateId('');
      setTemplateName('');
      setProcedureNature('');
      setBenefits('');
      setRisks('');
      setAlternatives('');
      setRisksOfNonTreatment('');
      setSignatureData('');
      setSigned(false);
      setProcedureDescription('');
      setRefusalReason('');
      setPatientAcknowledgement('');
      setRefusalRecorded(false);
      setError('');
      clearCanvas();
    }
  }, [open]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  }

  function handleSelectTemplate(e: React.ChangeEvent<HTMLSelectElement>) {
    const tmpl = templateOptions.find(t => t.id === e.target.value);
    setTemplateId(e.target.value);
    setTemplateName(tmpl?.name ?? '');
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (signed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current || signed) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext('2d')!;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function stopDraw() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignatureData(canvas.toDataURL());
  }

  async function handleSave() {
    if (!templateId) { setError('Please select a consent form template'); return; }
    if (!signatureData) { setError('Please provide a signature'); return; }
    if (signed) { setError('This consent form has already been signed'); return; }
    setError('');
    setSaving(true);
    try {
      // Create the form first (with structured content fields)
      const result = await createConsentForm({
        path: { visitId },
        body: {
          visitId,
          patientId,
          templateId,
          templateName,
          procedureNature: procedureNature.trim() || undefined,
          benefits: benefits.trim() || undefined,
          risks: risks.trim() || undefined,
          alternatives: alternatives.trim() || undefined,
          risksOfNonTreatment: risksOfNonTreatment.trim() || undefined,
        } as Parameters<typeof createConsentForm>[0]['body'],
      });
      const form = result.data as ConsentForm;
      if (!form) { setError('Failed to create consent form'); return; }

      // Sign it
      const signResult = await signConsentForm({
        path: { visitId, consentId: form.id },
        body: { signatureData } as Parameters<typeof signConsentForm>[0]['body'],
      });
      if ((signResult as { error?: unknown }).error) { setError('Failed to sign consent form'); return; }

      setSigned(true);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordRefusal() {
    if (!procedureDescription.trim()) { setError('Describe the treatment being refused'); return; }
    if (!refusalReason.trim()) { setError("Record the patient's reason for refusing"); return; }
    if (!patientAcknowledgement.trim()) { setError('Capture the patient acknowledgement'); return; }
    if (!currentMemberId) { setError('No clinician on record to attribute this refusal'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await recordConsentRefusal({
        path: { visitId },
        body: {
          visitId,
          patientId,
          refusingMemberId: currentMemberId,
          procedureDescription: procedureDescription.trim(),
          refusalReason: refusalReason.trim(),
          patientAcknowledgement: patientAcknowledgement.trim(),
        } as Parameters<typeof recordConsentRefusal>[0]['body'],
      });
      if ((result as { error?: unknown }).error || !result.data) {
        setError('Failed to record informed refusal');
        return;
      }
      setRefusalRecorded(true);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="Consent form sheet"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        data-testid="consent-sheet"
        className="relative w-full max-h-[85vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">
            {mode === 'consent' ? 'Consent Form' : 'Informed Refusal'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close consent form"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0" role="tablist" aria-label="Consent or refusal">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'consent'}
            onClick={() => { setMode('consent'); setError(''); }}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'consent'
                ? 'bg-lemon text-lemon-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
            }`}
          >
            Consent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'refusal'}
            onClick={() => { setMode('refusal'); setError(''); }}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'refusal'
                ? 'bg-destructive/15 text-destructive'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
            }`}
          >
            Informed Refusal
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === 'consent' ? (
            <>
              {/* Template selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="consent-template">
                  Consent Form Template *
                </label>
                <select
                  id="consent-template"
                  value={templateId}
                  onChange={handleSelectTemplate}
                  disabled={signed}
                  aria-label="Select consent form template"
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none disabled:opacity-50"
                >
                  <option value="">Choose template…</option>
                  {templateOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* ADA structured content (P1-3) */}
              <div className="rounded-xl border border-border bg-secondary/20 px-3.5 py-3 flex flex-col gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Informed-consent discussion
                </p>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="consent-nature">
                    Nature of procedure
                  </label>
                  <textarea
                    id="consent-nature"
                    value={procedureNature}
                    onChange={e => setProcedureNature(e.target.value)}
                    disabled={signed}
                    rows={2}
                    placeholder="What the procedure involves…"
                    aria-label="Nature of procedure"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="consent-benefits">
                    Benefits
                  </label>
                  <textarea
                    id="consent-benefits"
                    value={benefits}
                    onChange={e => setBenefits(e.target.value)}
                    disabled={signed}
                    rows={2}
                    placeholder="Expected benefits…"
                    aria-label="Benefits"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="consent-risks">
                    Risks
                  </label>
                  <textarea
                    id="consent-risks"
                    value={risks}
                    onChange={e => setRisks(e.target.value)}
                    disabled={signed}
                    rows={2}
                    placeholder="Material risks…"
                    aria-label="Risks"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="consent-alternatives">
                    Alternatives
                  </label>
                  <textarea
                    id="consent-alternatives"
                    value={alternatives}
                    onChange={e => setAlternatives(e.target.value)}
                    disabled={signed}
                    rows={2}
                    placeholder="Reasonable alternatives…"
                    aria-label="Alternatives"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="consent-nontreatment">
                    Risks of non-treatment
                  </label>
                  <textarea
                    id="consent-nontreatment"
                    value={risksOfNonTreatment}
                    onChange={e => setRisksOfNonTreatment(e.target.value)}
                    disabled={signed}
                    rows={2}
                    placeholder="What happens if untreated…"
                    aria-label="Risks of non-treatment"
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Signature canvas */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Patient Signature *
                  </label>
                  {!signed && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      aria-label="Clear signature"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-secondary/30">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    aria-label="Signature canvas — signed by patient"
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={stopDraw}
                    onPointerLeave={stopDraw}
                  />
                </div>
                {!signatureData && (
                  <p className="text-xs text-muted-foreground mt-1">Draw signature above</p>
                )}
                {signatureData && !signed && (
                  <p className="text-xs text-green-600 mt-1">Signature captured</p>
                )}
              </div>

              {signed && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  ✓ Consent form signed and saved
                </div>
              )}
            </>
          ) : (
            <>
              {/* Informed refusal form */}
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs text-muted-foreground">
                Records the patient&apos;s explicit refusal of recommended treatment with
                attribution and timestamp. This is distinct from a granted consent and is
                immutable once recorded.
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="refusal-procedure">
                  Treatment refused *
                </label>
                <textarea
                  id="refusal-procedure"
                  value={procedureDescription}
                  onChange={e => setProcedureDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Extraction of tooth #48"
                  aria-label="Treatment refused"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-lemon outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="refusal-reason">
                  Reason for refusal *
                </label>
                <textarea
                  id="refusal-reason"
                  value={refusalReason}
                  onChange={e => setRefusalReason(e.target.value)}
                  rows={2}
                  placeholder="Patient's stated reason…"
                  aria-label="Reason for refusal"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-lemon outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="refusal-ack">
                  Patient acknowledgement *
                </label>
                <textarea
                  id="refusal-ack"
                  value={patientAcknowledgement}
                  onChange={e => setPatientAcknowledgement(e.target.value)}
                  rows={2}
                  placeholder="I understand the risks of declining treatment and choose to do so."
                  aria-label="Patient acknowledgement"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:border-lemon outline-none resize-none"
                />
              </div>

              {refusalRecorded && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  ✓ Informed refusal recorded
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          {mode === 'consent' ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || signed || !signatureData}
              aria-label="Save consent form to visit record"
              className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save consent form'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRecordRefusal}
              disabled={saving}
              aria-label="Record informed refusal to visit record"
              className="flex-1 h-11 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Recording…' : 'Record refusal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
