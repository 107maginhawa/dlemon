/**
 * OnlineBookingSettings — PP-4 (ISSUE-038) staff online-booking config.
 *
 * `createOnlineBooking` was only reachable from the public /book/$branchId wizard,
 * which shows "Online booking unavailable" until a branch enables it — but there
 * was no staff surface to flip that flag. The policy lives in the per-branch
 * `settings.onlineBooking` JSONB (parsed + defaulted server-side by
 * parseOnlineBookingConfig); this panel reads/writes it via the shared
 * branch-settings endpoint, so saving here makes /book/$branchId bookable.
 *
 * Scope: the enable toggle + booking window/policy. Provider allow-list stays
 * 'all' (omitted → server default) and schedule-exceptions are a separate slice.
 */
import React, { useState, useEffect } from 'react';
import { useBranchSettings, useUpdateBranchSettings } from '../hooks/use-branch-settings';
import { useOrgContextStore } from '@/stores/org-context.store';

// Mirror of the server defaults in online-booking-config.ts (freeform JSONB has no
// generated FE type). Emergency is never bookable online, so it's not offered here.
const BOOKABLE_VISIT_TYPES = ['checkup', 'recall', 'hygiene', 'treatment'] as const;
type BookableVisitType = (typeof BOOKABLE_VISIT_TYPES)[number];

export interface OnlineBookingForm {
  enabled: boolean;
  bookableVisitTypes: string[];
  leadTimeMinutes: number;
  horizonDays: number;
  slotStepMinutes: number;
  requirePatientAuth: boolean;
}

export function defaultOnlineBookingForm(): OnlineBookingForm {
  return {
    enabled: false,
    bookableVisitTypes: ['checkup', 'recall'],
    leadTimeMinutes: 120,
    horizonDays: 60,
    slotStepMinutes: 15,
    requirePatientAuth: false,
  };
}

const VISIT_TYPE_LABEL: Record<BookableVisitType, string> = {
  checkup: 'Checkup',
  recall: 'Recall',
  hygiene: 'Hygiene',
  treatment: 'Treatment',
};

export function OnlineBookingSettings() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { settings, isLoading, isError } = useBranchSettings(branchId);
  const { update, isPending, error: saveError, isSuccess, reset } = useUpdateBranchSettings(branchId);

  const [form, setForm] = useState<OnlineBookingForm>(defaultOnlineBookingForm);

  useEffect(() => {
    const ob = settings?.onlineBooking;
    if (!ob) return;
    setForm((prev) => ({
      enabled: ob.enabled ?? prev.enabled,
      bookableVisitTypes: Array.isArray(ob.bookableVisitTypes) ? ob.bookableVisitTypes : prev.bookableVisitTypes,
      leadTimeMinutes: typeof ob.leadTimeMinutes === 'number' ? ob.leadTimeMinutes : prev.leadTimeMinutes,
      horizonDays: typeof ob.horizonDays === 'number' ? ob.horizonDays : prev.horizonDays,
      slotStepMinutes: typeof ob.slotStepMinutes === 'number' ? ob.slotStepMinutes : prev.slotStepMinutes,
      requirePatientAuth: ob.requirePatientAuth ?? prev.requirePatientAuth,
    }));
  }, [settings]);

  function toggleVisitType(t: BookableVisitType) {
    setForm((f) => ({
      ...f,
      bookableVisitTypes: f.bookableVisitTypes.includes(t)
        ? f.bookableVisitTypes.filter((x) => x !== t)
        : [...f.bookableVisitTypes, t],
    }));
  }

  async function handleSave() {
    reset();
    try {
      await update({ onlineBooking: { ...form } });
    } catch {
      // surfaced via saveError
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load online-booking settings. Please try again.</div>;

  const numberInput = 'h-10 w-28 rounded-xl border border-border px-3 text-sm bg-background focus-visible:border-lemon focus-visible:ring-2 focus-visible:ring-ring outline-none';

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-sm text-success-foreground">Online booking saved</div>
      )}

      {/* Master enable toggle */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Online booking</label>
        <p className="text-sm text-muted-foreground mb-3">
          When enabled, your public booking page (<code>/book/{branchId ?? ':branchId'}</code>) lets patients self-book. Off by default.
        </p>
        <button
          type="button"
          data-testid="online-booking-enabled"
          aria-pressed={form.enabled}
          onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
          className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${form.enabled ? 'bg-lemon text-lemon-foreground' : 'border border-border hover:bg-secondary'}`}
        >
          {form.enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Bookable visit types */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bookable visit types</label>
        <p className="text-sm text-muted-foreground mb-3">Which visit types patients may pick. Emergencies are never offered self-service.</p>
        <div className="flex flex-wrap gap-2">
          {BOOKABLE_VISIT_TYPES.map((t) => {
            const on = form.bookableVisitTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                data-testid={`online-booking-type-${t}`}
                aria-pressed={on}
                onClick={() => toggleVisitType(t)}
                className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring outline-none ${on ? 'bg-lemon text-lemon-foreground' : 'border border-border hover:bg-secondary'}`}
              >
                {VISIT_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Booking window */}
      <div className="flex flex-wrap gap-5">
        <div>
          <label htmlFor="ob-lead" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Lead time (min)</label>
          <input id="ob-lead" data-testid="online-booking-lead" type="number" min={0} className={numberInput}
            value={form.leadTimeMinutes} onChange={(e) => setForm((f) => ({ ...f, leadTimeMinutes: Number(e.target.value) }))} />
        </div>
        <div>
          <label htmlFor="ob-horizon" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Horizon (days)</label>
          <input id="ob-horizon" data-testid="online-booking-horizon" type="number" min={1} max={365} className={numberInput}
            value={form.horizonDays} onChange={(e) => setForm((f) => ({ ...f, horizonDays: Number(e.target.value) }))} />
        </div>
        <div>
          <label htmlFor="ob-step" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Slot step (min)</label>
          <input id="ob-step" data-testid="online-booking-step" type="number" min={5} max={120} className={numberInput}
            value={form.slotStepMinutes} onChange={(e) => setForm((f) => ({ ...f, slotStepMinutes: Number(e.target.value) }))} />
        </div>
      </div>

      {/* Require patient auth */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" data-testid="online-booking-require-auth" checked={form.requirePatientAuth}
          onChange={(e) => setForm((f) => ({ ...f, requirePatientAuth: e.target.checked }))} className="w-4 h-4 rounded" />
        <span className="text-sm">Require patient sign-in before booking</span>
      </label>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        data-testid="save-online-booking"
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring outline-none self-start px-5"
      >
        {isPending ? 'Saving…' : 'Save Online Booking'}
      </button>
    </div>
  );
}
