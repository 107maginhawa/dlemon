/**
 * fhir-bundle.ts — FHIR R4 continuity-of-care document Bundle builder (P2-18)
 *
 * Builds a whole-patient continuity-of-care record by aggregating the patient's
 * sealed per-visit PMD snapshots into a single portable FHIR R4 `Bundle`
 * (`type: "document"`). This is the recognized interchange structure for
 * records-release / care-transition to another provider (HIPAA right-of-access),
 * superseding the per-visit proprietary JSON envelope produced by `exportPMD`.
 *
 * Why a FHIR Bundle (and not CCDA): FHIR R4 is JSON-native — it composes cleanly
 * with the existing JSON PMD snapshots, needs no XML toolchain, and is the modern
 * de-facto interchange format. The Bundle is `type: "document"` with a leading
 * `Composition` (the CCD header), one `Patient`, and per-visit `Encounter` /
 * `Condition` / `Procedure` / `MedicationRequest` resources.
 *
 * Coding systems used:
 *  - CDT (procedures):  http://www.ada.org/cdt
 *  - ICD-10 (conditions): http://hl7.org/fhir/sid/icd-10
 *  - RxNorm (medications): http://www.nlm.nih.gov/research/umls/rxnorm
 *
 * This module is PURE (no DB/IO) so it is unit-testable in isolation.
 */

export const CDT_SYSTEM = 'http://www.ada.org/cdt';
export const ICD10_SYSTEM = 'http://hl7.org/fhir/sid/icd-10';
export const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';

/** Parsed shape of a per-visit PMD `content` snapshot (see generatePMD.ts). */
export interface PMDSnapshotContent {
  visitId?: string;
  patientId?: string;
  authorMemberId?: string;
  visitDate?: string | Date | null;
  treatments?: Array<{
    id?: string;
    cdtCode?: string | null;
    description?: string | null;
    toothNumber?: number | null;
    surfaces?: string[] | null;
    conditionCode?: string | null;
    status?: string | null;
  }>;
  prescriptions?: Array<{
    id?: string;
    rxNormCode?: string | null;
    drugName?: string | null;
    dosage?: string | null;
    frequency?: string | null;
  }>;
}

export interface CareRecordPMDInput {
  /** The PMD document row id (used for provenance + entry references). */
  pmdId: string;
  visitId: string;
  /** SHA-256 checksum sealed at generation time. */
  checksum: string;
  generatedAt: string | Date;
  /** Encounter date, if resolvable from the visit; falls back to generatedAt. */
  visitDate?: string | Date | null;
  /** Parsed snapshot content (already JSON.parsed). */
  content: PMDSnapshotContent;
}

export interface CareRecordPatientInput {
  patientId: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  /** Person gender enum value, mapped to a FHIR administrative-gender. */
  gender: string | null;
}

export interface BuildCareRecordBundleInput {
  patient: CareRecordPatientInput;
  pmds: CareRecordPMDInput[];
  /** Timestamp the document was assembled (ISO). */
  generatedAt: string;
}

