import React, { useState, useEffect } from 'react';
import { useFeeSchedule, useUpdateFeeScheduleEntry, type FeeScheduleEntry } from '../hooks/use-fee-schedule';
import { useOrgContextStore } from '@/stores/org-context.store';

/**
 * FeeSchedule — per-branch CDT pricing.
 *
 * dental-org G2 (decision §5 = DRIVE pricing). Reads the active CDT catalog with
 * effective per-branch prices from the dedicated `GET /dental/fee-schedule`, and
 * saves each edited price via `PATCH /dental/fee-schedule/{cdt}`. These prices are
 * the canonical fee store — new treatment/invoice lines default from them
 * server-side. (The old `settings.feeSchedule` blob save drove no pricing.)
 */
export function FeeSchedule() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { entries, isLoading, isError } = useFeeSchedule(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateFeeScheduleEntry(branchId);

  // Local edits keyed by CDT code (centavos). Seeded from the loaded catalog.
  const [prices, setPrices] = useState<Record<string, number>>({});
  const currency = entries[0]?.currency ?? 'PHP';

  // Seed local edits from the catalog, but only for codes not already in local
  // state — so in-progress edits are preserved across re-renders (the query
  // `select` returns a fresh array each render, which would otherwise clobber
  // edits and silently revert a price the operator just changed).
  useEffect(() => {
    if (entries.length === 0) return;
    setPrices((prev) => {
      const next = { ...prev };
      for (const e of entries) if (!(e.cdtCode in next)) next[e.cdtCode] = e.priceCents;
      return next;
    });
  }, [entries]);

  function setPrice(cdtCode: string, priceCents: number) {
    setPrices((prev) => ({ ...prev, [cdtCode]: priceCents }));
  }

  async function handleSave() {
    reset();
    // Only PATCH the codes whose price changed from the loaded catalog value.
    const changed = entries.filter((e) => prices[e.cdtCode] !== e.priceCents);
    try {
      for (const e of changed) {
        await update(e.cdtCode, prices[e.cdtCode] ?? e.priceCents);
      }
    } catch {
      // surfaced via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load fee schedule. Please try again.</div>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Set the price your clinic charges for each procedure. New treatment and
        invoice lines default to these prices.
      </p>
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Fee schedule saved</div>
      )}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-2">CDT Code</th>
              <th className="px-4 py-2">Procedure</th>
              <th className="px-4 py-2 text-right">Price ({currency === 'PHP' ? '₱' : currency})</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-muted-foreground">No procedure codes available.</td></tr>
            )}
            {entries.map((fee: FeeScheduleEntry) => (
              <tr key={fee.cdtCode} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{fee.cdtCode}</span>
                </td>
                <td className="px-4 py-2">{fee.description}</td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number" min="0" step="0.01"
                    aria-label={`Price for ${fee.cdtCode}`}
                    value={(prices[fee.cdtCode] ?? fee.priceCents) / 100 || ''}
                    onChange={e => setPrice(fee.cdtCode, Math.round(parseFloat(e.target.value || '0') * 100))}
                    className="w-24 h-8 rounded-lg border border-border px-2 text-sm text-right bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-9 px-6 rounded-lg bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
