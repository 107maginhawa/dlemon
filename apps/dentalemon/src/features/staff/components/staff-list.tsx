/**
 * StaffList -- staff management list with role badges and actions
 *
 * Features: TanStack Query hook for member list, deactivate mutation,
 *           role badges, status dots, + Add Staff button
 */

import React, { useState } from 'react';
import { StaffCreateModal } from './staff-create-modal';
import { useStaffMembers, useStaffMutations, type MemberRole } from '../hooks/use-staff-members';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffListProps {
  branchId: string;
  currentUserRole?: MemberRole;
}

// FR8.13: Access denied component for non-owner roles
export function StaffAccessDenied() {
  return (
    <div
      data-testid="staff-access-denied"
      className="flex flex-col items-center justify-center py-24 gap-3 text-center"
    >
      <div className="text-4xl">🔒</div>
      <h2 className="text-lg font-semibold">Access Denied</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Only the Dentist-Owner can manage staff. Contact your practice owner for access.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure logic helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatRole(role: string): string {
  const map: Record<string, string> = {
    dentist_owner: 'Dentist-Owner',
    dentist_associate: 'Associate Dentist',
    staff_full: 'Staff - Full Operations',
    staff_scheduling: 'Staff - Scheduling',
  };
  return map[role] ?? role;
}

export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'dentist_owner':
      return 'bg-amber-100 text-amber-800';
    case 'dentist_associate':
      return 'bg-blue-100 text-blue-700';
    case 'staff_full':
      return 'bg-green-100 text-green-700';
    case 'staff_scheduling':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
}

export function canDeactivate(memberRole: MemberRole, currentUserRole: MemberRole): boolean {
  if (currentUserRole !== 'dentist_owner') return false;
  if (memberRole === 'dentist_owner') return false;
  return true;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StaffList({ branchId, currentUserRole }: StaffListProps) {
  // Read role from localStorage if not passed as prop
  const role = currentUserRole ?? (
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('currentMemberRole') as MemberRole | null) ?? 'staff_scheduling'
      : 'staff_scheduling'
  );

  const { members, isLoading, error } = useStaffMembers(branchId);
  const { deactivate, deactivateError } = useStaffMutations(branchId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deactivateConfirming, setDeactivateConfirming] = useState<string | null>(null);

  async function handleDeactivate(memberId: string) {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;
    setDeactivateConfirming(memberId);
    try {
      await deactivate(memberId);
    } catch {
      // deactivateError exposed in UI below
    } finally {
      setDeactivateConfirming(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Staff Members</h2>
          <p className="text-sm text-muted-foreground">
            Manage your team and assign roles
          </p>
        </div>
        {role === 'dentist_owner' && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-4 rounded-xl bg-[#FFE97D] text-[#4A4018] text-sm font-semibold hover:bg-[#F5DC60] transition-colors"
          >
            + Add Staff
          </button>
        )}
      </div>

      {/* Errors */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      )}
      {deactivateError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {deactivateError.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && members.length === 0 && !error && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No staff members found.</p>
          <p className="text-xs mt-1">Add your first staff member to get started.</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && members.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/50">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                  Role
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  {/* Name with avatar initials */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-muted-foreground">
                        {getInitials(member.displayName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.displayName}</p>
                        {member.role === 'dentist_owner' && (
                          <p className="text-xs text-muted-foreground">(Owner -- cannot deactivate)</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role badge */}
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(member.role)}`}>
                      {formatRole(member.role)}
                    </span>
                  </td>

                  {/* Status dot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${member.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm capitalize">{member.status}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {canDeactivate(member.role, role) && member.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(member.id)}
                        disabled={deactivateConfirming === member.id}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                      >
                        {deactivateConfirming === member.id ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <StaffCreateModal
        branchId={branchId}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => setShowCreateModal(false)}
      />
    </div>
  );
}
