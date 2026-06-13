import { getRuntimeConfig } from '@/lib/config'
import { useOrgContextStore } from '@/stores/org-context.store'
import { pinSession } from '@/lib/pin-session'

/**
 * Fetch /dental/org/context and seed the Zustand store. Idempotent; safe to
 * call from multiple beforeLoad hooks. Swallows network errors so callers
 * can decide what to do when context is unavailable.
 *
 * Returns the branchId that was populated, or null if no context was found.
 *
 * Members are PIN-only profiles under ONE shared cloud login (the owner's), so
 * /dental/org/context — which resolves membership by that cloud account — always
 * reports the OWNER's membership. The ACTIVE member is whoever unlocked via PIN,
 * tracked in the in-memory pinSession (the authoritative source per the
 * _dashboard guard). We therefore refresh org/branch (org-level, identical for
 * every member) from the server, but keep role/memberId from the pinSession when
 * one is active — overriding them with the server's owner membership would
 * silently elevate a non-owner member to the owner's role (RBAC bypass).
 */
export async function loadOrgContext(): Promise<string | null> {
  try {
    const { apiUrl } = await getRuntimeConfig()
    // eslint-disable-next-line no-restricted-syntax -- bootstrap: loads org context before the SDK query client / store are initialized
    const res = await fetch(`${apiUrl}/dental/org/context`, { credentials: 'include' })
    if (!res.ok) return null
    const ctx = await res.json() as any
    if (!ctx.branch?.id) return null
    const session = pinSession.getSession()
    useOrgContextStore.getState().setContext({
      branchId: ctx.branch.id,
      orgId: ctx.org?.id ?? null,
      role: session?.role ?? ctx.member?.role ?? null,
      memberId: session?.memberId ?? ctx.member?.id ?? null,
      orgStatus: ctx.org?.status ?? null,
    })
    return ctx.branch.id
  } catch {
    return null
  }
}
