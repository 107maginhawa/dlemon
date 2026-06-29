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
 *
 * Shell: the shared @monobase/ui Dialog (Radix) — focus trap, Escape, and focus return
 * come from the primitive; Escape/overlay/X all map to Skip via onOpenChange.
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@monobase/ui';
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

  // Self-gating: only a returning patient WITH deferred work and a destination visit.
  const shouldShow = open && !!visitId && deferredIds.length > 0;

  function handleConfirm() {
    void carryOver({ restoreDismissedIds: deferredIds })
      .then(onClose)
      .catch(() => {
        /* error surfaced by the hook's onError toast; keep the prompt open to retry */
      });
  }

  return (
    <Dialog open={shouldShow} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {/* testid on an inner div: the test harness stubs Radix Content and drops its props. */}
        <div data-testid="carry-over-prompt">
          <DialogHeader>
            <DialogTitle>Carry over from previous visit</DialogTitle>
            <DialogDescription>
              This patient has treatments that were deferred at a previous visit. Restore them
              into this visit so you can continue, complete, or dismiss them here?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5">
            <button
              type="button"
              data-testid="carry-over-skip"
              onClick={onClose}
              className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Skip
            </button>
            <button
              type="button"
              data-testid="carry-over-confirm"
              disabled={isPending}
              onClick={handleConfirm}
              className="min-h-[44px] rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isPending ? 'Restoring…' : 'Restore deferred treatments'}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
