import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../features/settings/components/settings-page'
import { useOrgContextStore } from '@/stores/org-context.store'
import { requireRole } from '@/lib/guards'

export const Route = createFileRoute('/_dashboard/settings')({
  beforeLoad: requireRole('settings'),
  component: SettingsRoute,
})

// G3 (decision §4): the granular permission grid was removed — it was saved but
// never enforced (`assertPermission` had 0 prod call-sites; `assertBranchRole` is
// the real gate). The coarse role model is the source of truth.
//
// FIX-003: the settings shell is now a minimal panel registry
// (`features/settings/settings-panels.tsx`) consumed by the presentational
// `SettingsPage`. Modules add panels by appending one registry entry.
function SettingsRoute() {
  const role = (useOrgContextStore((s) => s.role) ?? 'dentist_owner') as string;
  return <SettingsPage role={role} />;
}
