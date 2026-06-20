/**
 * org-context store — active-member context (ISSUE-017).
 *
 * The sidebar footer must show the *active* PIN-selected member, not the
 * Better-Auth account owner. That requires the store to carry the active
 * member's display name (set at PIN entry, cleared on sign-out / switch).
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import { useOrgContextStore } from './org-context.store'

describe('org-context store — active member name (ISSUE-017)', () => {
  beforeEach(() => useOrgContextStore.getState().clearContext())

  test('setContext carries the active member displayName', () => {
    useOrgContextStore
      .getState()
      .setContext({ memberId: 'm1', memberName: 'Ana Santos', role: 'staff_full' })
    expect(useOrgContextStore.getState().memberName).toBe('Ana Santos')
  })

  test('clearContext resets memberName (sign-out / profile switch)', () => {
    useOrgContextStore.getState().setContext({ memberName: 'Ana Santos' })
    useOrgContextStore.getState().clearContext()
    expect(useOrgContextStore.getState().memberName).toBeNull()
  })

  test('memberName defaults to null before any PIN selection', () => {
    expect(useOrgContextStore.getState().memberName).toBeNull()
  })
})
