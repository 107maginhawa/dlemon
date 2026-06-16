/**
 * TreatmentTemplates — settings panel for per-branch treatment templates (FR1.8).
 *
 * Closes GAP-2 / decision #13: the template CRUD backend existed but had no UI,
 * so the demo seeded templates the clinic could neither create nor manage.
 * Owners build reusable treatment bundles here (create / edit / soft-delete);
 * clinicians apply them to a visit from the workspace (apply-template-button).
 *
 * Writes are owner-only on the FE (mirrors the sibling ConsentTemplates panel).
 * NOTE (roadmap): the backend create/update/delete handlers currently gate only
 * on branch membership (assertBranchAccess) — no owner role check — so this FE
 * gate is stricter than the server. applyTemplate IS owner/associate-gated.
 */
import React, { useState } from 'react';
import { useOrgContextStore } from '@/stores/org-context.store';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import {
  useTreatmentTemplates,
  useTreatmentTemplateMutations,
  type TreatmentTemplate,
  type TemplateTreatmentItem,
} from '../hooks/use-treatment-templates';

interface ItemDraft {
  cdtCode: string;
  description: string;
  price: string; // pesos as typed; converted to priceCents on save
  toothNumber: string;
}

interface EditorState {
  id: string | null; // null = creating
  name: string;
  description: string;
  items: ItemDraft[];
}

const EMPTY_ITEM: ItemDraft = { cdtCode: '', description: '', price: '', toothNumber: '' };
const EMPTY_EDITOR: EditorState = { id: null, name: '', description: '', items: [{ ...EMPTY_ITEM }] };

function toDrafts(items: TemplateTreatmentItem[]): ItemDraft[] {
  if (items.length === 0) return [{ ...EMPTY_ITEM }];
  return items.map((it) => ({
    cdtCode: it.cdtCode,
    description: it.description,
    price: String((it.priceCents ?? 0) / 100),
    toothNumber: it.toothNumber != null ? String(it.toothNumber) : '',
  }));
}

/** Validate + convert drafts to wire items; null price/code/desc rows are dropped. */
function toWireItems(drafts: ItemDraft[]): TemplateTreatmentItem[] {
  const out: TemplateTreatmentItem[] = [];
  for (const d of drafts) {
    const cdtCode = d.cdtCode.trim();
    const description = d.description.trim();
    const parsed = parseFloat(d.price);
    if (!cdtCode || !description || isNaN(parsed) || parsed < 0) continue;
    const tooth = d.toothNumber.trim() === '' ? undefined : Number(d.toothNumber);
    out.push({
      cdtCode,
      description,
      priceCents: Math.round(parsed * 100),
      ...(tooth != null && !isNaN(tooth) ? { toothNumber: tooth } : {}),
    });
  }
  return out;
}

function itemsSummary(items: TemplateTreatmentItem[]): string {
  const total = items.reduce((sum, it) => sum + (it.priceCents ?? 0), 0) / 100;
  const n = items.length;
  return `${n} ${n === 1 ? 'item' : 'items'} · ${CURRENCY_SYMBOL}${total.toLocaleString(APP_LOCALE)}`;
}

export function TreatmentTemplates() {
  const branchId = useOrgContextStore((s) => s.branchId) ?? '';
  const role = useOrgContextStore((s) => s.role);
  const isOwner = role === 'dentist_owner';

  const { templates, isLoading, error } = useTreatmentTemplates(branchId);
  const { create, update, remove, isMutating, mutationError, resetMutations } =
    useTreatmentTemplateMutations(branchId);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  function openCreate() {
    resetMutations();
    setFormError('');
    setEditor({ ...EMPTY_EDITOR, items: [{ ...EMPTY_ITEM }] });
  }

  function openEdit(t: TreatmentTemplate) {
    resetMutations();
    setFormError('');
    setEditor({
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      items: toDrafts(t.items ?? []),
    });
  }

  function patchItem(idx: number, patch: Partial<ItemDraft>) {
    if (!editor) return;
    const items = editor.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setEditor({ ...editor, items });
  }

  function addItem() {
    if (!editor) return;
    setEditor({ ...editor, items: [...editor.items, { ...EMPTY_ITEM }] });
  }

  function removeItem(idx: number) {
    if (!editor) return;
    const items = editor.items.filter((_, i) => i !== idx);
    setEditor({ ...editor, items: items.length > 0 ? items : [{ ...EMPTY_ITEM }] });
  }

  async function handleSave() {
    if (!editor) return;
    if (!editor.name.trim()) { setFormError('Template name is required'); return; }
    const items = toWireItems(editor.items);
    if (items.length === 0) {
      setFormError('At least one treatment item with a CDT code, description, and price is required');
      return;
    }
    setFormError('');
    const payload = {
      name: editor.name.trim(),
      description: editor.description.trim() || undefined,
      items,
    };
    try {
      if (editor.id) {
        await update(editor.id, payload);
      } else {
        await create(payload);
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
    <div data-testid="treatment-templates-panel" className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Treatment Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable treatment bundles clinicians apply to a visit in one action.
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="tt-name">
              Template Name
            </label>
            <input
              id="tt-name"
              type="text"
              value={editor.name}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              placeholder="e.g. New Patient Exam"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block" htmlFor="tt-desc">
              Description (optional)
            </label>
            <input
              id="tt-desc"
              type="text"
              value={editor.description}
              onChange={(e) => setEditor({ ...editor, description: e.target.value })}
              placeholder="Short summary of this bundle"
              className="w-full h-11 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
            />
          </div>

          {/* Items editor */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Treatment Items</span>
            {editor.items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[5rem_1fr_6rem_auto] gap-2 items-center">
                <input
                  type="text"
                  aria-label={`Item ${idx + 1} CDT code`}
                  value={it.cdtCode}
                  onChange={(e) => patchItem(idx, { cdtCode: e.target.value })}
                  placeholder="CDT"
                  className="h-10 rounded-lg border border-border px-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none font-mono"
                />
                <input
                  type="text"
                  aria-label={`Item ${idx + 1} description`}
                  value={it.description}
                  onChange={(e) => patchItem(idx, { description: e.target.value })}
                  placeholder="Procedure description"
                  className="h-10 rounded-lg border border-border px-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
                />
                <input
                  type="number"
                  aria-label={`Item ${idx + 1} price`}
                  value={it.price}
                  onChange={(e) => patchItem(idx, { price: e.target.value })}
                  placeholder={CURRENCY_SYMBOL}
                  min={0}
                  className="h-10 rounded-lg border border-border px-2 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none tabular-nums"
                />
                <button
                  type="button"
                  aria-label={`Remove item ${idx + 1}`}
                  onClick={() => removeItem(idx)}
                  className="text-muted-foreground hover:text-destructive px-2 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="self-start text-xs font-medium text-primary hover:underline"
            >
              + Add item
            </button>
          </div>

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
          <p className="text-sm">No treatment templates yet.</p>
          {isOwner && <p className="text-xs mt-1">Add a template so clinicians can apply a treatment bundle in one action.</p>}
        </div>
      )}

      {/* List */}
      {!isLoading && templates.length > 0 && (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl border border-border px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">{itemsSummary(t.items ?? [])}</p>
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
