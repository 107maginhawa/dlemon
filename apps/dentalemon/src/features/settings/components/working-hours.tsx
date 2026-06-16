import React, { useState, useEffect } from 'react';
import { useWorkingHours, useUpdateWorkingHours } from '../hooks/use-working-hours';
import {
  DAYS,
  type DayOfWeek,
  type WorkingHoursMap,
  defaultWorkingHours,
  fromCanonical,
  toCanonical,
  validateWorkingHours as validateWorkingHoursLogic,
} from './working-hours.logic';
import { useOrgContextStore } from '@/stores/org-context.store';

/* ------------------------------------------------------------------ */
/*  Labels + display-aware validation (transforms live in .logic.ts)   */
/* ------------------------------------------------------------------ */

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// Wrap the pure validator to surface day LABELS (e.g. "Monday") in the UI while
// the logic module keys errors by lowercase day name.
function validateWorkingHours(hours: WorkingHoursMap): string[] {
  return validateWorkingHoursLogic(hours).map((err) => {
    const [day, ...rest] = err.split(': ');
    const label = DAY_LABELS[day as DayOfWeek] ?? day;
    return `${label}: ${rest.join(': ')}`;
  });
}

/* ------------------------------------------------------------------ */
/*  Time options for selects                                           */
/* ------------------------------------------------------------------ */

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WorkingHours() {
  const branchId = useOrgContextStore((s) => s.branchId);
  const { workingHours, isLoading, isError } = useWorkingHours(branchId);
  const { update, isPending, isSuccess, error: saveError, reset } = useUpdateWorkingHours(branchId);

  const [hours, setHours] = useState<WorkingHoursMap>(defaultWorkingHours);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!workingHours) return;
    setHours(fromCanonical(workingHours));
  }, [workingHours]);

  function handleToggle(day: DayOfWeek) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: !prev[day].open } }));
  }

  function handleTime(day: DayOfWeek, field: 'start' | 'end', value: string) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSave() {
    const errs = validateWorkingHours(hours);
    if (errs.length > 0) { setValidationErrors(errs); return; }
    setValidationErrors([]);
    reset();
    try {
      // Write the ENFORCED canonical shape to the dedicated working-hours column
      // (not the settings blob) so the scheduler actually gates booking (G1).
      await update(toCanonical(hours));
    } catch {
      // error exposed via saveError
    }
  }

  const inputClass = 'h-9 rounded-lg border border-border px-2 text-sm bg-background focus:border-lemon outline-none';

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (isError) return <div className="text-sm text-destructive">Failed to load working hours. Please try again.</div>;

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <p className="text-sm text-muted-foreground">Set the weekly operating hours for your clinic.</p>

      {validationErrors.length > 0 && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {validationErrors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
      {saveError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          Failed to save: {saveError.message}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Working hours saved
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[120px_60px_1fr_1fr] gap-2 px-4 py-2 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Day</span>
          <span>Open</span>
          <span>Start</span>
          <span>End</span>
        </div>

        {DAYS.map((day) => (
          <div
            key={day}
            className={`grid grid-cols-[120px_60px_1fr_1fr] gap-2 px-4 py-2.5 border-t border-border items-center ${!hours[day].open ? 'opacity-50' : ''}`}
          >
            <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
            <button
              type="button"
              role="switch"
              aria-checked={hours[day].open}
              onClick={() => handleToggle(day)}
              className={`w-10 h-6 rounded-full transition-colors relative ${hours[day].open ? 'bg-lemon' : 'bg-secondary'}`}
              aria-label={`Toggle ${DAY_LABELS[day]}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${hours[day].open ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
            <select
              value={hours[day].start}
              onChange={(e) => handleTime(day, 'start', e.target.value)}
              disabled={!hours[day].open}
              className={inputClass}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={hours[day].end}
              onChange={(e) => handleTime(day, 'end', e.target.value)}
              disabled={!hours[day].open}
              className={inputClass}
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="h-11 rounded-xl bg-lemon text-lemon-foreground text-sm font-semibold hover:bg-lemon-hover transition-colors disabled:opacity-60 w-fit px-8"
      >
        {isPending ? 'Saving...' : 'Save Working Hours'}
      </button>
    </div>
  );
}
