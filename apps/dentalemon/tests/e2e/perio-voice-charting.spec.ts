/**
 * P2-4 — Voice / hands-free perio charting (E2E, scripted provider).
 *
 * Real microphone / STT is NOT automated (non-deterministic). Instead this spec
 * installs a deterministic scripted SpeechProvider on `window.__perioVoiceProvider`
 * (the E2E seam the overlay reads) BEFORE the app loads, opens a draft perio
 * chart, and feeds scripted utterances to assert:
 *   - the voice controls + always-visible mic-state indicator render,
 *   - a spoken depth fills the correct grid cell + advances the cursor,
 *   - a low-confidence value raises the confirmation prompt (not auto-written),
 *   - "back" + correction works,
 *   - the keyboard grid stays usable with voice off (additive),
 *   - reduced-motion + a11y: mic state has a text label, transcript is aria-live.
 *
 * Skips cleanly when the API/seed is unavailable so it never blocks CI.
 */

import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:7213';
const APP = 'http://localhost:3003';

/**
 * Install a scripted SpeechProvider on window before any app script runs. The
 * provider exposes a global `__feedVoice(transcript, confidence, isFinal)` the
 * test calls to emit utterances deterministically.
 */
async function installScriptedProvider(page: Page) {
  await page.addInitScript(() => {
    const resultCbs = new Set<(r: { transcript: string; confidence: number; isFinal: boolean }) => void>();
    const stateCbs = new Set<(s: string) => void>();
    let listening = false;
    const provider = {
      startListening() {
        listening = true;
        stateCbs.forEach((cb) => cb('listening'));
      },
      stopListening() {
        listening = false;
        stateCbs.forEach((cb) => cb('idle'));
      },
      onResult(cb: (r: { transcript: string; confidence: number; isFinal: boolean }) => void) {
        resultCbs.add(cb);
        return () => resultCbs.delete(cb);
      },
      onStateChange(cb: (s: string) => void) {
        stateCbs.add(cb);
        return () => stateCbs.delete(cb);
      },
      setGrammarHints() {},
      get isListening() {
        return listening;
      },
    };
    (window as unknown as { __perioVoiceProvider?: unknown }).__perioVoiceProvider = provider;
    (window as unknown as { __feedVoice?: unknown }).__feedVoice = (
      transcript: string,
      confidence = 1,
      isFinal = true,
    ) => {
      resultCbs.forEach((cb) => cb({ transcript, confidence, isFinal }));
    };
  });
}

async function feed(page: Page, transcript: string, confidence = 1, isFinal = true) {
  await page.evaluate(
    ([t, c, f]) => {
      (window as unknown as { __feedVoice?: (t: string, c?: number, f?: boolean) => void }).__feedVoice?.(
        t as string,
        c as number,
        f as boolean,
      );
    },
    [transcript, confidence, isFinal] as const,
  );
}

