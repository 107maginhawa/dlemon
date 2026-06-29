/**
 * CancelAppointmentDialog (FIX-001 / FR3.4)
 *
 * Reason-gated appointment-cancellation dialog. Enforces a 5–500 char reason
 * client-side (parity with the canonical DELETE cancel policy — see FIX-002), and
 * surfaces server errors instead of silently failing. Pure presentational: the
 * parent owns the SDK call (DELETE /dental/appointments/:id?reason=...) and the
 * role gate (owner/staff_full, EM-SCH-001). Shell is the shared @monobase/ui Dialog
 * (Radix): focus trap, Escape, focus return + X close all map to "keep appointment".
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@monobase/ui';

interface CancelAppointmentDialogProps {
  open: boolean;
  patientLabel?: string;
  error?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

const MIN = 5;
const MAX = 500;

export function CancelAppointmentDialog({
  open,
  patientLabel,
  error = null,
  saving = false,
  onClose,
  onConfirm,
}: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset transient form state each time the dialog opens so a prior appointment's
  // half-typed reason never bleeds into the next one (the panel stays mounted).
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN && trimmed.length <= MAX;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await onConfirm(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>
            {patientLabel ? `Cancel ${patientLabel}'s appointment?` : 'Cancel this appointment?'} Add a reason below — we'll save it to the audit trail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="flex flex-col gap-3" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="cancel-reason" className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Cancellation reason"
              rows={3}
              maxLength={MAX}
              className="rounded-lg border border-border px-3 py-2 text-sm resize-none focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
              placeholder="e.g. Patient called to reschedule"
            />
            {touched && !valid && (
              <span className="text-xs text-destructive">
                Please add a reason (at least {MIN} characters).
              </span>
            )}
            {error && (
              <span role="alert" className="text-xs text-destructive">
                {error}
              </span>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-border px-4 text-sm hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Keep appointment
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              {saving ? 'Cancelling…' : 'Cancel appointment'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
