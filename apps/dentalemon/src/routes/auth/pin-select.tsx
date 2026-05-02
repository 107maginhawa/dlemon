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

const API = 'http://localhost:7213';

export const Route = createFileRoute('/auth/pin-select')({
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

export function PinSelect({ members, onSelect }: PinSelectProps) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 px-4">
      <h1 className="text-2xl font-semibold">Choose your profile</h1>

      {members.length === 0 ? (
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

      <p className="text-xs text-muted-foreground mt-4">Tap your name to sign in</p>
    </div>
  );
}

// --------------------------------------------------------------------------
// Route component (uses real data in production)
// --------------------------------------------------------------------------

function PinSelectRoute() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<PinSelectMember[]>([]);

  useEffect(() => {
    const branchId = localStorage.getItem('currentBranchId');
    if (!branchId) return;
    fetch(`${API}/dental/org/members?branchId=${encodeURIComponent(branchId)}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        const items: PinSelectMember[] = data.items ?? [];
        setMembers(items);
        // FR9.2: Single user = auto-select (navigate directly to PIN entry)
        if (items.length === 1) {
          navigate({ to: '/auth/pin-entry/$memberId', params: { memberId: items[0]!.id } });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PinSelect
        members={members}
        onSelect={(member) => {
          navigate({ to: '/auth/pin-entry/$memberId', params: { memberId: member.id } });
        }}
      />
    </div>
  );
}
