/**
 * AppSidebar role-filtering tests (J-RBAC-NAV-001 / F11)
 *
 * Authority: src/lib/rbac.ts ACCESS_MATRIX (single source of truth, same one
 * the route `requireRole(module)` guards use). The sidebar nav must hide links
 * to modules the current role cannot access, so it never advertises a route the
 * guard will bounce back to /dashboard.
 */
import { describe, test, expect } from 'bun:test'
import { filterNavGroupsByRole, type NavGroup } from './app-sidebar'
import type { DentalRole } from '@/lib/rbac'

// Icons are omitted intentionally: `icon` is optional and irrelevant to the
// role-filtering logic, and the lucide CJS build used by the bun test runtime
// does not export every icon name. The filtering is pure data → no DOM/router.
const GROUPS: NavGroup[] = [
  {
    label: 'Clinical',
    items: [
      // No module key -> always visible (e.g. a generic link everyone keeps)
      { title: 'Home', url: '/home' },
      { title: 'Patients', url: '/patients', module: 'patients' },
    ],
  },
  {
    label: 'Operations',
    items: [{ title: 'Billing', url: '/billing', module: 'billing' }],
  },
  {
    label: 'Admin',
    items: [
      { title: 'Staff', url: '/staff', module: 'staff' },
      { title: 'Settings', url: '/settings', module: 'settings' },
    ],
  },
]

function titlesFor(role: DentalRole | null): string[] {
  return filterNavGroupsByRole(GROUPS, role).flatMap((g) => g.items.map((i) => i.title))
}

describe('filterNavGroupsByRole', () => {
  test('dentist_owner sees every link including Staff/Settings/Billing', () => {
    const titles = titlesFor('dentist_owner')
    expect(titles).toEqual(['Home', 'Patients', 'Billing', 'Staff', 'Settings'])
  })

  test('staff_full sees Billing but NOT Staff/Settings (no admin links)', () => {
    const titles = titlesFor('staff_full')
    expect(titles).toContain('Billing')
    expect(titles).not.toContain('Staff')
    expect(titles).not.toContain('Settings')
  })

  test('staff_scheduling (limited) sees Patients only — no Billing/Staff/Settings', () => {
    const titles = titlesFor('staff_scheduling')
    expect(titles).toContain('Patients')
    expect(titles).not.toContain('Billing')
    expect(titles).not.toContain('Staff')
    expect(titles).not.toContain('Settings')
  })

  test('module-less items (Home) stay visible for every role', () => {
    expect(titlesFor('staff_scheduling')).toContain('Home')
    expect(titlesFor('read_only')).toContain('Home')
  })

  test('empty groups are dropped (Admin group disappears for staff_full)', () => {
    const groups = filterNavGroupsByRole(GROUPS, 'staff_full')
    expect(groups.map((g) => g.label)).not.toContain('Admin')
  })

  test('null/loading role hides every module-gated link but keeps module-less ones', () => {
    // Safe subset: do not flash admin links before role resolves.
    const titles = titlesFor(null)
    expect(titles).toEqual(['Home'])
  })
})
