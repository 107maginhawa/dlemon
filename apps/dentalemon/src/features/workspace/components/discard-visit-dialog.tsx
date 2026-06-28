/**
 * DiscardVisitDialog — PP-8 (ISSUE-041)
 *
 * A reason is required and recorded in the audit trail; the backend validates reason
 * min 5 / max 500 (DiscardVisitRequest) — mirrored here so the affordance can't submit
 * something the API will reject. Shell is the shared @monobase/ui Dialog (Radix): focus
 * trap, Escape, and focus return come from the primitive (Escape / overlay / X all map to
 * "keep visit", the non-destructive default). Pure presentational: the parent owns the SDK call.
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

interface DiscardVisitDialogProps {
  open: boolean;
  error?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

const MIN = 5;
const MAX = 500;

export function DiscardVisitDialog({ open, error = null, saving = false, onClose, onConfirm }: DiscardVisitDialogProps) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset transient form state each open so a prior visit's half-typed discard
  // reason never carries over (the panel stays mounted while open toggles).
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
        {/* testid on an inner div: the test harness stubs Radix Content and drops its props. */}
        <div data-testid="discard-visit-dialog">
          <DialogHeader>
            <DialogTitle>Discard visit</DialogTitle>
            <DialogDescription>
              Any pending treatments on this visit will be dismissed, and this can't be undone. Add a reason below — we'll save it to the audit trail.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirm} className="flex flex-col gap-3" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="discard-reason" className="text-sm font-medium">
                Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                id="discard-reason"
                data-testid="discard-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="Discard reason"
                rows={3}
                maxLength={MAX}
                className="rounded-lg border border-border px-3 py-2 text-sm resize-none focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                placeholder="e.g. Patient left before treatment started"
              />
              {touched && !valid && (
                <span className="text-xs text-destructive">Please add a reason (at least {MIN} characters).</span>
              )}
              {error && (
                <span role="alert" className="text-xs text-destructive">{error}</span>
              )}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-lg border border-border px-4 text-sm hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Keep visit
              </button>
              <button
                type="submit"
                data-testid="discard-visit-confirm"
                disabled={saving}
                className="min-h-[44px] rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                {saving ? 'Discarding…' : 'Discard visit'}
              </button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