/** Minimal typed view of the FHIR R4 document Bundle this builder emits. */
export interface FhirBundleEntry {
  fullUrl?: string;
  resource: Record<string, unknown>;
}
export interface FhirDocumentBundle {
  resourceType: 'Bundle';
  type: 'document';
  timestamp: string;
  entry: FhirBundleEntry[];
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Map the internal person gender enum to a FHIR R4 administrative-gender code. */
function toFhirGender(gender: string | null): 'male' | 'female' | 'other' | 'unknown' {
  switch ((gender ?? '').toLowerCase()) {
    case 'male':
      return 'male';
    case 'female':
      return 'female';
    case 'other':
      return 'other';
    default:
      return 'unknown';
  }
}

/**
 * Build a FHIR R4 document Bundle aggregating the patient's full PMD history.
 * Deterministic ordering: PMDs sorted oldest→newest by encounter/generation date.
 */
export function buildCareRecordBundle(input: BuildCareRecordBundleInput): FhirDocumentBundle {
  const { patient } = input;
  const patientRef = `Patient/${patient.patientId}`;

  const sortedPmds = [...input.pmds].sort((a, b) => {
    const da = new Date(a.visitDate ?? a.generatedAt).getTime();
    const dbt = new Date(b.visitDate ?? b.generatedAt).getTime();
    return da - dbt;
  });

  const patientName =
    patient.lastName != null && patient.lastName !== ''
      ? { family: patient.lastName, given: [patient.firstName] }
      : { given: [patient.firstName] };

  const patientResource = {
    resourceType: 'Patient',
    id: patient.patientId,
    name: [patientName],
    gender: toFhirGender(patient.gender),
    ...(patient.dateOfBirth ? { birthDate: patient.dateOfBirth } : {}),
  };

  // Build clinical resources per visit. Resource ids are derived from the source
  // id (treatment/prescription/visit) so the bundle is reproducible.
  const encounterRefs: Array<{ reference: string }> = [];
  const sectionEntries: Array<{ reference: string }> = [];
  const clinicalEntries: Array<{ resource: Record<string, unknown> }> = [];

  for (const pmd of sortedPmds) {
    const encounterId = `enc-${pmd.visitId}`;
    const encounterRef = `Encounter/${encounterId}`;
    const encounterDate = toIso(pmd.visitDate ?? pmd.generatedAt);

    clinicalEntries.push({
      resource: {
        resourceType: 'Encounter',
        id: encounterId,
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        subject: { reference: patientRef },
        ...(encounterDate ? { period: { start: encounterDate } } : {}),
      },
    });
    encounterRefs.push({ reference: encounterRef });
    sectionEntries.push({ reference: encounterRef });

    for (const t of pmd.content.treatments ?? []) {
      // A coded diagnosis on the treatment becomes a Condition resource.
      if (t.conditionCode) {
        const condId = `cond-${t.id ?? `${pmd.visitId}-${t.conditionCode}`}`;
        clinicalEntries.push({
          resource: {
            resourceType: 'Condition',
            id: condId,
            subject: { reference: patientRef },
            encounter: { reference: encounterRef },
            code: { coding: [{ system: ICD10_SYSTEM, code: t.conditionCode }] },
            ...(encounterDate ? { recordedDate: encounterDate } : {}),
          },
        });
        sectionEntries.push({ reference: `Condition/${condId}` });
      }

      const procId = `proc-${t.id ?? `${pmd.visitId}-${t.cdtCode ?? 'na'}`}`;
      const bodySite =
        t.toothNumber != null
          ? [{ text: `Tooth ${t.toothNumber}${t.surfaces?.length ? ` (${t.surfaces.join('')})` : ''}` }]
          : undefined;
      clinicalEntries.push({
        resource: {
          resourceType: 'Procedure',
          id: procId,
          status: t.status === 'performed' ? 'completed' : 'not-done',
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          code: {
            ...(t.cdtCode ? { coding: [{ system: CDT_SYSTEM, code: t.cdtCode, display: t.description ?? undefined }] } : {}),
            ...(t.description ? { text: t.description } : {}),
          },
          ...(bodySite ? { bodySite } : {}),
          ...(encounterDate ? { performedDateTime: encounterDate } : {}),
        },
      });
      sectionEntries.push({ reference: `Procedure/${procId}` });
    }

    for (const rx of pmd.content.prescriptions ?? []) {
      const medId = `med-${rx.id ?? `${pmd.visitId}-${rx.drugName ?? 'na'}`}`;
      const dosageText = [rx.dosage, rx.frequency].filter(Boolean).join(' — ');
      clinicalEntries.push({
        resource: {
          resourceType: 'MedicationRequest',
          id: medId,
          status: 'completed',
          intent: 'order',
          subject: { reference: patientRef },
          encounter: { reference: encounterRef },
          medicationCodeableConcept: {
            ...(rx.rxNormCode ? { coding: [{ system: RXNORM_SYSTEM, code: rx.rxNormCode, display: rx.drugName ?? undefined }] } : {}),
            ...(rx.drugName ? { text: rx.drugName } : {}),
          },
          ...(dosageText ? { dosageInstruction: [{ text: dosageText }] } : {}),
        },
      });
      sectionEntries.push({ reference: `MedicationRequest/${medId}` });
    }
  }

  const composition = {
    resourceType: 'Composition',
    id: `composition-${patient.patientId}`,
    status: 'final',
    type: {
      coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }],
      text: 'Continuity of Care Document',
    },
    subject: { reference: patientRef },
    date: input.generatedAt,
    title: 'Continuity of Care Record',
    // Provenance: list the sealed source PMD snapshots this document was built from.
    extension: [
      {
        url: 'https://dentalemon.app/fhir/StructureDefinition/source-pmd-documents',
        extension: sortedPmds.map((p) => ({
          url: 'pmd',
          extension: [
            { url: 'pmdId', valueString: p.pmdId },
            { url: 'visitId', valueString: p.visitId },
            { url: 'checksum', valueString: p.checksum },
            ...(toIso(p.generatedAt) ? [{ url: 'generatedAt', valueDateTime: toIso(p.generatedAt) }] : []),
          ],
        })),
      },
    ],
    section: [
      {
        title: 'Encounters',
        entry: encounterRefs,
      },
      {
        title: 'Clinical Record',
        entry: sectionEntries,
      },
    ],
  };

  const entries: FhirBundleEntry[] = [
    { resource: composition },
    { resource: patientResource },
    ...clinicalEntries,
  ];

  return {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: input.generatedAt,
    entry: entries,
  };
}
