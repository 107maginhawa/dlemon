/**
 * PatientFolderCard
 *
 * A compact card showing a patient's name, avatar initials, visit count,
 * and status indicators (follow-up needed, has balance).
 *
 * Wireframe: docs/prd/context/wireframes/patient-list.html
 */

import React from 'react';

export interface PatientCardData {
  id: string;
  displayName: string;
  age: number;
  lastVisit?: Date;
  visitCount: number;
  needsFollowUp: boolean;
  hasBalance: boolean;
}

interface PatientFolderCardProps {
  patient: PatientCardData;
  onClick: (patient: PatientCardData) => void;
}

function initials(name: string): string {
  const words = name.replace(/^Dr\.\s*/i, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  }
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

export function PatientFolderCard({ patient, onClick }: PatientFolderCardProps) {
  return (
    <div
      data-testid="patient-folder-card"
      role="button"
      tabIndex={0}
      aria-label={`Open patient record for ${patient.displayName}`}
      onClick={() => onClick(patient)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(patient)}
      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-primary focus-visible:ring-2 focus-visible:ring-primary transition-all cursor-pointer w-36"
    >
      {/* Status indicators */}
      <div className="absolute top-2 right-2 flex gap-1">
        {patient.needsFollowUp && (
          <span
            data-testid="follow-up-indicator"
            className="w-2 h-2 rounded-full bg-yellow-400"
            title="Follow-up needed"
          />
        )}
        {patient.hasBalance && (
          <span
            data-testid="balance-badge"
            className="w-2 h-2 rounded-full bg-red-400"
            title="Outstanding balance"
          />
        )}
      </div>

      {/* Avatar */}
      <div
        data-testid="patient-avatar"
        className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold select-none"
      >
        {initials(patient.displayName)}
      </div>

      {/* Name */}
      <span className="font-medium text-xs text-center leading-tight line-clamp-2">
        {patient.displayName}
      </span>

      {/* Visit count */}
      <span className="text-xs text-muted-foreground">
        {patient.visitCount} {patient.visitCount === 1 ? 'visit' : 'visits'}
      </span>
    </div>
  );
}
