/**
 * SoapNotesSheet — slide-up sheet for SOAP clinical notes per visit
 *
 * States:
 *   unsigned  → editable SOAP fields; footer: Discard | Save | Sign & Lock
 *   signed    → read-only fields; signed badge; footer: Close | Add Addendum
 *   addendum  → reason + content fields; footer: Cancel | Submit Addendum
 *
 * Wireframe: docs/prd/context/wireframes/ws-soap-notes.html
 */

import React, { useState, useEffect } from 'react';
import { useVisitNotes } from '../hooks/use-visit-notes';

export interface SoapNotesSheetProps {
  visitId: string;
  open: boolean;
  onClose: () => void;
  onOpenMedicalHistory?: () => void;
}

interface SoapForm {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  notes: string;
}

interface AddendumForm {
  reason: string;
  content: string;
}

const EMPTY_FORM: SoapForm = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  notes: '',
};

const EMPTY_ADDENDUM: AddendumForm = { reason: '', content: '' };

export function SoapNotesSheet({
  visitId,
  open,
  onClose,
  onOpenMedicalHistory,
}: SoapNotesSheetProps) {
  const { notes, isLoading, save, isSaving, sign, isSigning, addendum, isAddingAddendum, history } =
    useVisitNotes(visitId);

  const [form, setForm] = useState<SoapForm>(EMPTY_FORM);
  const [showAddendum, setShowAddendum] = useState(false);
  const [addendumForm, setAddendumForm] = useState<AddendumForm>(EMPTY_ADDENDUM);
  const [showHistory, setShowHistory] = useState(false);

  const isLocked = !!notes?.signed;

  useEffect(() => {
    if (open && notes) {
      setForm({
        subjective: notes.subjective ?? '',
        objective: notes.objective ?? '',
        assessment: notes.assessment ?? '',
        plan: notes.plan ?? '',
        notes: notes.notes ?? '',
      });
    }
  }, [open, notes]);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setShowAddendum(false);
      setAddendumForm(EMPTY_ADDENDUM);
      setShowHistory(false);
    }
  }, [open]);

  function handleFieldChange(field: keyof SoapForm) {
    return (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleSave() {
    save(
      {
        path: { visitId },
        body: {
          visitId,
          subjective: form.subjective,
          objective: form.objective,
          assessment: form.assessment,
          plan: form.plan,
          notes: form.notes,
        },
      },
      { onSuccess: () => onClose() },
    );
  }

  function handleSignAndLock() {
    save(
      {
        path: { visitId },
        body: {
          visitId,
          subjective: form.subjective,
          objective: form.objective,
          assessment: form.assessment,
          plan: form.plan,
          notes: form.notes,
        },
      },
      {
        onSuccess: () => {
          sign({ path: { visitId }, body: {} });
        },
      },
    );
  }

  function handleAddendumFieldChange(field: keyof AddendumForm) {
    return (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setAddendumForm(prev => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleSubmitAddendum() {
    if (!addendumForm.content.trim()) return;
    addendum(
      {
        path: { visitId },
        body: { reason: addendumForm.reason.trim() || 'Clinical addendum', content: addendumForm.content },
      },
      {
        onSuccess: () => {
          setAddendumForm(EMPTY_ADDENDUM);
          setShowAddendum(false);
        },
      },
    );
  }

  if (!open) return null;

  const signedAt = notes?.signedAt
    ? new Date(notes.signedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label="SOAP Notes"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        data-testid="soap-notes-sheet"
        className="relative w-full max-h-[85vh] bg-background rounded-t-2xl shadow-2xl flex flex-col"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-9 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">SOAP Notes</h2>
            {isLocked && (
              <span
                data-testid="signed-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium"
              >
                🔒 Signed{signedAt ? ` · ${signedAt}` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SOAP notes"
            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {isLoading ? (
            <>
              <div className="h-16 bg-muted animate-pulse rounded-xl" />
              <div className="h-16 bg-muted animate-pulse rounded-xl" />
              <div className="h-16 bg-muted animate-pulse rounded-xl" />
            </>
          ) : showAddendum ? (
            /* ── Addendum form ── */
            <>
              <p className="text-sm text-muted-foreground">
                Add a note to the locked record. Addenda are immutable once submitted.
              </p>
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="addendum-reason"
                >
                  Reason
                </label>
                <input
                  id="addendum-reason"
                  type="text"
                  value={addendumForm.reason}
                  onChange={handleAddendumFieldChange('reason')}
                  placeholder="e.g. Correction, additional finding…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none"
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="addendum-content"
                >
                  Content
                </label>
                <textarea
                  id="addendum-content"
                  rows={5}
                  value={addendumForm.content}
                  onChange={handleAddendumFieldChange('content')}
                  placeholder="Addendum text…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none"
                />
              </div>
            </>
          ) : (
            /* ── SOAP fields ── */
            <>
              {/* Subjective */}
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="soap-subjective"
                >
                  Subjective
                </label>
                <textarea
                  id="soap-subjective"
                  rows={3}
                  value={form.subjective}
                  onChange={handleFieldChange('subjective')}
                  disabled={isLocked}
                  placeholder="Chief complaint and patient-reported symptoms…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              {/* Objective */}
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="soap-objective"
                >
                  Objective
                </label>
                <textarea
                  id="soap-objective"
                  rows={3}
                  value={form.objective}
                  onChange={handleFieldChange('objective')}
                  disabled={isLocked}
                  placeholder="Clinical findings, examination results…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              {/* Assessment */}
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="soap-assessment"
                >
                  Assessment
                </label>
                <textarea
                  id="soap-assessment"
                  rows={2}
                  value={form.assessment}
                  onChange={handleFieldChange('assessment')}
                  disabled={isLocked}
                  placeholder="Diagnosis and clinical impression…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              {/* Plan */}
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="soap-plan"
                >
                  Plan
                </label>
                <textarea
                  id="soap-plan"
                  rows={3}
                  value={form.plan}
                  onChange={handleFieldChange('plan')}
                  disabled={isLocked}
                  placeholder="Treatment plan and next steps…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
                  htmlFor="soap-notes"
                >
                  Additional Notes
                </label>
                <textarea
                  id="soap-notes"
                  rows={2}
                  value={form.notes}
                  onChange={handleFieldChange('notes')}
                  disabled={isLocked}
                  placeholder="Any additional observations or notes…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-[#FFE97D] outline-none resize-none disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              {/* Medical history link */}
              {onOpenMedicalHistory && !isLocked && (
                <button
                  type="button"
                  onClick={onOpenMedicalHistory}
                  className="text-xs text-muted-foreground hover:underline mt-2 self-start"
                >
                  View Medical History
                </button>
              )}

              {/* Note history */}
              {history.length > 0 && (
                <div className="mt-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setShowHistory(h => !h)}
                    className="text-xs text-muted-foreground hover:underline font-medium"
                  >
                    {showHistory ? 'Hide' : 'Show'} Note History ({history.length})
                  </button>
                  {showHistory && (
                    <ul className="mt-2 flex flex-col gap-2">
                      {history.map(v => (
                        <li
                          key={v.id}
                          className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-foreground">
                              Version {v.version}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(v.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          {typeof v.snapshot?.content === 'string' && (
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {v.snapshot.content}
                            </p>
                          )}
                          {typeof v.snapshot?.reason === 'string' && (
                            <p className="text-muted-foreground italic mt-0.5">
                              Reason: {v.snapshot.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t flex-shrink-0">
          {showAddendum ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAddendum(false);
                  setAddendumForm(EMPTY_ADDENDUM);
                }}
                className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAddendum}
                disabled={isAddingAddendum || !addendumForm.content.trim()}
                aria-label="Submit addendum"
                className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
              >
                {isAddingAddendum ? 'Submitting…' : 'Submit Addendum'}
              </button>
            </>
          ) : isLocked ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setShowAddendum(true)}
                data-testid="add-addendum-btn"
                className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors"
              >
                Add Addendum
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                aria-label="Save SOAP notes"
                className="flex-1 h-11 rounded-xl border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleSignAndLock}
                disabled={isSaving || isSigning || isLoading}
                data-testid="sign-lock-btn"
                aria-label="Sign and lock SOAP notes"
                className="flex-1 h-11 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors disabled:opacity-50"
              >
                {isSigning || isSaving ? 'Signing…' : 'Sign & Lock'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
