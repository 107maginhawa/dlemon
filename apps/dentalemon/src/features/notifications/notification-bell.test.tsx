/**
 * NotificationBell tests — notifications FIX-001 (GAP-1 in-app surface).
 *
 * Pins the real wiring of the bell + unread badge + inbox panel to the generated
 * SDK notification operations (`listNotifications` status=unread, `markNotificationAsRead`,
 * `markAllNotificationsAsRead`). Uses a STATEFUL `global.fetch` mock so mark-read and
 * mark-all prove the true round-trip (invalidate → refetch → badge recomputes), not an
 * optimistic fiction. The badge count and the rendered rows come from the SAME unread
 * query, so the coherence oracle (`assertCountMatchesItems`) guards against the
 * summary-vs-body divergence bug class.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { freshClientWithMutations, makeWrapper, jsonResponse, assertCountMatchesItems } from '@/test-utils';
import { NotificationBell } from './notification-bell';

const NOTIFS = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    version: 1,
    recipient: 'd1000000-0000-4000-8000-000000000001',
    type: 'appointment.reminder',
    channel: 'in-app',
    title: 'Appointment reminder',
    message: 'Cleaning for Room 2 at 2:00 PM',
    status: 'sent',
    createdAt: '2026-06-11T09:00:00.000Z',
    updatedAt: '2026-06-11T09:00:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    version: 1,
    recipient: 'd1000000-0000-4000-8000-000000000001',
    type: 'recall.due',
    channel: 'in-app',
    title: 'Recall due',
    message: '6-month checkup is due',
    status: 'delivered',
    createdAt: '2026-06-11T08:00:00.000Z',
    updatedAt: '2026-06-11T08:00:00.000Z',
  },
];

const originalFetch = global.fetch;
let lastListUrl = '';
let lastMethods: string[] = [];

/**
 * Honest paginated envelope: `data` is the page (≤ limit) while `totalCount` is the
 * FULL unread count — exactly what the backend returns. This is what lets the badge
 * (totalCount) legitimately exceed the rows on the page, so the truncation footer
 * can be exercised.
 */
function paginate(rows: unknown[], limit: number) {
  const page = rows.slice(0, limit);
  return {
    data: page,
    pagination: {
      offset: 0,
      limit,
      count: page.length,
      totalCount: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      currentPage: 1,
      hasNextPage: rows.length > limit,
      hasPreviousPage: false,
    },
  };
}

/** Install a stateful notifications server backed by a mutable unread array. */
function installServer(initial = NOTIFS, opts: { error?: boolean } = {}) {
  let unread = initial.map((n) => ({ ...n }));
  lastListUrl = '';
  lastMethods = [];
  global.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method ?? (typeof input !== 'string' ? input.method : 'GET') ?? 'GET').toUpperCase();
    lastMethods.push(`${method} ${url}`);

    // mark-all read
    if (url.includes('/notifs/read-all')) {
      const n = unread.length;
      unread = [];
      return jsonResponse({ markedCount: n });
    }
    // mark a single notification read: /notifs/{id}/read
    const readMatch = url.match(/\/notifs\/([^/?]+)\/read(?:$|\?)/);
    if (readMatch) {
      const id = readMatch[1];
      const found = unread.find((x) => x.id === id);
      unread = unread.filter((x) => x.id !== id);
      return jsonResponse({ ...(found ?? { id }), status: 'read' });
    }
    // list notifications (unread)
    if (url.includes('/notifs')) {
      lastListUrl = url;
      if (opts.error) return new Response('err', { status: 500 });
      const limit = Number(new URLSearchParams(url.split('?')[1] ?? '').get('limit') ?? '25') || 25;
      return jsonResponse(paginate(unread, limit));
    }
    return jsonResponse(paginate([], 25));
  }) as typeof fetch;
}

/** Build N distinct unread notifications (for window/truncation cases). */
function manyUnread(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    ...NOTIFS[0],
    id: `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Reminder ${i + 1}`,
    message: `Message ${i + 1}`,
  }));
}

afterEach(() => {
  global.fetch = originalFetch;
  cleanup();
});

function renderBell() {
  render(React.createElement(NotificationBell), { wrapper: makeWrapper(freshClientWithMutations()) });
}

