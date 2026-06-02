/**
 * exportPatientCareRecord — P2-18: whole-patient continuity-of-care export
 *
 * GET /dental/pmd/patient/{patientId}/care-record
 *
 * Aggregates the patient's full longitudinal record (all per-visit PMD snapshots)
 * into a single portable FHIR R4 document Bundle for transfer / care continuity
 * (records-release, HIPAA right-of-access). This complements `exportPMD`, which
 * exports only a single visit's snapshot.
 *
 * Format: FHIR R4 `Bundle` (`type: "document"`) — Composition (CCD header) +
 * Patient + per-visit Encounter / Condition / Procedure / MedicationRequest.
 * Returned as a downloadable `application/fhir+json` attachment.
 *
 * Authorization mirrors the per-visit PMD handlers: authorized branch staff, OR
 * the patient themselves (self-download — HIPAA right-of-access). The export is
 * itself audit-logged (`pmd.export`), preserving this module's strong PHI
 * data-movement logging.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { ExportPatientCareRecordParams } from '@/generated/openapi/validators';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { buildCareRecordBundle, type CareRecordPMDInput, type PMDSnapshotContent } from './care-record/fhir-bundle';
import {
  getPatientForPMD,
  getPatientDemographicsForPMD,
} from '@/handlers/patient/repos/patient-pmd.facade';
import { getVisitEncounterMetaForPMD } from '@/handlers/dental-visit/repos/visit-pmd.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';

function safeParseContent(content: string): PMDSnapshotContent {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as PMDSnapshotContent) : {};
  } catch {
    return {};
  }
}

export async function exportPatientCareRecord(
  ctx: ValidatedContext<never, never, ExportPatientCareRecordParams>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const patient = await getPatientForPMD(db, patientId);
  if (!patient) throw new NotFoundError('Patient');

  // EF-PMD-007 parity: a patient may export their own record (HIPAA right-of-access).
  // Otherwise require branch-level access via the patient's preferred branch.
  const isPatientSelf = patient.person === user.id;
  if (!isPatientSelf) {
    if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  const demographics = await getPatientDemographicsForPMD(db, patientId);
  if (!demographics) throw new NotFoundError('Patient');

  // Aggregate the patient's full PMD history, excluding superseded snapshots so
  // the care record reflects the current sealed state per visit.
  const repo = new PMDDocumentRepository(db);
  const allPmds = await repo.findMany({ patientId });
  const activePmds = allPmds.filter((p) => p.status !== 'superseded');

  const visitMeta = await getVisitEncounterMetaForPMD(
    db,
    [...new Set(activePmds.map((p) => p.visitId))],
  );

  const pmdInputs: CareRecordPMDInput[] = activePmds.map((p) => {
    const meta = visitMeta.get(p.visitId);
    return {
      pmdId: p.id,
      visitId: p.visitId,
      checksum: p.checksum,
      generatedAt: p.createdAt,
      visitDate: meta?.activatedAt ?? meta?.completedAt ?? p.createdAt,
      content: safeParseContent(p.content),
    };
  });

  const generatedAt = new Date().toISOString();
  const bundle = buildCareRecordBundle({
    patient: {
      patientId: demographics.patientId,
      firstName: demographics.firstName,
      lastName: demographics.lastName,
      dateOfBirth: demographics.dateOfBirth,
      gender: demographics.gender,
    },
    pmds: pmdInputs,
    generatedAt,
  });

  // PHI data-movement logging: record the whole-patient export. Resolve a tenant
  // via the patient's preferred branch when available.
  const logger = ctx.get('logger');
  const branchForAudit = patient.preferredBranchId
    ? await getBranchOrgId(db, patient.preferredBranchId)
    : null;
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? patient.preferredBranchId ?? patientId,
    branchId: patient.preferredBranchId ?? undefined,
    action: 'pmd.export',
    resourceType: 'patient',
    resourceId: patientId,
    metadata: { kind: 'continuity-of-care', format: 'fhir-r4-bundle', pmdCount: activePmds.length },
  });

  const ts = generatedAt.slice(0, 10);
  const filename = `care-record-${patientId.slice(0, 8)}-${ts}.json`;

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/fhir+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
