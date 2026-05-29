/**
 * PIN Select Route — /auth/pin-select
 *
 * "Choose your profile" screen. Shows active staff members for the current
 * branch and lets the user tap their card to proceed to PIN entry.
 *
 * Wireframe: docs/prd/context/wireframes/auth-user-select.html
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { Skeleton } from '@monobase/ui';
import { apiBaseUrl } from '@/lib/config';
import { useOrgContextStore } from '@/stores/org-context.store';
import { composeGuards, requireAuth } from '@/lib/guards';
import { loadOrgContext } from '@/lib/load-org-context';

const API = apiBaseUrl;

export const Route = createFileRoute('/auth/pin-select')({
  // CF-44 (Slice H): PIN select is part of the authenticated device flow.
  // Without this guard, an unauthenticated browser tab could reach this page
  // and enumerate staff members. Better-Auth session is required first.
  // loadOrgContext seeds the Zustand store so the useEffect below can fetch members.
  beforeLoad: composeGuards(requireAuth, async () => { await loadOrgContext() }),
  component: PinSelectRoute,
});

// --------------------------------------------------------------------------
// Exported component (also imported by pin-select.test.ts)
// --------------------------------------------------------------------------

export interface PinSelectMember {
  id: string;
  displayName: string;
  role: 'dentist_owner' | 'dentist_associate' | 'staff_full' | 'staff_scheduling';
}

interface PinSelectProps {
  members: PinSelectMember[];
  onSelect: (member: PinSelectMember) => void;
  /** Shows a skeleton placeholder while the member list is being fetched. */
  isLoading?: boolean;
  /** Shows an inline error with a retry affordance when the fetch fails. */
  isError?: boolean;
  /** Retry callback wired to the error state's Retry button. */
  onRetry?: () => void;
}

const ROLE_LABELS: Record<PinSelectMember['role'], string> = {
  dentist_owner: 'Dentist-Owner',
  dentist_associate: 'Dentist',
  staff_full: 'Staff',
  staff_scheduling: 'Staff (Scheduling)',
};

/** Derive two-letter initials from a display name */
function initials(displayName: string): string {
  const words = displayName.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  }
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

export function PinSelect({ members, onSelect, isLoading = false, isError = false, onRetry }: PinSelectProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <h1 className="text-2xl font-semibold">Choose your profile</h1>

      {isLoading ? (
        <div data-testid="pin-select-loading" className="flex flex-wrap justify-center gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card border border-border w-36"
            >
              <Skeleton className="w-14 h-14 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div data-testid="pin-select-error" className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive">Failed to load staff members.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : members.length === 0 ? (
        <p data-testid="pin-select-empty" className="text-muted-foreground text-sm">
          No staff members found.
        </p>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {members.map((member) => (
            <button
              key={member.id}
              role="button"
              aria-label={`Sign in as ${member.displayName}`}
              onClick={() => onSelect(member)}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all w-36"
            >
              <div
                data-testid={`member-avatar-${member.id}`}
                className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold"
              >
                {initials(member.displayName)}
              </div>
              <span className="font-medium text-sm text-center leading-tight">
                {member.displayName}
              </span>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABELS[member.role]}
              </span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isError && (
        <p className="text-xs text-muted-foreground mt-4">Tap your name to sign in</p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Route component (uses real data in production)
// --------------------------------------------------------------------------

function PinSelectRoute() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<PinSelectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // Bumping this re-runs the fetch effect (Retry affordance).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const { branchId: storeBranchId } = useOrgContextStore.getState();
    const branchId = storeBranchId ?? localStorage.getItem('currentBranchId');
    if (!branchId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    fetch(`${API}/dental/org/members?branchId=${encodeURIComponent(branchId)}`, {
      credentials: 'include',
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const items: PinSelectMember[] = data.data ?? data.items ?? [];
        setMembers(items);
        setIsLoading(false);
        // FR9.2: Single user = auto-select (navigate directly to PIN entry)
        if (items.length === 1) {
          navigate({ to: '/auth/pin-entry/$memberId', params: { memberId: items[0]!.id } });
        }
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
  }, [reloadKey]);

  return (
    <div className="min-h-screen bg-background">
      <PinSelect
        members={members}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => setReloadKey((k) => k + 1)}
        onSelect={(member) => {
          // UJ-ORG-004: Persist org context to localStorage so pin-entry
          // (and any deep-link reload) can reconstruct the correct context.
          const { orgId, branchId: storeBranchId } = useOrgContextStore.getState();
          if (orgId) localStorage.setItem('currentOrgId', orgId);
          if (storeBranchId) localStorage.setItem('currentBranchId', storeBranchId);
          navigate({ to: '/auth/pin-entry/$memberId', params: { memberId: member.id } });
        }}
      />
    </div>
  );
}
