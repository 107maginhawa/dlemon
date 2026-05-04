/**
 * WorkspaceTabs
 *
 * Clinical workspace tab bar: Odontogram | Periodontal | Treatment Plan | Notes
 * Matches the .ws-toolbar pattern in wireframes.
 *
 * Wireframes: ws-tooth-slideout.html, ws-tooth-history.html
 */
import React from 'react';
import { BRAND_GOLD, BRAND_GOLD_TEXT } from '@/constants/brand';

export type WorkspaceTab = 'odontogram' | 'periodontal' | 'treatment-plan' | 'notes';

interface WorkspaceTabsProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'odontogram', label: 'Odontogram' },
  { id: 'periodontal', label: 'Periodontal' },
  { id: 'treatment-plan', label: 'Treatment Plan' },
  { id: 'notes', label: 'Notes' },
];

export function WorkspaceTabs({ activeTab, onTabChange }: WorkspaceTabsProps) {
  return (
    <div role="tablist" aria-label="Workspace sections" className="flex gap-1 border-b border-border pb-0">
      {TABS.map(({ id, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(id)}
            style={isActive ? { borderBottomColor: BRAND_GOLD, color: BRAND_GOLD_TEXT } : undefined}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-[#FFE97D] text-[#4A4018]'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            ].join(' ')}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
