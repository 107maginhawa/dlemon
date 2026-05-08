import { create } from 'zustand'

export interface OrgContextState {
  orgId: string | null
  branchId: string | null
  memberId: string | null
  role: string | null
}

interface OrgContextStore extends OrgContextState {
  setContext: (ctx: Partial<OrgContextState>) => void
  clearContext: () => void
}

export const useOrgContextStore = create<OrgContextStore>((set) => ({
  orgId: null,
  branchId: null,
  memberId: null,
  role: null,
  setContext: (ctx) => set((state) => ({ ...state, ...ctx })),
  clearContext: () => set({ orgId: null, branchId: null, memberId: null, role: null }),
}))
