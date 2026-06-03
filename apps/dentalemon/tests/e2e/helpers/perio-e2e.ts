/**
 * Shared E2E helpers for the perio specs (charting / voice / iPad layout).
 *
 * The perio workspace is PIN-gated and tab-based: there is no standalone perio
 * route. The real flow is sign up → onboard a clinic (one /dental/onboarding
 * call) → set a member PIN → unlock the workspace → SPA-navigate to /$patientId
 * → click the Perio tab. These helpers encode the PIN/unlock/SPA-nav pieces so
 * each spec doesn't re-implement them (and drift apart).
 */

import { expect, type Page } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:7213';
export const APP = process.env.APP_URL ?? 'http://localhost:3003';

/** Set a 6-digit PIN on a membership via the org admin endpoint. */
export async function setMemberPin(
  page: Page,
  opts: { orgId: string; branchId: string; memberId: string; pin: string },
): Promise<void> {
  await page.evaluate(
    async ({ api, orgId, branchId, memberId, pin }) => {
      const res = await fetch(
        `${api}/dental/organizations/${orgId}/branches/${branchId}/members/${memberId}/set-pin`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin }),
        },
      );
      if (!res.ok) throw new Error(`set-pin failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    },
    { api: API, ...opts },
  );
}

/**
 * Drive the real PIN-select → PIN-entry flow to mint the in-memory pinSession.
 * The workspace route tree is PIN-gated; the session lives only in memory, so it
 * must be unlocked through the UI (it cannot be seeded via localStorage).
 */
export async function unlockWorkspace(page: Page, pin: string): Promise<void> {
  await page.goto(`${APP}/auth/pin-select`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('group', { name: /PIN keypad/i })).toBeVisible({ timeout: 15000 });
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => !url.pathname.includes('/auth/pin'), { timeout: 15000 });
}

/**
 * Client-side (SPA) navigation that preserves the in-memory PIN session. A hard
 * `page.goto` reloads the app and resets pinSession, bouncing back to the PIN gate.
 */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForURL((url) => url.pathname === path, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}
