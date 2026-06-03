/**
 * PatientFolderCard
 *
 * Manila folder–style card showing patient info.
 * Gold tab strip at top (#FFE97D), horizontal layout (avatar + meta),
 * status badges for follow-up and outstanding balance.
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import React from 'react';
import type { ToothState } from '@/lib/dental-chart-types';
import { DentalChartThumbnail } from './dental-chart-thumbnail';

export interface PatientCardData {
  id: string;
  displayName: string;
  age: number;
  lastVisit?: Date;
  visitCount: number;
  needsFollowUp: boolean;
  hasBalance: boolean;
  status?: 'active' | 'archived' | 'in-session';
  latestChartTeeth?: Array<{ toothNumber: number; state: ToothState }>;
}

interface PatientFolderCardProps {
  patient: PatientCardData;
  onClick: (patient: PatientCardData) => void;
  onProfile?: (patient: PatientCardData) => void;
}

function tabClass(status?: 'active' | 'archived' | 'in-session'): string {
  switch (status) {
    case 'active': return 'bg-lemon';
    case 'archived': return 'bg-muted';
    case 'in-session': return 'bg-teal-500';
    default: return 'bg-lemon';
  }
}

function initials(name: string): string {
  const words = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  }
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** Split "First Last" → ["LAST", "First"] for the manila folder name format. */
function nameParts(displayName: string): { lastName: string; firstName: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0]!.toUpperCase(), firstName: '' };
  }
  const last = parts[parts.length - 1]!;
  const first = parts.slice(0, -1).join(' ');
  return { lastName: last.toUpperCase(), firstName: first };
}

function formatLastVisit(date?: Date): string {
  if (!date) return 'No visits';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PatientFolderCard({ patient, onClick, onProfile }: PatientFolderCardProps) {
  const { lastName, firstName } = nameParts(patient.displayName);

  return (
    <div
      data-testid="patient-folder-card"
      role="button"
      tabIndex={0}
      aria-label={`Open patient record for ${patient.displayName}`}
      onClick={() => onClick(patient)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(patient)}
      className="relative flex flex-col rounded-xl bg-card border border-border hover:border-primary/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer overflow-hidden w-48"
    >
      {/* Manila folder tab strip */}
      <div
        data-testid="folder-tab"
        className={`h-2 w-full ${tabClass(patient.status)}`}
        aria-hidden="true"
      />

      {/* Card body */}
      <div className="flex items-start gap-3 p-3">
        {/* Avatar */}
        <div
          data-testid="patient-avatar"
          className="w-10 h-10 shrink-0 rounded-full bg-lemon/30 flex items-center justify-center text-sm font-bold text-lemon-foreground select-none"
        >
          {initials(patient.displayName)}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold tracking-wide truncate text-foreground">
            {lastName}
          </p>
          {firstName && (
            <p className="text-xs text-muted-foreground truncate">{firstName}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {patient.visitCount} {patient.visitCount === 1 ? 'visit' : 'visits'}
          </p>
        </div>
      </div>

      {/* Profile link — PROF-04 */}
      {onProfile && (
        <button
          data-testid="profile-btn"
          aria-label={`View profile for ${patient.displayName}`}
          onClick={(e) => { e.stopPropagation(); onProfile(patient); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onProfile(patient); } }}
          className="mx-3 mb-1 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline text-left"
        >
          View Profile
        </button>
      )}

      {/* Status badges */}
      {(patient.needsFollowUp || patient.hasBalance) && (
        <div className="flex gap-1 px-3 pb-2">
          {patient.needsFollowUp && (
            <span
              data-testid="follow-up-indicator"
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium"
              title="Follow-up needed"
            >
              Follow-up
            </span>
          )}
          {patient.hasBalance && (
            <span
              data-testid="balance-badge"
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
              title="Outstanding balance"
            >
              Balance
            </span>
          )}
        </div>
      )}

      {/* Dental chart thumbnail */}
      {patient.latestChartTeeth && patient.latestChartTeeth.length > 0 && (
        <DentalChartThumbnail teeth={patient.latestChartTeeth} />
      )}

      {/* Last visit */}
      <div className="px-3 pb-2.5">
        <p className="text-[10px] text-muted-foreground/70">{formatLastVisit(patient.lastVisit)}</p>
      </div>
    </div>
  );
}
