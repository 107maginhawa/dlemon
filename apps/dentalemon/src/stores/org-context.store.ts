import { create } from 'zustand'

export interface OrgContextState {
  orgId: string | null
  branchId: string | null
  memberId: string | null
  /** Active PIN-selected member's display name (ISSUE-017) — the sidebar shows
   * this, NOT the Better-Auth account owner, so a shared kiosk reflects who is
   * actually acting. Set at PIN entry, cleared on sign-out / profile switch. */
  memberName: string | null
  role: string | null
  /** Org lifecycle status — 'provisional' clinics must be activated before PHI writes (C-1). */
  orgStatus: string | null
}

interface OrgContextStore extends OrgContextState {
  setContext: (ctx: Partial<OrgContextState>) => void
  clearContext: () => void
}

export const useOrgContextStore = create<OrgContextStore>((set) => ({
  orgId: null,
  branchId: null,
  memberId: null,
  memberName: null,
  role: null,
  orgStatus: null,
  setContext: (ctx) => set((state) => ({ ...state, ...ctx })),
  clearContext: () =>
    set({ orgId: null, branchId: null, memberId: null, memberName: null, role: null, orgStatus: null }),
}))
