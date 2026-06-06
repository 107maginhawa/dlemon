/**
 * loadOrgContext — unit tests
 *
 * Guards the PIN-member role-tracking contract: members are PIN-only profiles
 * under ONE shared cloud login (the owner's). The server's /dental/org/context
 * resolves membership by that cloud account, so it always reports the OWNER's
 * role. loadOrgContext must therefore NOT let the server response override the
 * active PIN member's role — doing so silently elevates a non-owner member to
 * the owner's privileges (RBAC bypass in the sidebar + requireRole guards).
 */
import { describe, test, expect, afterEach, mock } from 'bun:test';
import { useOrgContextStore } from '@/stores/org-context.store';
import { pinSession } from '@/lib/pin-session';
import { loadOrgContext } from './load-org-context';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  pinSession.clearSession();
  useOrgContextStore.getState().clearContext();
});

function serverOwnerContext() {
  return {
    org: { id: 'org1', name: 'O', tier: 'solo' },
    branch: { id: 'branch1', name: 'B', timezone: 'Asia/Manila' },
    member: { id: 'owner-m', role: 'dentist_owner', displayName: 'Owner' },
  };
}

/**
 * Route fetch: the runtime-config probe gets an empty body (so getRuntimeConfig
 * falls back to apiBaseUrl), and /dental/org/context gets the owner context.
 * Avoids mock.module('@/lib/config'), which is process-global in bun and would
 * clobber sibling tests' config imports.
 */
function mockFetch(context: ReturnType<typeof serverOwnerContext>) {
  global.fetch = mock((req: Request | string | URL) => {
    const url = req instanceof Request ? req.url : String(req);
    if (url.includes('/dental/org/context')) {
      return Promise.resolve(new Response(JSON.stringify(context), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  }) as typeof fetch;
}

describe('loadOrgContext', () => {
  test('refreshes org + branch from the server', async () => {
    mockFetch(serverOwnerContext());
    await loadOrgContext();
    const s = useOrgContextStore.getState();
    expect(s.branchId).toBe('branch1');
    expect(s.orgId).toBe('org1');
  });

  test('no PIN session: seeds role + memberId from the server response', async () => {
    mockFetch(serverOwnerContext());
    await loadOrgContext();
    const s = useOrgContextStore.getState();
    expect(s.role).toBe('dentist_owner');
    expect(s.memberId).toBe('owner-m');
  });

  test('active PIN member: does NOT override role/memberId with the cloud-account owner (no privilege escalation)', async () => {
    // A staff_full member is at the chair, under the owner's shared cloud login.
    pinSession.startSession({ memberId: 'staff-m', displayName: 'Front Desk', role: 'staff_full' });
    // Server resolves membership by the cloud account → reports the OWNER.
    mockFetch(serverOwnerContext());

    await loadOrgContext();

    const s = useOrgContextStore.getState();
    expect(s.role, 'active PIN member must not be elevated to owner').toBe('staff_full');
    expect(s.memberId).toBe('staff-m');
    // org/branch still refresh (org-level, identical for every member).
    expect(s.branchId).toBe('branch1');
    expect(s.orgId).toBe('org1');
  });
});
