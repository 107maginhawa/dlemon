/**
 * ConsentSheet — slide-up sheet for consent form collection + e-signature
 *
 * Steps: select template → draw signature → submit (immutable after signing)
 *
 * Wireframe: docs/prd/context/wireframes/ws-consent-form.html
 */

import React, { useState, useRef, useEffect } from 'react';
import { createConsentForm, signConsentForm } from '@monobase/sdk-ts/generated';
import type { ConsentForm } from '@monobase/sdk-ts/generated';

const CONSENT_TEMPLATES = [
  { id: 'tpl-general', name: 'General Dental Consent' },
  { id: 'tpl-extraction', name: 'Tooth Extraction Consent' },
  { id: 'tpl-root-canal', name: 'Root Canal Consent' },
  { id: 'tpl-implant', name: 'Implant Surgery Consent' },
  { id: 'tpl-xray', name: 'Radiograph Consent' },
] as const;

export interface ConsentSheetProps {
  visitId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ConsentSheet({ visitId, patientId, open, onClose, onSaved }: ConsentSheetProps) {
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setTemplateId('');
      setTemplateName('');
      setSignatureData('');
      setSigned(false);
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
    const tmpl = CONSENT_TEMPLATES.find(t => t.id === e.target.value);
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
      // Create the form first
      const result = await createConsentForm({
        path: { visitId },
        body: { visitId, patientId, templateId, templateName } as Parameters<typeof createConsentForm>[0]['body'],
      });
      const form = result.data as ConsentForm;
      if (!form) { setError('Failed to create consent form'); return; }

      // Sign it
      await signConsentForm({
        path: { visitId, consentId: form.id },
        body: { signatureData } as Parameters<typeof signConsentForm>[0]['body'],
      });

      setSigned(true);
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
        className="relative w-full max-h-[80vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">Consent Form</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close consent form"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

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
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-[#FFE97D] outline-none disabled:opacity-50"
            >
              <option value="">Choose template…</option>
              {CONSENT_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
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
        </div>

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
            disabled={saving || signed || !signatureData}
            aria-label="Save consent form to visit record"
            className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save consent form'}
          </button>
        </div>
      </div>
    </div>
  );
}
