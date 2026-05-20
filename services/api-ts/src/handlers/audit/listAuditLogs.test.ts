/**
 * listAuditLogs handler unit tests
 *
 * Strategy: The handler instantiates `new AuditRepository(db, logger)` internally,
 * so we use `mock.module` (bun:test) to replace the entire module with a
 * controllable fake. Tests that exercise repository interaction require the
 * module mock to be registered before the handler is imported.
 *
 * Tests that only touch the date-validation guard (which throws before any repo
 * call) work against the real implementation without module mocking.
 *
 * Full integration coverage (real DB round-trips) lives alongside the other
 * handler tests in the `buildTestApp` / real-postgres pattern used by
 * listMembers.test.ts. This file covers the unit-testable surface only.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ValidationError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Shared mock state — mutated per-test via beforeEach
// ---------------------------------------------------------------------------

const mockFindMany = mock(async () => [] as any[]);
const mockCount = mock(async () => 0);
const mockLogEvent = mock(async () => {});

// Replace the AuditRepository constructor so the handler receives our fakes.
// `mock.module` hoists the replacement before the first `import` of the target.
mock.module('./repos/audit.repo', () => ({
  AuditRepository: class {
    findMany = mockFindMany;
    count = mockCount;
    logEvent = mockLogEvent;
  },
}));

// Import AFTER mock.module registration so the handler picks up the mock.
const { listAuditLogs } = await import('./listAuditLogs');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal audit log entry shape the handler expects to map over. */
function makeLogEntry(overrides?: Partial<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  purgeAfter: Date | null;
}>) {
  return {
    id: 'log-1',
    eventType: 'data-access',
    category: 'administrative',
    action: 'read',
    outcome: 'success',
    user: 'user-1',
    userType: 'admin',
    resourceType: 'audit_log',
    resource: 'audit_logs_query',
    description: 'Test audit log entry',
    details: null,
    ipAddress: null,
    userAgent: null,
    session: null,
    request: null,
    integrityHash: null,
    retentionStatus: 'active',
    createdAt: new Date('2025-06-01T00:00:00.000Z'),
    updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    archivedAt: null,
    purgeAfter: null,
    version: 1,
    ...overrides,
  };
}

/**
 * Build a minimal Hono-like context object the handler can consume.
 * Only the parts actually read by listAuditLogs are implemented.
 */
