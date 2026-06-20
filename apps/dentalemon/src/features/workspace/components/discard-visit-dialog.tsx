/**
 * DiscardVisitDialog — PP-8 (ISSUE-041)
 *
 * Replaces the native window.prompt() that gated "Discard visit" (inaccessible,
 * off-brand, and unstyled). A reason is required and recorded in the audit trail;
 * the backend validates reason min 5 / max 500 (DiscardVisitRequest) — mirrored
 * here so the affordance can't submit something the API will reject. Uses
 * useSheetA11y for Escape-to-close + focus handling (the hand-rolled-overlay
 * pattern, ISSUE-010). Pure presentational: the parent owns the SDK call.
 */
import React, { useState } from 'react';
import { useSheetA11y } from '@/hooks/use-sheet-a11y';

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
  useSheetA11y({ open, onClose });
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
    <div role="dialog" aria-modal="true" aria-label="Discard visit" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div data-testid="discard-visit-dialog" className="bg-background rounded-2xl p-6 w-full max-w-md shadow-lg">
        <h2 className="text-xl font-semibold mb-1">Discard Visit</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Its pending treatments will be dismissed. This cannot be undone. A reason is required and recorded in the audit trail.
        </p>

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
              <span className="text-xs text-destructive">Reason must be {MIN}–{MAX} characters.</span>
            )}
            {error && (
              <span role="alert" className="text-xs text-destructive">{error}</span>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
              Keep visit
            </button>
            <button
              type="submit"
              data-testid="discard-visit-confirm"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Discarding…' : 'Discard visit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
