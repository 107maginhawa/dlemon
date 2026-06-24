/**
 * SettingsPage — presentational settings shell driven by the panel registry
 * (dental-org FIX-003). Router-free so it can be unit-tested with a role prop.
 *
 * The route file (`routes/_dashboard/settings.tsx`) reads the role from the
 * org-context store and renders this component.
 */
import { useState } from 'react';
import { canAccess } from '@/lib/rbac';
import type { DentalRole } from '@/lib/rbac';
import { SETTINGS_PANELS } from '../settings-panels';

export interface SettingsPageProps {
  role: string;
}

export function SettingsPage({ role }: SettingsPageProps) {
  const dentalRole = (role ?? 'dentist_owner') as DentalRole;
  const [activeKey, setActiveKey] = useState<string>(SETTINGS_PANELS[0]!.key);

  if (!canAccess(dentalRole, 'settings')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to settings.</p>
      </div>
    );
  }

  const active = SETTINGS_PANELS.find((p) => p.key === activeKey) ?? SETTINGS_PANELS[0]!;
  const ActiveComponent = active.Component;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* iPad/desktop refine: 13 sections wrapped to 4-5 pill rows at narrow
          widths and left the desktop right-half empty. Below lg the nav is a
          single horizontally-scrollable row; at lg it becomes a sticky left
          rail so the wide column is used and the panel sits beside it. */}
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
        <div
          role="tablist"
          aria-label="Settings"
          className="flex gap-1 mb-6 overflow-x-auto bg-secondary/50 rounded-xl p-1 lg:mb-0 lg:flex-col lg:overflow-visible lg:bg-transparent lg:p-0 lg:self-start lg:sticky lg:top-6"
        >
          {SETTINGS_PANELS.map((p) => (
            <button
              key={p.key}
              role="tab"
              id={`settings-tab-${p.key}`}
              aria-selected={activeKey === p.key}
              aria-controls={`settings-tabpanel-${p.key}`}
              onClick={() => setActiveKey(p.key)}
              className={`flex items-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors lg:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeKey === p.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`settings-tabpanel-${activeKey}`} aria-labelledby={`settings-tab-${activeKey}`} className="min-w-0">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
