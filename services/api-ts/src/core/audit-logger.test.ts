/**
 * audit-logger — PHI-in-logs guard (T-001)
 *
 * logAuditEvent writes sanitized rows to the DB audit tables, but it ALSO emits a
 * Pino line. That Pino line must NOT carry PHI: the raw event's metadata / before /
 * after snapshots routinely contain names, emails, DOB, and clinical free-text, and
 * they sit too deep for the logger's `*.field` redact paths to catch. This test
 * asserts the Pino output contains only safe identifiers.
 */
import { describe, test, expect } from 'bun:test';
import { logAuditEvent } from './audit-logger';

function captureLogger() {
  const calls: unknown[] = [];
  const push = (o: unknown) => calls.push(o);
  return {
    calls,
    logger: { info: push, warn: push, error: push, debug: push } as any,
    serialized: () => JSON.stringify(calls),
  };
}

// A db stub whose repo calls throw — exercises BOTH the happy Pino line and the
// error-path Pino lines (logAuditEvent swallows non-security failures).
const FAKE_DB = {} as any;

const PHI_EVENT = {
  personId: 'p-1', tenantId: 't-1', action: 'treatment.dismissed',
  resourceType: 'dental_treatment', resourceId: 'tx-1',
  metadata: { reason: 'Patient has uncontrolled HIV', visitId: 'v-1' },
  before: { firstName: 'Johnathan', lastName: 'Doexyz', email: 'jdoe@example.com', dateOfBirth: '1990-04-01' },
  after: { firstName: 'Johnathan', clinicalNotes: 'severe periodontitis quadrant 3' },
} as const;

describe('logAuditEvent — no PHI in Pino logs (T-001)', () => {
  test('does not emit PHI values from metadata/before/after to the logger', async () => {
    const { logger, serialized } = captureLogger();
    await logAuditEvent(FAKE_DB, logger, { ...PHI_EVENT });

    const out = serialized();
    // Direct identifiers / clinical free-text must never reach the log stream.
    expect(out).not.toContain('Johnathan');
    expect(out).not.toContain('Doexyz');
    expect(out).not.toContain('jdoe@example.com');
    expect(out).not.toContain('1990-04-01');
    expect(out).not.toContain('uncontrolled HIV');
    expect(out).not.toContain('periodontitis');
  });

  test('still emits safe audit identifiers (action/resourceType/ids)', async () => {
    const { logger, serialized } = captureLogger();
    await logAuditEvent(FAKE_DB, logger, { ...PHI_EVENT });

    const out = serialized();
    expect(out).toContain('treatment.dismissed');
    expect(out).toContain('dental_treatment');
    expect(out).toContain('tx-1');
  });
});
