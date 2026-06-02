/**
 * HouseholdCard — P1-27 household / guarantor (family file)
 *
 * A read-only summary of the patient's household: family name, guarantor, and
 * the other members with their relationships. Shown on the patient-profile
 * overview. If the patient isn't in a household, renders a quiet empty state.
 */
import React from 'react';
import { BRAND_GOLD_TEXT } from '@/constants/brand';
import { useHousehold } from '../hooks/use-household';

export function HouseholdCard({ patientId }: { patientId: string }) {
  const { data, isLoading, error } = useHousehold({ patientId });

  if (isLoading) {
    return (
      <div
        data-testid="household-loading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="household-error"
        className="rounded-xl border border-border bg-card p-4 text-sm text-destructive"
      >
        Failed to load household.
      </div>
    );
  }

  if (!data || !data.household) {
    return (
      <div
        data-testid="household-empty"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h3 className="text-sm font-semibold mb-1">Household</h3>
        <p className="text-sm text-muted-foreground">
          This patient is not linked to a household.
        </p>
      </div>
    );
  }

  const { household, members } = data;

  return (
    <div
      data-testid="household-card"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Household</h3>
        <span
          data-testid="household-name"
          className="text-xs font-medium"
          style={{ color: BRAND_GOLD_TEXT }}
        >
          {household.name}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li
            key={m.id}
            data-testid="household-member"
            className="py-2 flex items-center justify-between gap-3"
          >
            <span className="text-sm capitalize">{m.relationship}</span>
            {m.isGuarantor && (
              <span
                data-testid="guarantor-badge"
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FFE97D] text-[#4A4018]"
              >
                Guarantor
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
