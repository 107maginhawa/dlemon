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

      <div className="flex gap-1 mb-6 bg-secondary/50 rounded-xl p-1 w-fit flex-wrap">
        {SETTINGS_PANELS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveKey(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeKey === p.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
}
