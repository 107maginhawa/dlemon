/**
 * ConsentTemplates — settings panel for per-branch consent form templates (FR8.4b).
 *
 * Closes the GAP-2 compliance hole: consent legal text was hardcoded in
 * consent-sheet.tsx. Owners manage real per-clinic templates here (create /
 * edit / soft-delete). Writes are owner-only (backend also enforces FR8.13).
 */
import React, { useState } from 'react';
import { useOrgContextStore } from '@/stores/org-context.store';
import {
  useConsentTemplates,
  useConsentTemplateMutations,
  type ConsentTemplate,
} from '../hooks/use-consent-templates';

interface EditorState {
  id: string | null; // null = creating
  name: string;
  body: string;
  requiresWitnessSignature: boolean;
}

const EMPTY_EDITOR: EditorState = { id: null, name: '', body: '', requiresWitnessSignature: false };

export function ConsentTemplates() {
  const branchId = useOrgContextStore((s) => s.branchId) ?? '';
  const role = useOrgContextStore((s) => s.role);
  const isOwner = role === 'dentist_owner';

  const { templates, isLoading, error } = useConsentTemplates(branchId);
  const { create, update, remove, isMutating, mutationError, resetMutations } =
    useConsentTemplateMutations(branchId);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  function openCreate() {
    resetMutations();
    setFormError('');
    setEditor({ ...EMPTY_EDITOR });
  }

  function openEdit(t: ConsentTemplate) {
    resetMutations();
    setFormError('');
    setEditor({
      id: t.id,
      name: t.name,
      body: t.body,
      requiresWitnessSignature: t.requiresWitnessSignature ?? false,
    });
  }

  async function handleSave() {
    if (!editor) return;
    if (!editor.name.trim()) { setFormError('Template name is required'); return; }
    if (!editor.body.trim()) { setFormError('Consent body is required'); return; }
    setFormError('');
    try {
      if (editor.id) {
        await update(editor.id, {
          name: editor.name.trim(),
          body: editor.body.trim(),
          requiresWitnessSignature: editor.requiresWitnessSignature,
        });
      } else {
        await create({
          name: editor.name.trim(),
          body: editor.body.trim(),
          requiresWitnessSignature: editor.requiresWitnessSignature,
        });
      }
      setEditor(null);
    } catch {
      // mutationError surfaced in UI
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
    } finally {
      setConfirmingDelete(null);
    }
  }

  return (
    <div data-testid="consent-templates-panel" className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Consent Form Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable consent text presented to patients during treatment.
          </p>
        </div>
        {isOwner && !editor && (
          <button
            type="button"
            onClick={openCreate}
            className="h-10 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors"
          >
            + Add Template
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}
      {mutationError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {mutationError.message}
        </div>
      )}

      {/* Editor */}
      {editor && (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-3 bg-secondary/20">
          <h3 className="text-sm font-semibold">{editor.id ? 'Edit Template' : 'New Template'}</h3>
          {formError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="ct-name">
              Template Name
            </label>
            <input
              id="ct-name"
              type="text"
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              placeholder="e.g. Tooth Extraction Consent"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus:border-lemon outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="ct-body">
              Consent Body
            </label>
            <textarea
              id="ct-body"
              value={editor.body}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
              rows={5}
              placeholder="The consent text the patient reads and signs…"
              className="w-full rounded-xl border border-border px-3 py-2 text-sm bg-background focus:border-lemon outline-none resize-y"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editor.requiresWitnessSignature}
              onChange={(e) => setEditor({ ...editor, requiresWitnessSignature: e.target.checked })}
            />
            Requires witness signature
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setEditor(null); setFormError(''); }}
              className="h-10 px-4 rounded-xl border border-border text-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isMutating}
              className="h-10 px-4 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-50"
            >
              {isMutating ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && templates.length === 0 && !editor && (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">No consent templates yet.</p>
          {isOwner && <p className="text-xs mt-1">Add a template so clinicians present consistent consent text.</p>}
        </div>
      )}

      {/* List */}
      {!isLoading && templates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl border border-border px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                {t.requiresWitnessSignature && (
                  <span className="inline-block mt-1 text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                    Witness required
                  </span>
                )}
              </div>
              {isOwner && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {confirmingDelete === t.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        disabled={isMutating}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="text-xs text-foreground/70 hover:text-foreground transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(t.id)}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
