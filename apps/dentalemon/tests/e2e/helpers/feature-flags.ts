import type { Page } from '@playwright/test';

/**
 * Enable v2-deferred workspace feature flags for a spec.
 *
 * v1 ships these tools hidden (default-OFF `workspace.*` flags). Specs that
 * exercise a deferred tool's UI must opt back in. This uses the dev-only
 * localStorage override in `src/lib/feature-flags.ts` via `addInitScript`, so it
 * applies to every navigation in the test — call it BEFORE the first navigation.
 */
export async function enableWorkspaceFlags(page: Page, ...flags: string[]): Promise<void> {
  await page.addInitScript((fs: string[]) => {
    for (const f of fs) window.localStorage.setItem(`ff:${f}`, 'true');
  }, flags);
}
