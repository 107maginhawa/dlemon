/**
 * DuplicatePatientsPanel — P2-16 duplicate-patient detection
 *
 * Surfaces likely-duplicate patient clusters for the front desk to review and
 * merge. Each group shows the matched patients with a "Review & merge" link to
 * the patient profile (merge itself lives in the patient record). Read-only
 * surfacing — the merge action already exists server-side.
 */
import React from 'react';
import { Link } from '@tanstack/react-router';
import { BRAND_GOLD_TEXT, APP_LOCALE } from '@/constants/brand';
import { useDuplicatePatients, type DuplicateCandidateGroup } from '../hooks/use-duplicate-patients';

function formatDob(dob: string | null): string {
  if (!dob) return 'No DOB';
  const d = new Date(dob);
  return Number.isNaN(d.getTime())
    ? dob
    : d.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' });
}

function MatchBadge({ matchType }: { matchType: DuplicateCandidateGroup['matchType'] }) {
  const strong = matchType === 'strong';
  return (
    <span
      data-testid="match-badge"
      className={[
        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
        strong ? 'bg-[#FFE97D] text-[#4A4018]' : 'bg-muted text-muted-foreground',
      ].join(' ')}
    >
      {strong ? 'Likely duplicate' : 'Possible match'}
    </span>
  );
}

export function DuplicatePatientsPanel({ branchId }: { branchId: string | null }) {
  const { data, isLoading, error } = useDuplicatePatients({ branchId });

  if (!branchId) {
    return (
      <div data-testid="duplicates-no-branch" className="p-6 text-sm text-muted-foreground">
        Select a branch to scan for duplicate patients.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="duplicates-loading" className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="duplicates-error" className="p-6 text-sm text-destructive">
        Failed to scan for duplicate patients. Please try again.
      </div>
    );
  }

  if (!data || data.groupCount === 0) {
    return (
      <div data-testid="duplicates-empty" className="p-8 text-center">
        <p className="text-sm font-medium text-foreground">No duplicate patients found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Patients matching by name, date of birth, or contact will appear here.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="duplicates-panel" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Possible duplicate patients</h2>
        <span className="text-xs text-muted-foreground">
          {data.groupCount} {data.groupCount === 1 ? 'group' : 'groups'}
        </span>
      </div>

      {data.groups.map((group) => (
        <section
          key={group.matchKey}
          data-testid="duplicate-group"
          className="rounded-xl border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: BRAND_GOLD_TEXT }}>
              {group.patients.length} matching records
            </span>
            <MatchBadge matchType={group.matchType} />
          </div>
          <ul className="divide-y divide-border">
            {group.patients.map((p) => (
              <li
                key={p.id}
                data-testid="duplicate-candidate"
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.displayName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDob(p.dateOfBirth)}
                    {p.phone ? ` · ${p.phone}` : ''}
                    {p.email ? ` · ${p.email}` : ''}
                  </p>
                </div>
                <Link
                  to="/patients/$patientId"
                  params={{ patientId: p.id }}
                  data-testid="review-merge-link"
                  className="shrink-0 text-xs underline text-muted-foreground hover:text-foreground"
                >
                  Review &amp; merge
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
