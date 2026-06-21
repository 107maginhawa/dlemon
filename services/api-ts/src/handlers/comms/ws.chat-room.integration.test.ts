/**
 * ws.chat-room.integration.test.ts — comms chat-room WebSocket auth boundary
 *
 * The sibling ws.chat-room.test.ts asserts only the config SHAPE (path/middleware
 * array/handlers exist). It is blind to whether the auth guard actually runs on the
 * real app. This boots the production app (createApp) and drives the upgrade route to
 * prove the live middleware chain REJECTS an unauthenticated connection before any
 * onConnect/room logic — the security-critical property. comms has no UI in
 * apps/dentalemon, so this server-level test is the honest analogue of an e2e.
 */

import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const app = createApp(parseConfig());
const ROOM = 'a7000000-0000-4000-8000-0000000000c1';

describe('comms chat-room WS — auth boundary (real app)', () => {
  test('unauthenticated upgrade → 401 (auth middleware rejects before onConnect)', async () => {
    const res = await app.request(`/ws/comms/chat-rooms/${ROOM}`);
    expect(res.status).toBe(401);
    // The route IS wired (not a 404 fall-through) — the 401 comes from the guard,
    // not a missing route.
    expect(res.status).not.toBe(404);
  });

  test('an invalid bearer token is also rejected (401), never upgraded', async () => {
    const res = await app.request(`/ws/comms/chat-rooms/${ROOM}`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status).toBe(401);
  });
});