describe('NotificationBell', () => {
  test('renders the bell control', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
  });

  test('shows the unread badge with the count from the unread query', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-unread-badge').textContent).toContain('2'));
  });

  test('only queries the unread (in-app) notifications', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(lastListUrl).toContain('status=unread'));
    expect(lastListUrl).toContain('channel=in-app');
  });

  test('hides the badge when there are no unread notifications', async () => {
    installServer([]);
    renderBell();
    // Let the query resolve, then assert no badge.
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    await waitFor(() => expect(lastListUrl).toContain('/notifs'));
    expect(screen.queryByTestId('notification-unread-badge')).toBeNull();
  });

  test('opens the inbox and renders the notification rows', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(2));
    expect(screen.getByText('Appointment reminder')).not.toBeNull();
    expect(screen.getByText(/Cleaning for Room 2/)).not.toBeNull();
  });

  test('the badge count matches the number of unread rows rendered (coherence)', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(2));
    const badge = Number(screen.getByTestId('notification-unread-badge').textContent);
    const rows = screen.getAllByTestId('notification-row').length;
    assertCountMatchesItems({ count: badge, itemCount: rows, label: 'unread badge' });
  });

  test('mark read calls the API, removes the row, and decrements the badge', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(2));
    fireEvent.click(screen.getAllByTestId('notification-mark-read')[0]);
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(1));
    await waitFor(() => expect(screen.getByTestId('notification-unread-badge').textContent).toContain('1'));
    expect(lastMethods.some((m) => m.startsWith('POST') && /\/notifs\/[^/]+\/read/.test(m))).toBe(true);
  });

  test('mark all read clears the inbox and the badge', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getByTestId('notification-mark-all')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-mark-all'));
    await waitFor(() => expect(screen.getByTestId('notification-empty')).not.toBeNull());
    expect(screen.queryByTestId('notification-unread-badge')).toBeNull();
    expect(lastMethods.some((m) => m.startsWith('POST') && m.includes('/notifs/read-all'))).toBe(true);
  });

  test('shows an honest empty state when caught up', async () => {
    installServer([]);
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getByTestId('notification-empty')).not.toBeNull());
    expect(screen.queryByTestId('notification-mark-all')).toBeNull();
  });

  test('shows an error state when the query fails', async () => {
    installServer(NOTIFS, { error: true });
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getByTestId('notification-error')).not.toBeNull());
  });

  test('does not show a stale badge when the unread query fails', async () => {
    installServer(NOTIFS, { error: true });
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    await waitFor(() => expect(lastListUrl).toContain('/notifs'));
    // No successful unread data ⇒ no count to show ⇒ no badge (never a count with an error panel).
    expect(screen.queryByTestId('notification-unread-badge')).toBeNull();
  });

  test('shows an honest "showing N of M" footer when unread exceeds the page size', async () => {
    installServer(manyUnread(30));
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    // Only the first page (25) renders, but the badge knows the true total (30).
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(25));
    const footer = await screen.findByTestId('notification-more');
    expect(footer.textContent).toContain('25');
    expect(footer.textContent).toContain('30');
    // Capped visual badge.
    expect(screen.getByTestId('notification-unread-badge').textContent).toContain('9+');
  });

  test('caps the badge at "9+" but shows all rows when they fit the page (no footer)', async () => {
    installServer(manyUnread(12));
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getAllByTestId('notification-row').length).toBe(12));
    expect(screen.getByTestId('notification-unread-badge').textContent).toContain('9+');
    // All 12 fit (limit 25) ⇒ no truncation, so no "showing N of M" footer.
    expect(screen.queryByTestId('notification-more')).toBeNull();
  });

  test('closes the panel when Escape is pressed', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(screen.getByTestId('notification-inbox')).not.toBeNull());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('notification-inbox')).toBeNull());
  });

  test('the inbox panel is focusable for keyboard users', async () => {
    installServer();
    renderBell();
    await waitFor(() => expect(screen.getByTestId('notification-bell')).not.toBeNull());
    fireEvent.click(screen.getByTestId('notification-bell'));
    const panel = await screen.findByTestId('notification-inbox');
    // The dialog is programmatically focusable (tabIndex) so focus can enter it.
    expect(panel.getAttribute('tabindex')).toBe('-1');
  });
});
