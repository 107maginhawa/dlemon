/**
 * Unit tests for the pure FHIR R4 continuity-of-care Bundle builder (P2-18).
 * No DB/IO — exercises the bundle shape directly.
 */

import { describe, test, expect } from 'bun:test';
import {
  buildCareRecordBundle,
  CDT_SYSTEM,
  ICD10_SYSTEM,
  RXNORM_SYSTEM,
  type BuildCareRecordBundleInput,
} from './fhir-bundle';

const PATIENT = {
  patientId: 'a0000000-0000-1000-8000-000000000001',
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1990-04-01',
  gender: 'female',
};

function baseInput(overrides: Partial<BuildCareRecordBundleInput> = {}): BuildCareRecordBundleInput {
  return {
    patient: PATIENT,
    generatedAt: '2026-06-02T10:00:00.000Z',
    pmds: [
      {
        pmdId: 'pmd-1',
        visitId: 'v-1',
        checksum: 'sha256-abc',
        generatedAt: '2026-03-15T12:00:00.000Z',
        visitDate: '2026-03-15T09:00:00.000Z',
        content: {
          treatments: [
            { id: 't-1', cdtCode: 'D2392', description: 'Resin filling', toothNumber: 36, surfaces: ['O'], conditionCode: 'K02.1', status: 'performed' },
          ],
          prescriptions: [
            { id: 'rx-1', rxNormCode: '1049221', drugName: 'Amoxicillin', dosage: '500mg', frequency: 'TID' },
          ],
        },
      },
    ],
    ...overrides,
  };
}

describe('buildCareRecordBundle (P2-18)', () => {
  test('produces a FHIR R4 document Bundle', () => {
    const bundle = buildCareRecordBundle(baseInput());
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
    expect(bundle.timestamp).toBe('2026-06-02T10:00:00.000Z');
  });

  test('first entry is a Composition, second is the Patient', () => {
    const bundle = buildCareRecordBundle(baseInput());
    const entries = bundle.entry as Array<{ resource: any }>;
    expect(entries[0]!.resource.resourceType).toBe('Composition');
    expect(entries[0]!.resource.status).toBe('final');
    expect(entries[1]!.resource.resourceType).toBe('Patient');
    expect(entries[1]!.resource.id).toBe(PATIENT.patientId);
    expect(entries[1]!.resource.name[0].family).toBe('Doe');
    expect(entries[1]!.resource.gender).toBe('female');
    expect(entries[1]!.resource.birthDate).toBe('1990-04-01');
  });

  test('maps treatments to Procedure (CDT) and conditions to Condition (ICD-10)', () => {
    const bundle = buildCareRecordBundle(baseInput());
    const resources = (bundle.entry as Array<{ resource: any }>).map((e) => e.resource);
    const proc = resources.find((r) => r.resourceType === 'Procedure');
    expect(proc).toBeDefined();
    expect(proc.status).toBe('completed');
    expect(proc.code.coding[0].system).toBe(CDT_SYSTEM);
    expect(proc.code.coding[0].code).toBe('D2392');
    expect(proc.bodySite[0].text).toContain('Tooth 36');

    const cond = resources.find((r) => r.resourceType === 'Condition');
    expect(cond).toBeDefined();
    expect(cond.code.coding[0].system).toBe(ICD10_SYSTEM);
    expect(cond.code.coding[0].code).toBe('K02.1');
  });

  test('maps prescriptions to MedicationRequest (RxNorm)', () => {
    const bundle = buildCareRecordBundle(baseInput());
    const med = (bundle.entry as Array<{ resource: any }>)
      .map((e) => e.resource)
      .find((r) => r.resourceType === 'MedicationRequest');
    expect(med).toBeDefined();
    expect(med.medicationCodeableConcept.coding[0].system).toBe(RXNORM_SYSTEM);
    expect(med.medicationCodeableConcept.coding[0].code).toBe('1049221');
    expect(med.dosageInstruction[0].text).toContain('500mg');
  });

  test('Composition records source PMD provenance (id + checksum)', () => {
    const bundle = buildCareRecordBundle(baseInput());
    const comp = (bundle.entry as Array<{ resource: any }>)[0]!.resource;
    const provExt = comp.extension[0].extension;
    expect(provExt).toHaveLength(1);
    const inner = provExt[0].extension as Array<{ url: string; valueString?: string }>;
    expect(inner.find((x) => x.url === 'pmdId')!.valueString).toBe('pmd-1');
    expect(inner.find((x) => x.url === 'checksum')!.valueString).toBe('sha256-abc');
  });

  test('aggregates multiple visits and sorts oldest→newest', () => {
    const input = baseInput({
      pmds: [
        { pmdId: 'pmd-late', visitId: 'v-late', checksum: 'c2', generatedAt: '2026-05-01T00:00:00Z', visitDate: '2026-05-01T00:00:00Z', content: { treatments: [{ id: 't-2', cdtCode: 'D0120', status: 'performed' }] } },
        { pmdId: 'pmd-early', visitId: 'v-early', checksum: 'c1', generatedAt: '2026-01-01T00:00:00Z', visitDate: '2026-01-01T00:00:00Z', content: { treatments: [{ id: 't-3', cdtCode: 'D1110', status: 'performed' }] } },
      ],
    });
    const bundle = buildCareRecordBundle(input);
    const encounters = (bundle.entry as Array<{ resource: any }>)
      .map((e) => e.resource)
      .filter((r) => r.resourceType === 'Encounter');
    expect(encounters).toHaveLength(2);
    expect(encounters[0].id).toBe('enc-v-early');
    expect(encounters[1].id).toBe('enc-v-late');
  });

  test('handles patient with no last name and unknown gender', () => {
    const bundle = buildCareRecordBundle(
      baseInput({ patient: { patientId: 'p2', firstName: 'Cher', lastName: null, dateOfBirth: null, gender: null } }),
    );
    const patientRes = (bundle.entry as Array<{ resource: any }>)[1]!.resource;
    expect(patientRes.name[0].family).toBeUndefined();
    expect(patientRes.name[0].given).toEqual(['Cher']);
    expect(patientRes.gender).toBe('unknown');
    expect(patientRes.birthDate).toBeUndefined();
  });

  test('empty PMD list still yields a valid document with Composition + Patient only', () => {
    const bundle = buildCareRecordBundle(baseInput({ pmds: [] }));
    const resources = (bundle.entry as Array<{ resource: any }>).map((e) => e.resource.resourceType);
    expect(resources).toEqual(['Composition', 'Patient']);
  });
});
