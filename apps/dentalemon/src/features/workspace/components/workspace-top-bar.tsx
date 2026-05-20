/**
 * WorkspaceTopBar — frosted glass top bar for the workspace
 *
 * Left:   Patient avatar chip (initials) + display name + chevron
 * Center: Safety floor — active allergies, medications, conditions
 * Right:  Visit date + 5 action icon buttons
 *
 * Wireframe: docs/prd/context/wireframes/workspace-wireframe.html
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Pill, Pencil, Paperclip, List, Maximize2, Minimize2, ChevronDown, CheckCircle2, FileSignature } from 'lucide-react';
import { usePatientProfile } from '@/features/patients/hooks/use-patient-profile';
import { useMedicalHistory } from '@/features/workspace/hooks/use-medical-history';

interface WorkspaceTopBarProps {
  patientId: string;
  visitDate?: string;
  onRx: () => void;
  onConsent: () => void;
  onLab: () => void;
  onPmd: () => void;
  onAttachments: () => void;
  onNotes: () => void;
  onTreatmentPlan: () => void;
  onCompleteVisit: () => void;
  visitStatus?: 'draft' | 'active' | 'completed' | 'locked';
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  return (
    <IconButton label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggle}>
      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </IconButton>
  );
}

export function WorkspaceTopBar({
  patientId,
  visitDate,
  onRx,
  onConsent,
  onLab,
  onPmd,
  onAttachments,
  onNotes,
  onTreatmentPlan,
  onCompleteVisit,
  visitStatus,
}: WorkspaceTopBarProps) {
  const { data: profile } = usePatientProfile({ patientId });
  const { entries } = useMedicalHistory(patientId);

  const firstName = profile?.firstName ?? '';
  const lastName = profile?.lastName ?? '';
  const initials = (
    (firstName[0] ?? '') + (lastName[0] ?? '')
  ).toUpperCase() || '?';
  const displayName = profile?.displayName ?? 'Patient';

  const safetyItems = entries.filter(
    (e) =>
      e.active &&
      (e.entryType === 'allergy' ||
        e.entryType === 'medication' ||
        e.entryType === 'condition'),
  );

  const badgeColor: Record<string, string> = {
    allergy: 'bg-red-100 text-red-700 border-red-200',
    medication: 'bg-orange-100 text-orange-700 border-orange-200',
    condition: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  };

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b backdrop-blur-xl bg-white/70 supports-[backdrop-filter]:bg-white/70">
      {/* LEFT: Patient avatar + name */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: 'rgba(255,233,125,0.3)', color: '#4A4018' }}
          aria-label={`Patient avatar: ${displayName}`}
        >
          {initials}
        </div>
        <span className="text-sm font-semibold truncate max-w-[120px]">{displayName}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>

      {/* CENTER: Safety floor */}
      {safetyItems.length > 0 && (
        <div className="flex-1 flex items-center justify-center min-w-0">
          <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 flex gap-1 flex-wrap max-w-full overflow-hidden">
            {safetyItems.slice(0, 6).map((item) => (
              <span
                key={item.id}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  badgeColor[item.entryType] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
                title={`${item.entryType}: ${item.displayName}`}
              >
                {item.displayName}
              </span>
            ))}
            {safetyItems.length > 6 && (
              <span className="text-[10px] text-red-500 font-semibold">
                +{safetyItems.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
      {safetyItems.length === 0 && <div className="flex-1" />}

      {/* RIGHT: Visit date + icon buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {visitDate && (
          <span className="text-xs text-muted-foreground mr-2">{visitDate}</span>
        )}
        <IconButton label="Write prescription" onClick={onRx}>
          <Pill className="h-4 w-4" />
        </IconButton>
        <IconButton label="Consent" onClick={onConsent}>
          <FileSignature className="h-4 w-4" />
        </IconButton>
        <IconButton label="Notes / Medical History" onClick={onNotes}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton label="Attachments" onClick={onAttachments}>
          <Paperclip className="h-4 w-4" />
        </IconButton>
        <IconButton label="Treatment Plan" onClick={onTreatmentPlan}>
          <List className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Complete visit"
          onClick={onCompleteVisit}
          disabled={visitStatus !== 'active'}
        >
          <CheckCircle2 className="h-4 w-4" />
        </IconButton>
        <FullscreenButton />
      </div>
    </header>
  );
}
