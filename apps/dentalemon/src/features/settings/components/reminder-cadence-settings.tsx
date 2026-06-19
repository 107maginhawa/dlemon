/**
 * ReminderCadenceSettings — dunning reminder cadence (BR-050, Phase 2.3b).
 *
 * The days-past-due offsets at which the daily dunning sweep sends payment
 * reminders (email + push). Toggle the common offsets; the saved set drives
 * jobs/dunning.ts. An empty set turns automated reminders off for the branch.
 * Default cadence (applied when unset) is 3 / 7 / 14 days.
 */
import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

const OFFSET_OPTIONS = [3, 7, 14, 30, 60];
const DEFAULT_OFFSETS = [3, 7, 14];

export function ReminderCadenceSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateBranchSettings(branchId);

  const [selected, setSelected] = useState<number[]>(DEFAULT_OFFSETS);

  useEffect(() => {
    const saved = settings?.billingReminderOffsetDays;
    if (Array.isArray(saved)) setSelected(saved.filter((n): n is number => typeof n === 'number'));
  }, [settings]);

  function toggle(day: number) {
    setSelected((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]));
  }

  async function handleSave() {
    reset();
    const offsets = [...new Set(selected)].sort((a, b) => a - b);
    try {
      await update({ billingReminderOffsetDays: offsets });
    } catch {
      // surfaced via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load reminder settings. Please try again.</div>;

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-success-foreground">Reminder cadence saved</div>
      )}

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Reminder cadence</label>
        <p className="text-sm text-muted-foreground mb-3">Send overdue-payment reminders (email + push) this many days past an invoice's due date. Select all that apply; leave empty to turn automated reminders off.</p>
        <div className="flex flex-wrap gap-2">
          {OFFSET_OPTIONS.map((day) => {
            const on = selected.includes(day);
            return (
              <button
                key={day}
                type="button"
                data-testid={`offset-chip-${day}`}
                aria-pressed={on}
                onClick={() => toggle(day)}
                className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${on ? 'bg-lemon text-lemon-foreground' : 'border border-border hover:bg-secondary'}`}
              >
                {day} days
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        data-testid="save-reminder-cadence"
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        {isPending ? 'Saving…' : 'Save Reminder Cadence'}
      </button>
    </div>
  );
}
