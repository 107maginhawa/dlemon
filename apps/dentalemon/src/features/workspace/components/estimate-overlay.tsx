/**
 * EstimateOverlay — Phase 2B/2C.
 *
 * Renders the patient's treatment plan as a formal, print-ready Estimate
 * (EstimateDocument) and adds in-person approval: the patient signs on the iPad
 * (the same canvas pattern as ConsentSheet), which creates + signs a consent form
 * and links it to an immutable TreatmentPlanVersion via acceptTreatmentPlan
 * (sets consent_form.acceptedPlanVersionId server-side).
 *
 * Approval is detected durably (on reopen) by the presence of a *signed* consent
 * form created from the plan-approval template — acceptedPlanVersionId is not on
 * the wire, so the template id is the approval marker.
 */
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastError } from '@/lib/error-toast';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';
import {
  createConsentForm,
  signConsentForm,
  acceptTreatmentPlan,
  listConsentForms,
} from '@monobase/sdk-ts/generated';
import type { ConsentForm } from '@monobase/sdk-ts/generated';
import { EstimateDocument, type EstimateLineItem } from './estimate-document';
import type { TreatmentPlanItem } from '../hooks/use-treatment-plan';

// The estimate is the proposed-care document: diagnosed + planned work, never
// declined/dismissed (those are excluded from what the patient is asked to approve).
const PROPOSED_STATUSES = new Set(['diagnosed', 'planned']);

// Marker template for a treatment-plan approval signature. Distinct from clinical
// consent templates so the durable approved-state lookup can find it.
const APPROVAL_TEMPLATE_ID = 'tpl-treatment-plan-approval';
const APPROVAL_TEMPLATE_NAME = 'Treatment Plan Approval';

export interface EstimateOverlayProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  branchId: string | null;
  /** Current visit — approval is visit-anchored; null disables Approve & Sign. */
  visitId: string | null;
  patientName?: string;
  clinicName?: string;
  planItems: TreatmentPlanItem[];
  /** Latest accepted plan version (getTreatmentPlan.version) — 0 if none. */
  version: number;
}

export function EstimateOverlay({
  open,
  onClose,
  patientId,
  branchId,
  visitId,
  patientName,
  clinicName,
  planItems,
  version,
}: EstimateOverlayProps) {
  const { containerRef } = useSheetA11y({ open, onClose });

  const [signing, setSigning] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [approved, setApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState<string | Date | undefined>();
  const [approvedSignature, setApprovedSignature] = useState<string | undefined>();
  const [approvedVersion, setApprovedVersion] = useState<number | undefined>();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Reset transient state when the overlay closes.
  useEffect(() => {
    if (!open) {
      setSigning(false);
      setSignatureData('');
      setSaving(false);
      setError('');
    }
  }, [open]);

  // Durable approved-state: a signed plan-approval consent for this visit.
  useEffect(() => {
    if (!open || !visitId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listConsentForms({ path: { visitId } });
        const forms =
          res.data && 'data' in res.data ? (res.data.data as ConsentForm[]) : [];
        const approval = forms.find(
          (f) => f.signed && f.templateId === APPROVAL_TEMPLATE_ID,
        );
        if (!cancelled && approval) {
          setApproved(true);
          setApprovedAt(approval.signedAt);
          setApprovedSignature(approval.signatureData);
        }
      } catch {
        // Non-fatal: estimate still renders as a draft if the lookup fails.
      }
    })();
    return () => { cancelled = true; };
  }, [open, visitId]);

  const lineItems: EstimateLineItem[] = planItems
    .filter((t) => PROPOSED_STATUSES.has(t.status))
    .map((t) => ({
      toothNumber: t.toothNumber,
      cdtCode: t.cdtCode,
      description: t.description,
      priceCents: t.priceCents,
    }));
  const totalCents = lineItems.reduce((sum, i) => sum + i.priceCents, 0);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const ctx = e.currentTarget.getContext('2d')!;
    const rect = e.currentTarget.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const ctx = e.currentTarget.getContext('2d')!;
    const rect = e.currentTarget.getBoundingClientRect();
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

  async function handleConfirmSign() {
    if (!visitId) { setError('Start a visit to capture approval'); return; }
    if (!signatureData) { setError('Please capture the patient signature'); return; }
    setError('');
    setSaving(true);
    try {
      const created = await createConsentForm({
        path: { visitId },
        body: {
          visitId,
          patientId,
          templateId: APPROVAL_TEMPLATE_ID,
          templateName: APPROVAL_TEMPLATE_NAME,
        } as Parameters<typeof createConsentForm>[0]['body'],
      });
      const form = created.data as ConsentForm | undefined;
      if (!form?.id) { setError('Could not create the approval record'); return; }

      const signRes = await signConsentForm({
        path: { visitId, consentId: form.id },
        body: { signatureData } as Parameters<typeof signConsentForm>[0]['body'],
      });
      if ((signRes as { error?: unknown }).error) { setError('Could not record the signature'); return; }

      // Snapshot the live plan into an immutable version and link the signed
      // consent (sets acceptedPlanVersionId server-side).
      const accepted = await acceptTreatmentPlan({
        path: { patientId },
        query: { branchId: branchId ?? '' },
        body: { consentFormId: form.id },
        throwOnError: true,
      });

      setApproved(true);
      setApprovedAt(new Date().toISOString());
      setApprovedSignature(signatureData);
      setApprovedVersion((accepted.data as { version?: number } | undefined)?.version);
      setSigning(false);
      toast.success('Estimate approved & signed');
    } catch (err) {
      toastError(err, 'Could not approve the estimate');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const estimateNo = approved
    ? `EST-${String(approvedVersion ?? version).padStart(4, '0')}`
    : 'DRAFT';

  return (
    <div
      ref={containerRef}
      data-testid="estimate-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Treatment estimate"
      className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4 print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-3xl rounded-lg bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-end gap-2 border-b px-4 py-2 print:hidden">
          <button
            type="button"
            data-testid="estimate-print"
            onClick={() => window.print()}
            className="rounded-lg bg-lemon px-3 py-1.5 text-xs font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors"
          >
            Print / PDF
          </button>
          <button
            type="button"
            data-testid="estimate-close"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>

        <EstimateDocument
          estimateNo={estimateNo}
          date={approved && approvedAt ? approvedAt : new Date()}
          patientName={patientName}
          clinicName={clinicName}
          lineItems={lineItems}
          totalCents={totalCents}
          approved={approved}
          signatureDataUrl={approvedSignature}
          signedAt={approvedAt}
        />

        {/* Approval controls — hidden in print and once approved */}
        {!approved && (
          <div className="border-t px-6 py-4 print:hidden">
            {error && (
              <p className="mb-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {!signing ? (
              <button
                type="button"
                data-testid="estimate-approve-btn"
                onClick={() => setSigning(true)}
                disabled={!visitId || lineItems.length === 0}
                title={!visitId ? 'Start a visit to capture approval' : undefined}
                className="h-11 w-full rounded-xl bg-lemon text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve &amp; Sign
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Patient signature
                  </span>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSigning(false); clearCanvas(); setError(''); }}
                    className="h-11 flex-1 rounded-xl border border-border text-sm hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="estimate-sign-confirm"
                    onClick={handleConfirmSign}
                    disabled={saving || !signatureData}
                    className="h-11 flex-1 rounded-xl bg-lemon text-sm font-semibold text-lemon-foreground hover:bg-lemon-hover transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Confirm approval'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