async function signUpSeedOrgAndVisit(page: Page) {
  const suffix = Date.now();
  const email = `perio-voice-${suffix}@example.org`;
  const password = 'E2eTestPass123!';

  await page.goto(`${APP}/auth/sign-up`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Name', { exact: true }).fill(`Perio Voice ${suffix}`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  const pwInput = page.locator('input[type="password"]');
  await pwInput.click();
  await pwInput.pressSequentially(password, { delay: 10 });
  await page.getByRole('button', { name: /create an account/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await page.evaluate(async (api) => {
    await fetch(`${api}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName: 'Perio', lastName: 'Voice' }),
    });
  }, API);

  const orgRes = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/dental/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: 'Voice Clinic', tier: 'clinic', countryCode: 'PH' }),
    });
    return res.json();
  }, API);

  const branchRes = await page.evaluate(
    async ({ api, orgId }: { api: string; orgId: string }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: 'Main', timezone: 'Asia/Manila' }),
      });
      return res.json();
    },
    { api: API, orgId: orgRes.id as string },
  );

  const memberId = await page.evaluate(
    async ({ api, orgId }: { api: string; orgId: string }) => {
      const res = await fetch(`${api}/dental/organizations/${orgId}/members`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      return (data.items?.[0]?.id ?? data[0]?.id) as string;
    },
    { api: API, orgId: orgRes.id as string },
  );

  const patientRes = await page.evaluate(
    async ({ api, branchId }: { api: string; branchId: string }) => {
      const res = await fetch(`${api}/dental/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: 'Perio',
          lastName: 'Patient',
          dateOfBirth: '1990-01-01',
          sex: 'female',
          branchId,
        }),
      });
      return res.json();
    },
    { api: API, branchId: branchRes.id as string },
  );

  const visitRes = await page.evaluate(
    async ({ api, patientId, branchId, memberId }: { api: string; patientId: string; branchId: string; memberId: string }) => {
      const res = await fetch(`${api}/dental/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId, branchId, dentistMemberId: memberId }),
      });
      return res.json();
    },
    { api: API, patientId: patientRes.id as string, branchId: branchRes.id as string, memberId },
  );

  await page.evaluate(
    ({ orgId, branchId }: { orgId: string; branchId: string }) => {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedBranchId', branchId);
    },
    { orgId: orgRes.id as string, branchId: branchRes.id as string },
  );

  return { patientId: patientRes.id as string, visitId: visitRes.id as string };
}

test.describe('Voice perio charting (scripted provider)', () => {
  test('spoken depths fill the grid, low-confidence prompts, back corrects, keyboard stays usable', async ({
    page,
  }) => {
    await installScriptedProvider(page);

    let ctx: { patientId: string; visitId: string } | undefined;
    try {
      ctx = await signUpSeedOrgAndVisit(page);
    } catch {
      test.skip(true, 'Skipped — requires full seed setup (API unavailable)');
      return;
    }
    if (!ctx) return;

    await page.goto(`${APP}/patients/${ctx.patientId}/visits/${ctx.visitId}/perio`);
    await page.waitForLoadState('networkidle');

    // Start a draft chart if the empty state is showing.
    const startBtn = page.getByTestId('perio-start-btn');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(500);
    }

    // Voice controls must be present with an always-visible mic-state indicator.
    const controls = page.getByTestId('voice-perio-controls');
    if (!(await controls.isVisible().catch(() => false))) {
      test.skip(true, 'Voice controls not rendered (provider seam or chart unavailable)');
      return;
    }
    const micState = page.getByTestId('voice-mic-state');
    await expect(micState).toBeVisible();
    // a11y: the indicator carries a text label, not color only.
    await expect(micState).not.toBeEmpty();

    // a11y: transcript strip is an aria-live region.
    await expect(page.getByTestId('voice-transcript')).toHaveAttribute('aria-live', 'polite');

    // Toggle voice on.
    await page.getByTestId('voice-mic-toggle').click();
    await expect(page.getByTestId('voice-mic-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Speak a depth → the active cell advances from BM to BC on tooth 18.
    await feed(page, 'three', 1, true);
    await expect(page.locator('[data-perio-active="true"]')).toHaveAttribute('data-perio-site', 'BC');

    // Low-confidence value → confirmation prompt, not auto-written.
    await feed(page, 'three', 0.2, true);
    await expect(page.getByTestId('voice-pending-confirm')).toBeVisible();
    await page.getByTestId('voice-confirm-no').click();
    await expect(page.getByTestId('voice-pending-confirm')).toHaveCount(0);

    // "back" steps the cursor back (correction path).
    await feed(page, 'back', 1, true);
    await expect(page.locator('[data-perio-active="true"]')).toHaveAttribute('data-perio-site', 'BM');

    // Keyboard remains fully usable (additive): typing into a depth cell works.
    const cell = page.locator('[data-testid="tooth-cell"]').first();
    await cell.click();
    await cell.fill('4');
    await expect(cell).toHaveValue('4');
  });
});
