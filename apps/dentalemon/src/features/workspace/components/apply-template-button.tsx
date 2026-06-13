/**
 * ApplyTemplateButton — apply a treatment template to the active visit (FR1.8, #13).
 *
 * Discoverable from the treatment-table area so it works even on an empty visit (the
 * primary "populate this visit from a template" case). Owner/associate-only, matching
 * the backend applyTemplate role gate (assertBranchRole). Templates are managed in
 * Settings → Treatment Templates; this surface only reads + applies them.
 *
 * Lightweight local-state disclosure (no Radix dependency) — click to reveal the list,
 * click a template to apply, click-away/Escape to close.
 */
import React, { useState } from 'react';
import { useOrgContextStore } from '@/stores/org-context.store';
import { CURRENCY_SYMBOL, APP_LOCALE } from '@/constants/brand';
import { useTreatmentTemplates, type TreatmentTemplate } from '@/features/settings/hooks/use-treatment-templates';
import { useApplyTemplate } from '../hooks/use-apply-template';

interface ApplyTemplateButtonProps {
  visitId: string;
  patientId: string;
}

function templateTotal(t: TreatmentTemplate): string {
  const total = (t.items ?? []).reduce((sum, it) => sum + (it.priceCents ?? 0), 0) / 100;
  return `${CURRENCY_SYMBOL}${total.toLocaleString(APP_LOCALE)}`;
}

export function ApplyTemplateButton({ visitId, patientId }: ApplyTemplateButtonProps) {
  const role = useOrgContextStore((s) => s.role);
  const canApply = role === 'dentist_owner' || role === 'dentist_associate';

  // FE parity with the backend owner/associate gate (assertBranchRole). Gate BEFORE the
  // data hooks so non-clinical roles (assistant/read-only) never fire the template fetch.
  if (!canApply) return null;
  return <ApplyTemplateMenu visitId={visitId} patientId={patientId} />;
}

function ApplyTemplateMenu({ visitId, patientId }: ApplyTemplateButtonProps) {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { templates, isLoading } = useTreatmentTemplates(branchId ?? '');
  const { applyTemplate, isPending } = useApplyTemplate({ visitId, patientId, branchId: branchId ?? null });

  const [open, setOpen] = useState(false);

  async function handleApply(templateId: string) {
    try {
      await applyTemplate(templateId);
      setOpen(false);
    } catch {
      // toast surfaced by the hook
    }
  }

  return (
    <div className="relative inline-block" data-testid="apply-template">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-semibold hover:bg-secondary transition-colors disabled:opacity-50"
      >
        {isPending ? 'Applying…' : '+ Apply Template'}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            aria-label="Treatment templates"
            className="absolute left-0 z-30 mt-1 w-72 max-h-72 overflow-auto rounded-xl border border-border bg-popover shadow-lg p-1"
          >
            {isLoading && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading templates…</p>
            )}
            {!isLoading && templates.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                No treatment templates yet. Add one in Settings → Treatment Templates.
              </p>
            )}
            {!isLoading && templates.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={false}
                disabled={isPending}
                onClick={() => handleApply(t.id)}
                className="w-full text-left rounded-lg px-3 py-2 hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {(t.items ?? []).length} {(t.items ?? []).length === 1 ? 'item' : 'items'} · {templateTotal(t)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
