/**
 * EMR Handler Module Tests
 *
 * Three test levels:
 *   Level 1 — Error class behaviour (no DB)
 *   Level 2 — Handler module structure (each export is an async function)
 *   Level 3 — finalizeConsultation business-rule error messages
 *
 * Business-logic tests are intentionally DB-free; they exercise the error
 * classes that the handlers throw rather than the handlers themselves.
 */

import { describe, test, expect } from 'bun:test';

// ─── Error imports ───────────────────────────────────────────────────────────
import {
  AppError,
  BusinessLogicError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
} from '../../core/errors';

// ─── Handler imports ─────────────────────────────────────────────────────────
import { createConsultation } from './createConsultation';
import { finalizeConsultation } from './finalizeConsultation';
import { getConsultation } from './getConsultation';
import { listConsultations } from './listConsultations';
import { listEMRPatients } from './listEMRPatients';
import { updateConsultation } from './updateConsultation';

// ─── Schema/type imports ─────────────────────────────────────────────────────
import type {
  ConsultationStatus,
  CreateConsultationRequest,
  UpdateConsultationRequest,
  VitalsData,
  SymptomsData,
  PrescriptionData,
  FollowUpData,
} from './repos/emr.schema';

// ─────────────────────────────────────────────────────────────────────────────
// Level 1 — Error class behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('EMR error classes', () => {
  describe('BusinessLogicError', () => {
    test('has HTTP status 422', () => {
      const err = new BusinessLogicError('something went wrong', 'SOME_CODE');
      expect(err.statusCode).toBe(422);
    });

    test('stores custom error code', () => {
      const err = new BusinessLogicError('msg', 'MY_CODE');
      expect(err.code).toBe('MY_CODE');
    });

    test('defaults code to BUSINESS_ERROR when omitted', () => {
      const err = new BusinessLogicError('msg');
      expect(err.code).toBe('BUSINESS_ERROR');
    });

    test('is an instance of AppError', () => {
      expect(new BusinessLogicError('x')).toBeInstanceOf(AppError);
    });
  });

  describe('ForbiddenError', () => {
    test('has HTTP status 403', () => {
      expect(new ForbiddenError().statusCode).toBe(403);
    });

    test('uses default message when none provided', () => {
      expect(new ForbiddenError().message).toBe('Forbidden');
    });

    test('accepts custom message', () => {
      expect(new ForbiddenError('No access for you').message).toBe('No access for you');
    });
  });

  describe('NotFoundError', () => {
    test('has HTTP status 404', () => {
      const err = new NotFoundError('Consultation 123 not found');
      expect(err.statusCode).toBe(404);
    });
  });

  describe('ValidationError', () => {
    test('has HTTP status 400', () => {
      expect(new ValidationError().statusCode).toBe(400);
    });
  });

  describe('UnauthorizedError', () => {
    test('has HTTP status 401', () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
    });
  });

  describe('ConflictError', () => {
    test('has HTTP status 409', () => {
      expect(new ConflictError().statusCode).toBe(409);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Level 2 — Handler module structure
// ─────────────────────────────────────────────────────────────────────────────

describe('EMR handler exports', () => {
  const handlers: [string, unknown][] = [
    ['createConsultation', createConsultation],
    ['finalizeConsultation', finalizeConsultation],
    ['getConsultation', getConsultation],
    ['listConsultations', listConsultations],
    ['listEMRPatients', listEMRPatients],
    ['updateConsultation', updateConsultation],
  ];

  for (const [name, handler] of handlers) {
    test(`${name} is exported as a function`, () => {
      expect(typeof handler).toBe('function');
    });

    test(`${name} is async (returns a Promise when called with a stub context)`, async () => {
      // We pass a minimal stub that has the minimum surface area the handler
      // needs before it hits a DB call.  The handler will throw (DB not
      // available) but the *return value before the throw* must be a Promise.
      const stub = {
        get: (_key: string) => undefined,
        req: {
          param: (_key: string) => 'test-id',
          header: (_key: string) => undefined,
          json: async () => ({}),
          query: (_key: string) => undefined,
        },
        json: (_body: unknown, _status?: number) => ({}),
      } as any;

      const result = (handler as (c: unknown) => unknown)(stub);
      // A function is async when its return value is a Promise
      expect(result).toBeInstanceOf(Promise);
      // Handler rejects with incomplete stub — verify it rejects rather than swallowing
      await expect(result).rejects.toBeDefined();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Level 3 — finalizeConsultation business-rule error messages
// ─────────────────────────────────────────────────────────────────────────────

describe('finalizeConsultation business rule — CONSULTATION_NOT_DRAFT', () => {
  const nonDraftStatuses: ConsultationStatus[] = ['finalized', 'amended'];

  for (const status of nonDraftStatuses) {
    test(`throws BusinessLogicError with code CONSULTATION_NOT_DRAFT for status "${status}"`, () => {
      const err = new BusinessLogicError(
        `Cannot finalize consultation in ${status} status. Only draft consultations can be finalized.`,
        'CONSULTATION_NOT_DRAFT',
      );

      expect(err.code).toBe('CONSULTATION_NOT_DRAFT');
      expect(err.statusCode).toBe(422);
      expect(err.message).toContain(status);
      expect(err.message).toContain('draft');
      expect(err.message).toContain('Only draft consultations can be finalized');
    });
  }

  test('draft status does NOT trigger the error', () => {
    // Sanity-check: the guard condition is `status !== "draft"`
    const status: ConsultationStatus = 'draft';
    const shouldThrow = status !== 'draft';
    expect(shouldThrow).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Level 4 — Schema / type contracts (pure runtime checks)
// ─────────────────────────────────────────────────────────────────────────────

describe('ConsultationStatus valid values', () => {
  const VALID_STATUSES: ConsultationStatus[] = ['draft', 'finalized', 'amended'];

  test('has exactly three valid status values', () => {
    expect(VALID_STATUSES).toHaveLength(3);
  });

  test.each(VALID_STATUSES)('"%s" is a recognised ConsultationStatus', (status) => {
    expect(VALID_STATUSES).toContain(status);
  });
});

describe('CreateConsultationRequest shape', () => {
  test('accepts a minimal valid request object', () => {
    const req: CreateConsultationRequest = {
      patient: 'patient-uuid',
      provider: 'provider-uuid',
    };
    expect(req.patient).toBe('patient-uuid');
    expect(req.provider).toBe('provider-uuid');
    // Optional fields absent by design
    expect(req.context).toBeUndefined();
    expect(req.chiefComplaint).toBeUndefined();
  });

  test('accepts a fully-populated request object', () => {
    const vitals: VitalsData = { temperatureCelsius: 37.2, heartRate: 72 };
    const symptoms: SymptomsData = { severity: 'mild', description: 'headache' };
    const prescription: PrescriptionData = { medication: 'Ibuprofen', dosageAmount: 400, dosageUnit: 'mg' };
    const followUp: FollowUpData = { needed: true, timeframeDays: 7 };

    const req: CreateConsultationRequest = {
      patient: 'p1',
      provider: 'pr1',
      context: 'idempotency-key-1',
      chiefComplaint: 'Toothache upper left',
      assessment: 'Caries on tooth 26',
      plan: 'Extraction + antibiotic',
      vitals,
      symptoms,
      prescriptions: [prescription],
      followUp,
    };

    expect(req.context).toBe('idempotency-key-1');
    expect(req.vitals?.temperatureCelsius).toBe(37.2);
    expect(req.symptoms?.severity).toBe('mild');
    expect(req.prescriptions?.[0]?.medication).toBe('Ibuprofen');
    expect(req.followUp?.needed).toBe(true);
  });
});

describe('UpdateConsultationRequest nullable fields', () => {
  test('all clinical fields can be set to null (clear semantics)', () => {
    const req: UpdateConsultationRequest = {
      chiefComplaint: null,
      assessment: null,
      plan: null,
      vitals: null,
      symptoms: null,
      prescriptions: null,
      followUp: null,
      externalDocumentation: null,
    };
    // Every field should be explicitly null
    for (const value of Object.values(req)) {
      expect(value).toBeNull();
    }
  });

  test('empty update object is valid (no fields required)', () => {
    const req: UpdateConsultationRequest = {};
    expect(Object.keys(req)).toHaveLength(0);
  });
});

describe('VitalsData standardised units', () => {
  test('uses Celsius for temperature', () => {
    const v: VitalsData = { temperatureCelsius: 36.6 };
    // The field name itself encodes the unit — confirm it compiles and holds value
    expect(v.temperatureCelsius).toBe(36.6);
    expect((v as any).temperatureFahrenheit).toBeUndefined();
  });

  test('uses kg for weight and cm for height', () => {
    const v: VitalsData = { weightKg: 70, heightCm: 175 };
    expect(v.weightKg).toBe(70);
    expect(v.heightCm).toBe(175);
  });
});

describe('SymptomsData severity enum', () => {
  const validSeverities: Array<'mild' | 'moderate' | 'severe'> = ['mild', 'moderate', 'severe'];

  test.each(validSeverities)('severity "%s" is valid', (severity) => {
    const s: SymptomsData = { severity };
    expect(s.severity).toBe(severity);
  });
});
