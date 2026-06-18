/**
 * FollowUpNotes — FR2.12
 *
 * Displays a chronological list of follow-up notes for a patient,
 * with a textarea + submit button to add new notes.
 */
import React, { useState } from 'react';
import { APP_LOCALE } from '@/constants/brand';
import { useFollowUpNotes, useAddFollowUpNote } from '../hooks/use-follow-up-notes';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(iso: string, locale = APP_LOCALE): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────

interface FollowUpNotesProps {
  patientId: string;
}

export function FollowUpNotes({ patientId }: FollowUpNotesProps) {
  const { notes, isLoading, error } = useFollowUpNotes({ patientId });
  const { addNote, isPending, error: addError } = useAddFollowUpNote({ patientId });
  const [text, setText] = useState('');

  // V-PAT-013: note text must be 5–2000 characters (matches the API contract).
  const trimmedLength = text.trim().length;
  const isValid = trimmedLength >= 5 && trimmedLength <= 2000;

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!isValid) return;
    addNote(trimmed, { onSuccess: () => setText('') });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Add note form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Add Note</h3>
        <textarea
          data-testid="note-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a follow-up note (5–2000 characters)..."
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">
            {isPending
              ? 'Saving...'
              : trimmedLength > 0 && trimmedLength < 5
                ? 'Minimum 5 characters'
                : 'Cmd+Enter to submit'}
          </span>
          <button
            data-testid="note-submit"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className="px-4 py-1.5 min-h-[44px] text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving...' : 'Add Note'}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            Could not save note. Please try again.
          </p>
        )}
      </div>

      {/* Notes list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Follow-Up Notes</h3>
          {notes.length > 0 && (
            <span className="text-xs text-muted-foreground">{notes.length}</span>
          )}
        </div>

        {isLoading ? (
          <div data-testid="notes-loading" className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-destructive">
            Failed to load follow-up notes.
          </div>
        ) : notes.length === 0 ? (
          <div
            data-testid="no-notes-message"
            className="p-8 text-center text-muted-foreground text-sm"
          >
            No follow-up notes yet. Add one above.
          </div>
        ) : (
          <ul className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {notes.map((note) => (
              <li
                key={note.id}
                data-testid={`note-item-${note.id}`}
                className="px-4 py-3"
              >
                <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {formatTimestamp(note.createdAt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    &middot;
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {note.createdBy}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