function makeCtx(opts?: {
  query?: Record<string, string | number | undefined>;
  userId?: string;
}) {
  const query = opts?.query ?? {};
  const userId = opts?.userId ?? 'user-1';

  const jsonResponses: Array<{ data: unknown; status: number }> = [];

  const ctx = {
    get: (key: string): unknown => {
      if (key === 'user') return { id: userId, role: 'admin' };
      if (key === 'database') return {}; // DB is passed to the mocked constructor
      if (key === 'logger') {
        return {
          info: mock(() => {}),
          warn: mock(() => {}),
          error: mock(() => {}),
          debug: mock(() => {}),
        };
      }
      return undefined;
    },
    req: {
      valid: (_source: string) => query,
      header: (_name: string) => null,
    },
    json: (data: unknown, status: number) => {
      jsonResponses.push({ data, status });
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    },
    _responses: jsonResponses,
  };

  return ctx as typeof ctx;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listAuditLogs', () => {
  beforeEach(() => {
    // Reset mock call history between tests
    mockFindMany.mockReset();
    mockCount.mockReset();
    mockLogEvent.mockReset();

    // Restore safe defaults after reset
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);
    mockLogEvent.mockImplementation(async () => {});
  });

  // -------------------------------------------------------------------------
  // Handler contract
  // -------------------------------------------------------------------------

  test('is a function', () => {
    expect(typeof listAuditLogs).toBe('function');
  });

  test('returns a Response object', async () => {
    const ctx = makeCtx();
    const result = await listAuditLogs(ctx as any);
    expect(result).toBeInstanceOf(Response);
  });

  // -------------------------------------------------------------------------
  // Happy path — paginated results
  // -------------------------------------------------------------------------

  test('returns 200 with data array and pagination on success', async () => {
    const entry = makeLogEntry();
    mockFindMany.mockImplementation(async () => [entry]);
    mockCount.mockImplementation(async () => 1);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; pagination: Record<string, unknown> };

    // data array present with one entry
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);

    // pagination metadata present
    expect(typeof body.pagination).toBe('object');
    expect(body.pagination).not.toBeNull();
  });

  test('serialises createdAt and updatedAt as ISO strings', async () => {
    const ts = new Date('2025-06-15T12:00:00.000Z');
    mockFindMany.mockImplementation(async () => [makeLogEntry({ createdAt: ts, updatedAt: ts })]);
    mockCount.mockImplementation(async () => 1);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);
    const body = await res.json() as { data: Record<string, unknown>[] };

    expect(body.data[0]!['createdAt']).toBe(ts.toISOString());
    expect(body.data[0]!['updatedAt']).toBe(ts.toISOString());
  });

  test('maps archivedAt to ISO string when present', async () => {
    const archived = new Date('2025-07-01T00:00:00.000Z');
    mockFindMany.mockImplementation(async () => [makeLogEntry({ archivedAt: archived })]);
    mockCount.mockImplementation(async () => 1);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);
    const body = await res.json() as { data: Record<string, unknown>[] };

    expect(body.data[0]!['archivedAt']).toBe(archived.toISOString());
  });

  test('maps archivedAt to null when absent', async () => {
    mockFindMany.mockImplementation(async () => [makeLogEntry({ archivedAt: null })]);
    mockCount.mockImplementation(async () => 1);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);
    const body = await res.json() as { data: Record<string, unknown>[] };

    expect(body.data[0]!['archivedAt']).toBeNull();
  });

  test('maps purgeAfter to ISO string when present', async () => {
    const purge = new Date('2028-01-01T00:00:00.000Z');
    mockFindMany.mockImplementation(async () => [makeLogEntry({ purgeAfter: purge })]);
    mockCount.mockImplementation(async () => 1);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);
    const body = await res.json() as { data: Record<string, unknown>[] };

    expect(body.data[0]!['purgeAfter']).toBe(purge.toISOString());
  });

  test('calls repo.logEvent to self-log the access', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({ userId: 'admin-42' });
    await listAuditLogs(ctx as any);

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    const [eventArg, userIdArg] = mockLogEvent.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(userIdArg).toBe('admin-42');
    expect(eventArg['eventType']).toBe('data-access');
    expect(eventArg['resourceType']).toBe('audit_log');
  });

  test('calls repo.findMany and repo.count once per request', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx();
    await listAuditLogs(ctx as any);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Default pagination
  // -------------------------------------------------------------------------

  test('applies default limit=25 when no pagination params provided', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({ query: {} });
    const res = await listAuditLogs(ctx as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { pagination: { limit: number; offset: number } };
    expect(body.pagination.limit).toBe(25);
    expect(body.pagination.offset).toBe(0);
  });

  test('forwards custom limit and offset from query params', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 50);

    const ctx = makeCtx({ query: { limit: 10, offset: 20 } });
    const res = await listAuditLogs(ctx as any);

    const body = await res.json() as { pagination: { limit: number; offset: number } };
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.offset).toBe(20);
  });

  test('clamps limit to maxLimit=100 when oversized value provided', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({ query: { limit: 9999 } });
    const res = await listAuditLogs(ctx as any);

    const body = await res.json() as { pagination: { limit: number } };
    expect(body.pagination.limit).toBeLessThanOrEqual(100);
  });

  test('returns 200 with empty data array when no logs exist', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx();
    const res = await listAuditLogs(ctx as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; pagination: { totalCount: number } };
    expect(body.data).toHaveLength(0);
    expect(body.pagination.totalCount).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Date range validation
  // -------------------------------------------------------------------------

  test('throws ValidationError when startDate is after endDate', async () => {
    const ctx = makeCtx({
      query: {
        startDate: '2025-12-01',
        endDate: '2025-01-01',
      },
    });

    await expect(listAuditLogs(ctx as any)).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ValidationError with descriptive message for inverted date range', async () => {
    const ctx = makeCtx({
      query: {
        startDate: '2025-12-01',
        endDate: '2025-01-01',
      },
    });

    let caught: Error | undefined;
    try {
      await listAuditLogs(ctx as any);
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/startDate cannot be after endDate/i);
  });

  test('does NOT throw when startDate equals endDate', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: {
        startDate: '2025-06-15',
        endDate: '2025-06-15',
      },
    });

    await expect(listAuditLogs(ctx as any)).resolves.toBeInstanceOf(Response);
  });

  test('does NOT throw when startDate is before endDate', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      },
    });

    await expect(listAuditLogs(ctx as any)).resolves.toBeInstanceOf(Response);
  });

  test('does NOT throw when only startDate is provided (no endDate to compare)', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: { startDate: '2025-06-01' },
    });

    await expect(listAuditLogs(ctx as any)).resolves.toBeInstanceOf(Response);
  });

  test('does NOT throw when only endDate is provided (no startDate to compare)', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: { endDate: '2025-12-31' },
    });

    await expect(listAuditLogs(ctx as any)).resolves.toBeInstanceOf(Response);
  });

  // -------------------------------------------------------------------------
  // Filter passthrough
  // -------------------------------------------------------------------------

  test('passes recognised filter fields through to repo.findMany', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: {
        eventType: 'authentication',
        action: 'login',
        outcome: 'success',
      },
    });

    await listAuditLogs(ctx as any);

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const [filtersArg] = mockFindMany.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(filtersArg['eventType']).toBe('authentication');
    expect(filtersArg['action']).toBe('login');
    expect(filtersArg['outcome']).toBe('success');
  });

  test('does not pass unrecognised query params as filters', async () => {
    mockFindMany.mockImplementation(async () => []);
    mockCount.mockImplementation(async () => 0);

    const ctx = makeCtx({
      query: { __proto__: 'x', evil: 'injection' } as any,
    });

    await listAuditLogs(ctx as any);

    const [filtersArg] = mockFindMany.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(filtersArg['evil']).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Pagination metadata shape
  // -------------------------------------------------------------------------

  test('pagination metadata includes expected fields', async () => {
    mockFindMany.mockImplementation(async () => [makeLogEntry(), makeLogEntry({ id: 'log-2' })]);
    mockCount.mockImplementation(async () => 10);

    const ctx = makeCtx({ query: { limit: 2, offset: 0 } });
    const res = await listAuditLogs(ctx as any);
    const body = await res.json() as {
      pagination: {
        limit: number;
        offset: number;
        totalCount: number;
        count: number;
        hasMore: boolean;
      };
    };

    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.offset).toBe(0);
    expect(body.pagination.totalCount).toBe(10);
    expect(body.pagination.count).toBe(2);
    expect(body.pagination.hasMore).toBe(true);
  });
});
