/**
 * AmendmentForm — inline form for appending a correction note to a historical tooth record
 *
 * Renders inside the tooth-slideout readOnly footer area.
 * Spec: docs/superpowers/specs/2026-05-09-workspace-reconciliation-design.md §4.3
 */

import React, { useState } from 'react';
import { createAmendment } from '@monobase/sdk-ts/generated';
import { logger } from '@/lib/logger';

const AMENDMENT_REASONS = [
  { value: 'correction', label: 'Correction' },
  { value: 'additional_finding', label: 'Additional Finding' },
  { value: 'clarification', label: 'Clarification' },
] as const;

type AmendmentReason = typeof AMENDMENT_REASONS[number]['value'];

export interface AmendmentFormProps {
  visitId: string;
  patientId: string;
  originalRecordType: string;
  originalRecordId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function AmendmentForm({
  visitId,
  patientId,
  originalRecordType,
  originalRecordId,
  onClose,
  onSaved,
}: AmendmentFormProps) {
  const [reason, setReason] = useState<AmendmentReason | ''>('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isValid = reason !== '' && content.trim().length >= 10;

  async function handleSave() {
    if (!isValid) return;
    setError('');
    setSaving(true);
    try {
      // The generated client defaults to throwOnError=false: it resolves with
      // `{ error }` on both network failures and non-2xx responses rather than
      // throwing. Inspect that result so a failed amendment surfaces an error
      // instead of silently closing the form as if it succeeded.
      // visitId is required in the body by CreateAmendmentRequest (the handler reads it
      // from the path, but the wire validator still requires it). Including all fields
      // means the body matches the generated type exactly — no cast needed (the prior
      // cast masked the missing visitId, which 400s against the real validator).
      const { error: apiError } = await createAmendment({
        path: { visitId },
        body: {
          visitId,
          patientId,
          originalRecordType,
          originalRecordId,
          reason,
          content: content.trim(),
        },
      });
      if (apiError) {
        setError('Failed to save amendment. Please try again.');
        logger.error('amendment-form', 'save failed', apiError);
        return;
      }
      await Promise.resolve(onSaved?.());
      onClose();
    } catch (err) {
      setError('Failed to save amendment. Please try again.');
      logger.error('amendment-form', 'save failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="amendment-form"
      className="border-t bg-secondary/30 p-4 flex flex-col gap-3"
    >
      <h3 className="text-sm font-semibold">Add Amendment</h3>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Reason */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="amendment-reason">
          Reason *
        </label>
        <select
          id="amendment-reason"
          value={reason}
          onChange={e => setReason(e.target.value as AmendmentReason)}
          className="h-9 rounded-lg border border-border px-2.5 text-sm bg-background focus:border-lemon outline-none"
        >
          <option value="">Select reason…</option>
          {AMENDMENT_REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="amendment-content">
          Details * <span className="font-normal">(min 10 characters)</span>
        </label>
        <textarea
          id="amendment-content"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Describe the amendment…"
          rows={3}
          className="rounded-lg border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-none"
        />
        {content.length > 0 && content.trim().length < 10 && (
          <p className="text-xs text-muted-foreground">{10 - content.trim().length} more characters needed</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid || saving}
          className="flex-1 h-9 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Amendment'}
        </button>
      </div>
    </div>
  );
}
