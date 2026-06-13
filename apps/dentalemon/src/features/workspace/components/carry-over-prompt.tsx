/**
 * CarryOverPrompt — FIX-002 (Batch B) carry-over affordance.
 *
 * Placement (product-decisions.md Q2): the returning-patient / new-visit entry point.
 *
 * Mechanism (restore-dismissed): the visit-completion gate (updateDentalVisit) forbids
 * completing a visit that still has diagnosed/planned treatments, so a completed prior
 * visit never carries pending work forward via auto-discovery. The functional, FR1.11
 * path is "dismiss-to-defer → restore next visit". When a returning patient has DEFERRED
 * (dismissed) treatments from the previous visit, this prompt offers to restore them into
 * the just-created visit via the canonical carry-over endpoint (restoreDismissedIds); the
 * restored rows then appear in the treatment table's "Carried Over" section.
 *
 * Self-gating: renders nothing unless it is open, has a destination visit, and there is at
 * least one deferred treatment to restore — so a patient with nothing deferred is never
 * prompted.
 */
import React from 'react';
import { useCarryOverTreatments } from '@/features/workspace/hooks/use-carry-over-treatments';

interface CarryOverPromptProps {
  open: boolean;
  /** Destination visit the deferred treatments are restored INTO (the just-created visit). */
  visitId: string | null;
  patientId: string;
  branchId: string | null;
  /** Dismissed (deferred) treatment ids from the previous visit, restorable into this visit. */
  deferredIds: string[];
  onClose: () => void;
}

export function CarryOverPrompt({
  open,
  visitId,
  patientId,
  branchId,
  deferredIds,
  onClose,
}: CarryOverPromptProps) {
  const { carryOver, isPending } = useCarryOverTreatments({ visitId, patientId, branchId });

  if (!open || !visitId || deferredIds.length === 0) return null;

  function handleConfirm() {
    void carryOver({ restoreDismissedIds: deferredIds })
      .then(onClose)
      .catch(() => {
        /* error surfaced by the hook's onError toast; keep the prompt open to retry */
      });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Carry over from previous visit"
        data-testid="carry-over-prompt"
        className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Carry over from previous visit</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This patient has treatments that were deferred at a previous visit. Restore them
          into this visit so you can continue, complete, or dismiss them here?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="carry-over-skip"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <button
            type="button"
            data-testid="carry-over-confirm"
            disabled={isPending}
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Restoring…' : 'Restore deferred treatments'}
          </button>
        </div>
      </div>
    </div>
  );
}
