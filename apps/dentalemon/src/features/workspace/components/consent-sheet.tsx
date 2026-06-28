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
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import {
  createConsentForm,
  signConsentForm,
  recordConsentRefusal,
  listConsentForms,
  listConsentRefusals,
  revokeConsentForm,
} from '@monobase/sdk-ts/generated';
import type { ConsentForm, InformedRefusal } from '@monobase/sdk-ts/generated';

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
  /**
   * Per-clinic consent wording (FR8.4b) — the actual consent text the patient
   * reads and signs, configured by the owner in Settings → Consent Forms. When
   * present, it is surfaced read-only on selection. Absent on the generic
   * name-only fallback options below.
   */
  body?: string;
}

type SheetMode = 'consent' | 'refusal' | 'history';

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
  /**
   * WF-035 — whether the current user may revoke a pending consent form. The
   * backend gates revoke to dentist_owner/dentist_associate; the parent passes
   * this so the Revoke affordance only appears for those roles (otherwise it
   * would surface a 403). The history view itself is visible to all roles.
   */
  canRevoke?: boolean;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ConsentSheet({ visitId, patientId, currentMemberId, templates, canRevoke = false, open, onClose, onSaved }: ConsentSheetProps) {
  const usingFallbackTemplates = !(templates && templates.length > 0);
  // Dedupe by name for the picker: dirty data (legacy reseeds left 20+ identical
  // rows per branch) would otherwise flood the dropdown with repeats. Keep the
  // first of each name — the Settings management screen still shows every row.
  const templateOptions: ReadonlyArray<ConsentTemplateOption> = (() => {
    const source = usingFallbackTemplates ? CONSENT_TEMPLATES : templates!;
    const seen = new Set<string>();
    return source.filter((t) => (seen.has(t.name) ? false : (seen.add(t.name), true)));
  })();
  // WCAG 2.4.3: Escape closes the sheet; focus returns to the opener on close.
  const { containerRef } = useSheetA11y({ open, onClose });

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

  // ── Consent history + revoke state (Batch B / FIX-004, WF-035) ─────────────
  const [historyForms, setHistoryForms] = useState<ConsentForm[]>([]);
  const [historyRefusals, setHistoryRefusals] = useState<InformedRefusal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [revokingId, setRevokingId] = useState('');

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
      setHistoryForms([]);
      setHistoryRefusals([]);
      setHistoryError('');
      setRevokingId('');
      setError('');
      clearCanvas();
    }
  }, [open]);

  // Load consent history when the History tab is opened (WF-035).
  useEffect(() => {
    if (open && mode === 'history') void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, visitId]);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const [formsRes, refusalsRes] = await Promise.all([
        listConsentForms({ path: { visitId } }),
        listConsentRefusals({ path: { visitId } }),
      ]);
      const forms =
        formsRes.data && 'data' in formsRes.data ? (formsRes.data.data as ConsentForm[]) : [];
      const refusals =
        refusalsRes.data && 'data' in refusalsRes.data
          ? (refusalsRes.data.data as InformedRefusal[])
          : [];
      setHistoryForms(forms);
      setHistoryRefusals(refusals);
    } catch {
      setHistoryError('Failed to load consent history');
    } finally {
      setHistoryLoading(false);
    }
  }

  /** Derived form status — pending forms are the only revocable ones (WF-035). */
  function consentStatus(form: ConsentForm): 'signed' | 'revoked' | 'pending' {
    if (form.signed) return 'signed';
    if (form.revoked) return 'revoked';
    return 'pending';
  }

  async function handleRevoke(form: ConsentForm) {
    setRevokingId(form.id);
    setHistoryError('');
    try {
      const res = await revokeConsentForm({ path: { visitId, cid: form.id } });
      if ((res as { error?: unknown }).error) {
        setHistoryError('Failed to revoke consent form');
        return;
      }
      // Re-read so the row flips signed/pending → revoked and the action drops.
      await loadHistory();
      onSaved?.();
    } catch {
      setHistoryError('Failed to revoke consent form');
    } finally {
      setRevokingId('');
    }
  }

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
      toast.success('Consent recorded');
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err, 'Could not save the consent form');
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

  // The clinic-configured template currently selected (carries the per-clinic
  // `body` wording). Generic fallback options have no body.
  const selectedTemplate = templateOptions.find(t => t.id === templateId);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
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
        <div className="flex gap-1 px-5 pt-3 flex-shrink-0" role="tablist" aria-label="Consent, refusal, or history">
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
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'history'}
            onClick={() => { setMode('history'); setError(''); }}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${
              mode === 'history'
                ? 'bg-foreground text-background'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/70'
            }`}
          >
            History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {mode === 'consent' && (
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
                  className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:opacity-50"
                >
                  <option value="">Choose template…</option>
                  {templateOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {usingFallbackTemplates && (
                  <p
                    data-testid="consent-template-fallback-hint"
                    className="mt-1.5 text-xs text-amber-700"
                  >
                    Using default templates. Add your clinic&apos;s own wording in
                    Settings → Consent Forms for per-clinic consent text.
                  </p>
                )}
              </div>

              {/* Per-clinic consent wording (FR8.4b) — read-only reference text the
                  patient reads and signs; shown when a configured template is chosen. */}
              {selectedTemplate?.body && (
                <div className="rounded-xl border border-border bg-secondary/20 px-3.5 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Clinic consent wording
                  </p>
                  <p
                    data-testid="consent-template-body"
                    className="text-sm whitespace-pre-wrap break-words text-foreground/90"
                  >
                    {selectedTemplate.body}
                  </p>
                </div>
              )}

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
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none disabled:opacity-50"
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
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none disabled:opacity-50"
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
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none disabled:opacity-50"
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
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none disabled:opacity-50"
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
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none disabled:opacity-50"
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
          )}

          {mode === 'refusal' && (
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
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
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
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
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
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none resize-none"
                />
              </div>

              {refusalRecorded && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                  ✓ Informed refusal recorded
                </div>
              )}
            </>
          )}

          {mode === 'history' && (
            <>
              {historyError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {historyError}
                </div>
              )}
              {historyLoading && (
                <p className="text-sm text-muted-foreground">Loading consent history…</p>
              )}
              {!historyLoading && historyForms.length === 0 && historyRefusals.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No consent records for this visit yet.
                </p>
              )}

              {historyForms.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Consent forms
                  </p>
                  {historyForms.map((form) => {
                    const status = consentStatus(form);
                    const statusStyle =
                      status === 'signed'
                        ? 'bg-green-100 text-green-800'
                        : status === 'revoked'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-amber-100 text-amber-800';
                    return (
                      <div
                        key={form.id}
                        data-testid={`consent-history-form-${form.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{form.templateName}</p>
                          <span
                            data-testid={`consent-status-${form.id}`}
                            className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle}`}
                          >
                            {status}
                          </span>
                        </div>
                        {canRevoke && status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(form)}
                            disabled={revokingId === form.id}
                            aria-label={`Revoke ${form.templateName}`}
                            className="flex-shrink-0 h-8 px-3 rounded-lg border border-destructive/40 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {revokingId === form.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {historyRefusals.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Informed refusals
                  </p>
                  {historyRefusals.map((refusal) => (
                    <div
                      key={refusal.id}
                      data-testid={`consent-history-refusal-${refusal.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/20 px-3.5 py-2.5"
                    >
                      <p className="text-sm font-medium min-w-0 truncate">
                        {refusal.procedureDescription}
                      </p>
                      <span className="flex-shrink-0 inline-block rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                        Refused
                      </span>
                    </div>
                  ))}
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
          {mode === 'consent' && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || signed || !signatureData}
              aria-label="Save consent form to visit record"
              className="flex-1 h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save consent form'}
            </button>
          )}
          {mode === 'refusal' && (
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
