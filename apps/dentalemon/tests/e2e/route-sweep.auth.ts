/**
 * route-sweep.auth.ts — Dentalemon auth + seed adapter for the authed route sweep.
 *
 * Signs in to the pre-seeded demo org (demo@dentalemon.com) via API, sets the
 * frontend org-context localStorage, and resolves an existing patient id. Run
 * once per worker; storageState (cookie + localStorage) is reused across the
 * whole matrix. We use existing data (not fresh signup) so the loop doesn't
 * depend on the dev instance's email-verification flow.
 *
 * We do NOT seed recalls — the 401 bug reproduces on any patient because the
 * app's recalls fetch omits credentials:'include' (cross-origin → no cookie).
 */
import type { Page } from "@playwright/test";

const API = "http://localhost:7213";
const APP = "http://localhost:3003";

export interface OliAuthAdapter {
  setup(page: Page): Promise<{ paramFixtures?: Record<string, string> }>;
}

export const authAdapter: OliAuthAdapter = {
  async setup(page) {
    await page.goto(APP); // establish the :3003 origin so localStorage lands there
    const data = await page.evaluate(
      async ({ api }) => {
        const si = await fetch(`${api}/auth/sign-in/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: "demo@dentalemon.com", password: "DemoClinic1!" }),
        });
        if (!si.ok) throw new Error(`sign-in ${si.status}: ${(await si.text()).slice(0, 200)}`);

        const ctxRes = await fetch(`${api}/dental/org/context`, { credentials: "include" });
        if (!ctxRes.ok) throw new Error(`org/context ${ctxRes.status}`);
        const ctx = await ctxRes.json();
        localStorage.setItem("currentOrgId", ctx.org.id);
        localStorage.setItem("currentBranchId", ctx.branch.id);
        localStorage.setItem("currentMemberId", ctx.member.id);
        localStorage.setItem("currentMemberRole", ctx.member.role);

        const plRes = await fetch(`${api}/dental/patients?branchId=${ctx.branch.id}`, { credentials: "include" });
        if (!plRes.ok) throw new Error(`patients ${plRes.status}`);
        const pl = await plRes.json();
        const first = (pl.data ?? [])[0];
        return { patientId: first?.id as string | undefined };
      },
      { api: API },
    );
    if (!data.patientId) throw new Error("no existing patient found in demo org");
    return { paramFixtures: { patientId: data.patientId } };
  },
};
