/**
 * TaxModeSettings — clinic VAT registration mode (BR-054, PH).
 *
 * Drives how invoice tax is derived (server-side, never caller-supplied):
 *   - Non-VAT (default): no tax on invoices. total = subtotal.
 *   - VAT-registered: 12% VAT carved out of the (VAT-inclusive) gross.
 * Most indie PH clinics (under the ₱3M threshold) are Non-VAT.
 */
import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

type TaxMode = 'non_vat' | 'vat_registered';

const MODES: Array<{ value: TaxMode; label: string; hint: string }> = [
  { value: 'non_vat', label: 'Non-VAT', hint: 'No VAT on invoices (most indie clinics under the ₱3M threshold).' },
  { value: 'vat_registered', label: 'VAT-registered', hint: '12% VAT carved out of the price (VAT-inclusive).' },
];

export function TaxModeSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateBranchSettings(branchId);

  const [mode, setMode] = useState<TaxMode>('non_vat');

  useEffect(() => {
    if (settings?.taxMode === 'vat_registered' || settings?.taxMode === 'non_vat') setMode(settings.taxMode);
  }, [settings]);

  async function handleSave() {
    reset();
    try {
      await update({ taxMode: mode });
    } catch {
      // surfaced via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load tax settings. Please try again.</div>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-success-foreground">Tax mode saved</div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tax registration</label>
        <p className="text-sm text-muted-foreground mb-3">Determines how tax is applied to new invoices. Derived server-side from this setting — never editable per invoice.</p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              data-testid={`tax-mode-${m.value}`}
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${mode === m.value ? 'bg-lemon text-lemon-foreground' : 'border border-border hover:bg-secondary'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{MODES.find((m) => m.value === mode)?.hint}</p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        data-testid="save-tax-mode"
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        {isPending ? 'Saving…' : 'Save Tax Mode'}
      </button>
    </div>
  );
}
