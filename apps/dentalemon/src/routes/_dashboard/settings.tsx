import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ClinicSettings } from '../../features/settings/components/clinic-settings'
import { FeeSchedule } from '../../features/settings/components/fee-schedule'
import { LocaleSettings } from '../../features/settings/components/locale-settings'
import { WorkingHours } from '../../features/settings/components/working-hours'
import { NotificationSettings } from '../../features/settings/components/notification-settings'
import { PermissionGrid } from '../../features/settings/components/permission-grid'
import { canAccess } from '@/lib/rbac'
import type { DentalRole } from '@/lib/rbac'
import { useOrgContextStore } from '@/stores/org-context.store'
import { requireRole } from '@/lib/guards'

export const Route = createFileRoute('/_dashboard/settings')({
  beforeLoad: requireRole('settings'),
  component: SettingsPage,
})

type Tab = 'clinic' | 'fees' | 'locale' | 'hours' | 'notifications' | 'permissions';

function SettingsPage() {
  const [tab, setTab] = useState<Tab>('clinic');
  const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as DentalRole;

  if (!canAccess(role, 'settings')) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to settings.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'clinic', label: 'Clinic' },
    { key: 'hours', label: 'Working Hours' },
    { key: 'fees', label: 'Fee Schedule' },
    { key: 'locale', label: 'Locale' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'permissions', label: 'Permissions' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="flex gap-1 mb-6 bg-secondary/50 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'clinic' && <ClinicSettings />}
      {tab === 'hours' && <WorkingHours />}
      {tab === 'fees' && <FeeSchedule />}
      {tab === 'locale' && <LocaleSettings />}
      {tab === 'notifications' && <NotificationSettings />}
      {tab === 'permissions' && <PermissionGrid />}
    </div>
  );
}
