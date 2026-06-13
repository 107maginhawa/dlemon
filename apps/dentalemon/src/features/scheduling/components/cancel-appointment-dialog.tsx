/**
 * CancelAppointmentDialog (FIX-001 / FR3.4)
 *
 * Reason-gated appointment-cancellation dialog. Enforces a 5–500 char reason
 * client-side (parity with the canonical DELETE cancel policy — see FIX-002), and
 * surfaces server errors instead of silently failing. Pure presentational: the
 * parent owns the SDK call (DELETE /dental/appointments/:id?reason=...) and the
 * role gate (owner/staff_full, EM-SCH-001).
 */

import React, { useState } from 'react';

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

  if (!open) return null;

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN && trimmed.length <= MAX;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await onConfirm(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel appointment"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-background rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-1">Cancel Appointment</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {patientLabel ? `Cancel ${patientLabel}'s appointment?` : 'Cancel this appointment?'} A
          reason is required and recorded in the audit trail.
        </p>

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
              className="rounded-lg border border-border px-3 py-2 text-sm resize-none"
              placeholder="e.g. Patient called to reschedule"
            />
            {touched && !valid && (
              <span className="text-xs text-destructive">
                Reason must be {MIN}–{MAX} characters.
              </span>
            )}
            {error && (
              <span role="alert" className="text-xs text-destructive">
                {error}
              </span>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
            >
              Keep appointment
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Cancelling…' : 'Cancel appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
