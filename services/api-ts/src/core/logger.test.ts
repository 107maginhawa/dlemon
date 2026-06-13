import { describe, test, expect } from 'bun:test';
import type { Config } from '@/core/config';
import { createLogger } from './logger';

function makeConfig(): Config {
  return {
    logging: { level: 'debug', pretty: false },
    cors: { origins: [], credentials: false, allowLocalNetwork: false, allowTunneling: false, strict: true },
    auth: {} as any,
    server: {} as any,
    database: {} as any,
    rateLimit: { enabled: false, max: 100 },
    storage: {} as any,
    email: {} as any,
    notifs: {} as any,
    billing: {} as any,
    webrtc: { iceServers: [] },
    features: { dentalImagingAutoLandmark: false },
  } as Config;
}

function makeCapture() {
  const lines: string[] = [];
  const dest = { write: (msg: string) => { lines.push(msg.trim()); } };
  return { dest: dest as any, lines };
}

describe('createLogger — PHI redaction (HIPAA)', () => {
  test('redacts top-level PHI fields, preserves non-PHI', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ email: 'patient@clinic.com', password: 'secret', visitId: 'abc-123' }, 'test');
    expect(lines.length).toBeGreaterThan(0);
    const rec = JSON.parse(lines[0]!);
    expect(rec.email).toBe('[REDACTED]');
    expect(rec.password).toBe('[REDACTED]');
    expect(rec.visitId).toBe('abc-123');
  });

  test('redacts nested PHI fields one level deep', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ patient: { email: 'x@y.com', firstName: 'Jane', id: 'p-1' } }, 'patient');
    const rec = JSON.parse(lines[0]!);
    expect(rec.patient.email).toBe('[REDACTED]');
    expect(rec.patient.firstName).toBe('[REDACTED]');
    expect(rec.patient.id).toBe('p-1');
  });

  test('redacts clinical PHI (soap, refusalReason, dismissReason)', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ soap: 'Patient presents with pain', refusalReason: 'Cannot afford', status: 'declined' }, 'clinical');
    const rec = JSON.parse(lines[0]!);
    expect(rec.soap).toBe('[REDACTED]');
    expect(rec.refusalReason).toBe('[REDACTED]');
    expect(rec.status).toBe('declined');
  });

  test('redacts identity PHI (ssn, dob, phone)', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ ssn: '123-45-6789', dob: '1990-01-01', phone: '+1555000000' }, 'identity');
    const rec = JSON.parse(lines[0]!);
    expect(rec.ssn).toBe('[REDACTED]');
    expect(rec.dob).toBe('[REDACTED]');
    expect(rec.phone).toBe('[REDACTED]');
  });

  test('strips query string from req.url — no query-param PII in logs', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ req: { method: 'GET', url: '/dental/patients?ssn=123456789&page=1', headers: {} } }, 'request');
    const rec = JSON.parse(lines[0]!);
    expect(rec.req.url).toBe('/dental/patients');
    expect(rec.req.url).not.toContain('ssn=');
    expect(rec.req.url).not.toContain('?');
  });

  test('sensitive auth headers remain redacted by header serializer', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({
      req: { method: 'POST', url: '/auth/login', headers: { authorization: 'Bearer tok123', 'content-type': 'application/json' } }
    }, 'auth');
    const rec = JSON.parse(lines[0]!);
    expect(rec.req.headers.authorization).toBe('[REDACTED]');
    expect(rec.req.headers['content-type']).toBe('application/json');
  });

  test('non-PHI fields are never redacted', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ treatmentId: 'tx-1', status: 'performed', toothNumber: 14, branchId: 'b-1' }, 'treatment');
    const rec = JSON.parse(lines[0]!);
    expect(rec.treatmentId).toBe('tx-1');
    expect(rec.status).toBe('performed');
    expect(rec.toothNumber).toBe(14);
  });

  // Load-bearing for #14 contactInfo (PII JSONB: { email, phone }). The patient
  // profile + update paths can carry contactInfo nested two-plus levels below the
  // log root (e.g. { action, patient: { contactInfo: { email, phone } } }). Pino's
  // path-glob redaction only descends one level (`*.email`), so a recursive
  // walking redactor is required before contactInfo gains a read/write surface.
  test('redacts PHI nested arbitrarily deep (contactInfo JSONB blob)', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info(
      { action: 'updateDentalPatient', patient: { contactInfo: { email: 'pii@clinic.com', phone: '+639170000000' } } },
      'contact-edit',
    );
    const rec = JSON.parse(lines[0]!);
    expect(rec.patient.contactInfo.email).toBe('[REDACTED]');
    expect(rec.patient.contactInfo.phone).toBe('[REDACTED]');
    expect(rec.action).toBe('updateDentalPatient');
  });

  test('redacts PHI three levels deep, preserving non-PHI siblings', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info(
      { audit: { subject: { person: { firstName: 'Jane', ssn: '123-45-6789', id: 'p-1' } } } },
      'deep',
    );
    const rec = JSON.parse(lines[0]!);
    expect(rec.audit.subject.person.firstName).toBe('[REDACTED]');
    expect(rec.audit.subject.person.ssn).toBe('[REDACTED]');
    expect(rec.audit.subject.person.id).toBe('p-1');
  });

  test('redacts PHI inside arrays of objects (emergency contacts list)', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info(
      { contacts: [{ name: 'A', phone: '+15550000001' }, { name: 'B', email: 'b@y.com' }] },
      'contacts',
    );
    const rec = JSON.parse(lines[0]!);
    expect(rec.contacts[0].phone).toBe('[REDACTED]');
    expect(rec.contacts[1].email).toBe('[REDACTED]');
  });

  // The recursive walker must NOT descend into non-plain objects: a Date has no
  // own enumerable keys, so walking it would clobber it to `{}` and destroy the
  // audit value of logged createdAt/updatedAt timestamps.
  test('preserves Date values (serialized, not clobbered to {})', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    logger.info({ createdAt: new Date('2024-01-01T00:00:00Z'), tag: 'audit' }, 'date');
    const rec = JSON.parse(lines[0]!);
    expect(typeof rec.createdAt).toBe('string');
    expect(rec.createdAt).toContain('2024-01-01');
  });

  // A shared (non-cyclic) reference appearing in two fields is a DAG, not a
  // cycle — both occurrences must be redacted independently, never collapsed to
  // '[Circular]' (which only protects against true ancestor cycles).
  test('redacts a shared reference in every field (no false [Circular])', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    const shared = { email: 's@y.com', id: 'p-1' };
    logger.info({ a: shared, b: shared }, 'shared');
    const rec = JSON.parse(lines[0]!);
    expect(rec.a.email).toBe('[REDACTED]');
    expect(rec.a.id).toBe('p-1');
    expect(rec.b.email).toBe('[REDACTED]');
    expect(rec.b.id).toBe('p-1');
  });

  // A genuine cycle must terminate (no stack overflow) while still redacting the
  // PHI it carries.
  test('terminates on a true cycle and still redacts PHI', () => {
    const { dest, lines } = makeCapture();
    const logger = createLogger(makeConfig(), dest);
    const cyc: Record<string, unknown> = { email: 'c@y.com' };
    cyc['self'] = cyc;
    logger.info({ cyc }, 'cycle');
    const rec = JSON.parse(lines[0]!);
    expect(rec.cyc.email).toBe('[REDACTED]');
    expect(rec.cyc.self).toBe('[Circular]');
  });
});
