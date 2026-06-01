/**
 * TR-DG-002 — GET /dental/branches route registration smoke (real app).
 * Migrated from app.ts hand-mount to TypeSpec codegen
 * (dental-org.tsp BranchConfigManagement.getBranchesByUser). Unauthenticated
 * must 401 (registered + auth-gated), NOT 404 (missing).
 */
import { describe, test, expect } from 'bun:test';
import { createApp, parseConfig } from '@/index';

const app = createApp(parseConfig());

describe('TR-DG-002 — GET /dental/branches is codegen-registered (real app)', () => {
  test('unauthenticated → 401 (not 404)', async () => {
    const res = await app.request('/dental/branches');
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});
