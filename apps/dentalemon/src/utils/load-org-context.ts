import { getRuntimeConfig } from '@/utils/config'
import { useOrgContextStore } from '@/stores/org-context.store'

/**
 * Fetch /dental/org/context and seed the Zustand store. Idempotent; safe to
 * call from multiple beforeLoad hooks. Swallows network errors so callers
 * can decide what to do when context is unavailable.
 *
 * Returns the branchId that was populated, or null if no context was found.
 */
export async function loadOrgContext(): Promise<string | null> {
  try {
    const { apiUrl } = await getRuntimeConfig()
    const res = await fetch(`${apiUrl}/dental/org/context`, { credentials: 'include' })
    if (!res.ok) return null
    const ctx = await res.json() as any
    if (!ctx.branch?.id) return null
    useOrgContextStore.getState().setContext({
      branchId: ctx.branch.id,
      orgId: ctx.org?.id ?? null,
      role: ctx.member?.role ?? null,
      memberId: ctx.member?.id ?? null,
    })
    return ctx.branch.id
  } catch {
    return null
  }
}
