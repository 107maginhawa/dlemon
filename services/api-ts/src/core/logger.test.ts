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
});
