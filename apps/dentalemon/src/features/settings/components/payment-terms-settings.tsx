/**
 * PaymentTermsSettings — clinic-wide default payment terms (BR-048, Phase 2.1b).
 *
 * The default terms (days) are the lowest-precedence input to dueDate at invoice
 * issue (per-invoice override → service terms → THIS → due on receipt). Presets
 * cover the common nets; a custom value (0–365) handles the rest.
 */
import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

const PRESETS: Array<{ days: number; label: string }> = [
  { days: 0, label: 'Due on receipt' },
  { days: 15, label: 'Net 15' },
  { days: 30, label: 'Net 30' },
  { days: 60, label: 'Net 60' },
];

function clampDays(n: number): number {
  return Math.min(365, Math.max(0, Math.floor(n)));
}

export function PaymentTermsSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateBranchSettings(branchId);

  const [days, setDays] = useState(0);

  useEffect(() => {
    if (settings?.defaultPaymentTermsDays != null) setDays(clampDays(settings.defaultPaymentTermsDays));
  }, [settings]);

  const isPreset = PRESETS.some((p) => p.days === days);

  async function handleSave() {
    reset();
    try {
      await update({ defaultPaymentTermsDays: clampDays(days) });
    } catch {
      // surfaced via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load payment-terms settings. Please try again.</div>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-success-foreground">Payment terms saved</div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Default payment terms</label>
        <p className="text-sm text-muted-foreground mb-3">Applied to new invoices at issue when no per-invoice or per-service terms are set. The due date is the issue date plus this many days.</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              data-testid={`terms-preset-${p.days}`}
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
              className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${days === p.days ? 'bg-lemon text-lemon-foreground' : 'border border-border hover:bg-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="terms-custom" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Custom (days)</label>
        <input
          id="terms-custom"
          data-testid="terms-custom"
          inputMode="numeric"
          value={isPreset ? '' : String(days)}
          placeholder={isPreset ? 'e.g. 45' : undefined}
          onChange={(e) => setDays(clampDays(Number(e.target.value) || 0))}
          className="w-40 h-11 rounded-xl border border-border px-3 text-sm tabular-nums bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none"
        />
        <span className="ml-2 text-sm text-muted-foreground">0–365 (0 = due on receipt)</span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        data-testid="save-payment-terms"
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        {isPending ? 'Saving…' : 'Save Payment Terms'}
      </button>
    </div>
  );
}
