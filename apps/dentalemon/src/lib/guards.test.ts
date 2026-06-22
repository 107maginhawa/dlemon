/**
 * requireRole route-guard tests (#51).
 *
 * requireRole(module) reads the active member role from the org-context store and
 * throws a redirect to /dashboard when the role is missing or lacks module access
 * (per the RBAC matrix). Otherwise it passes (returns nothing).
 */
import { describe, test, expect, afterEach } from 'bun:test'
import { requireRole } from './guards'
import { useOrgContextStore } from '@/stores/org-context.store'

/** redirect() throws a Redirect object carrying the destination `to`. */
function redirectTarget(fn: () => void): string {
  try {
    fn()
  } catch (err) {
    return (err as { to?: string }).to ?? '(no .to — not a redirect)'
  }
  throw new Error('expected the guard to throw a redirect')
}

afterEach(() => {
  useOrgContextStore.getState().clearContext()
})

describe('requireRole', () => {
  test('passes when the role has module access (dentist_owner → reports)', () => {
    useOrgContextStore.setState({ role: 'dentist_owner' })
    expect(() => requireRole('reports')()).not.toThrow()
  })

  test('redirects to /dashboard when the role lacks module access (staff_scheduling → reports)', () => {
    useOrgContextStore.setState({ role: 'staff_scheduling' })
    expect(redirectTarget(requireRole('reports'))).toBe('/dashboard')
  })

  test('redirects to /dashboard when no role is set', () => {
    // store role defaults to null
    expect(redirectTarget(requireRole('patients'))).toBe('/dashboard')
  })

  test('an unknown role is treated as no access', () => {
    useOrgContextStore.setState({ role: 'not_a_real_role' })
    expect(redirectTarget(requireRole('patients'))).toBe('/dashboard')
  })
})
