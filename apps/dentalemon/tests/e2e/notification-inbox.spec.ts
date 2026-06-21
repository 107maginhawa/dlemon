/**
 * E2E: In-app notification inbox (notifications FIX-001 / GAP-1 — Batch A backfill)
 *
 * Proves the in-app notification surface (bell + unread badge + inbox panel,
 * powered by the previously-zero-consumer listNotifications / markNotificationAsRead
 * ops) is reachable end-to-end against the real API with a REAL producer-written
 * notification — closing the FR10.9 dead-end the component tests can only assert
 * in isolation.
 *
 * Seeding uses a real producer, not a synthetic insert: the logged-in user hosts a
 * booking event, books their own open slot, then cancels it. `cancelBooking`
 * (services/api-ts/src/handlers/booking/cancelBooking.ts) writes an in-app
 * notification to `recipient: user.id` — i.e. the authenticated member's own
 * inbox. The whole flow runs as a SINGLE user (host == client), so there is no
 * auth switch to corrupt the in-memory PIN session.
 *
 * Preconditions:
 *  - API running on localhost:7213
 *  - App running on localhost:3003
 */

import { test, expect, type Page } from '@playwright/test';
import { API, signUpOnboardAndUnlock, spaNavigate } from './helpers/e2e-seed';

/**
 * Produce one real in-app notification in the authenticated user's inbox via the
 * booking module (host an active event → book own slot → cancel). Returns nothing;
 * the notification is recipient-scoped to the caller server-side.
 */
async function seedSelfNotification(page: Page): Promise<void> {
  const eventId = await page.evaluate(async (api) => {
    const cfg = { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30 }] };
    const res = await fetch(`${api}/booking/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: 'Inbox seed consult',
        timezone: 'America/New_York',
        locationTypes: ['video'],
        maxBookingDays: 60,
        minBookingMinutes: 60,
        status: 'active',
        effectiveFrom: '2026-01-01T00:00:00Z',
        dailyConfigs: { mon: cfg, tue: cfg, wed: cfg, thu: cfg, fri: cfg },
      }),
    });
    if (!res.ok) throw new Error(`event create failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).id as string;
  }, API);

  const slotId = await page.evaluate(
    async ({ api, eventId }) => {
      const res = await fetch(`${api}/booking/events/${eventId}/slots?status=available`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`slot list failed (${res.status})`);
      const slots = (await res.json()) as Array<{ id: string }>;
      const first = Array.isArray(slots) ? slots[0] : undefined;
      if (!first) throw new Error('no available slots generated');
      return first.id;
    },
    { api: API, eventId },
  );

  const bookingId = await page.evaluate(
    async ({ api, slotId }) => {
      const res = await fetch(`${api}/booking/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slot: slotId, locationType: 'video', reason: 'Inbox seed' }),
      });
      if (!res.ok) throw new Error(`booking create failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return (await res.json()).id as string;
    },
    { api: API, slotId },
  );

  await page.evaluate(
    async ({ api, bookingId }) => {
      const res = await fetch(`${api}/booking/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Inbox seed cancellation' }),
      });
      if (!res.ok) throw new Error(`booking cancel failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    },
    { api: API, bookingId },
  );
}

test.describe('In-app notification inbox (FIX-001)', () => {
  test('a producer-written notification surfaces in the bell and round-trips through mark-read', async ({
    page,
  }) => {
    // The bell refetches on a 60s interval; allow the eventual-consistency backstop.
    test.setTimeout(120_000);

    await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'Inbox' });

    // Produce a real in-app notification for the authenticated member.
    await seedSelfNotification(page);

    // Land on a dashboard route so the shell bell is rendered.
    await spaNavigate(page, '/dashboard');

    const bell = page.getByTestId('notification-bell');
    await bell.waitFor({ state: 'visible', timeout: 10_000 });

    // Nudge the bell's query to refetch immediately (TanStack refetchOnWindowFocus);
    // the 60s refetchInterval is the ultimate backstop covered by the test timeout.
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The unread badge reflects the seeded notification.
    const badge = page.getByTestId('notification-unread-badge');
    await expect(badge).toBeVisible({ timeout: 65_000 });

    // Open the inbox — the seeded "Booking Cancelled" row is listed.
    await bell.click();
    const inbox = page.getByTestId('notification-inbox');
    await expect(inbox).toBeVisible();
    await expect(inbox).toContainText(/Booking Cancelled/i);

    const rowsBefore = await page.getByTestId('notification-row').count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Mark the first row read → it leaves the unread list (the badge + rows share one query).
    await page.getByTestId('notification-mark-read').first().click();
    await expect
      .poll(async () => page.getByTestId('notification-row').count(), { timeout: 10_000 })
      .toBeLessThan(rowsBefore);
  });

  test('mark all read clears every unread notification + badge via POST /notifs/read-all', async ({
    page,
  }) => {
    // The bell refetches on a 60s interval; allow the eventual-consistency backstop.
    test.setTimeout(120_000);

    await signUpOnboardAndUnlock(page, { tier: 'solo', label: 'MarkAll' });

    // TWO real producer-written notifications so "mark ALL" is distinguishable from
    // marking one (each booking cancel writes one notification to the caller's inbox).
    await seedSelfNotification(page);
    await seedSelfNotification(page);

    await spaNavigate(page, '/dashboard');

    const bell = page.getByTestId('notification-bell');
    await bell.waitFor({ state: 'visible', timeout: 10_000 });
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const badge = page.getByTestId('notification-unread-badge');
    await expect(badge).toBeVisible({ timeout: 65_000 });

    await bell.click();
    const inbox = page.getByTestId('notification-inbox');
    await expect(inbox).toBeVisible();
    await expect
      .poll(async () => page.getByTestId('notification-row').count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);

    // Drive "Mark all read" and assert the live POST /notifs/read-all round-trip.
    const markAll = page.getByTestId('notification-mark-all');
    await expect(markAll).toBeVisible();
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/notifs\/read-all/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 10_000 },
      ),
      markAll.click(),
    ]);
    expect(resp.status(), 'POST /notifs/read-all must be 200').toBe(200);

    // Goal state: the whole unread list collapses — rows gone, badge gone, the
    // "Mark all read" affordance itself gone, and the empty state shown.
    await expect
      .poll(async () => page.getByTestId('notification-row').count(), { timeout: 10_000 })
      .toBe(0);
    await expect(badge).not.toBeVisible({ timeout: 5_000 });
    await expect(markAll).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('notification-empty')).toBeVisible();
  });
});
