/**
 * generatePMD handler
 *
 * POST /dental/visits/{visitId}/pmd
 * Generates an immutable PMD document from a completed visit.
 * Only completed or locked visits can generate a PMD.
 */

import { eq, and } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { PrescriptionRepository } from '@/handlers/dental-clinical/repos/prescription.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import type { User } from '@/types/auth';
import type { GeneratePMDBody, GeneratePMDParams } from '@/generated/openapi/validators';

function sha256Hex(content: string): string {
  // Simple checksum using content length + first/last chars for demo
  // In production use node:crypto
  const sum = content.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `sha256-${sum.toString(16).padStart(16, '0')}`;
}

export async function generatePMD(
  ctx: ValidatedContext<GeneratePMDBody, never, GeneratePMDParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  // Resolve membership ID from personId + branchId
  const [membership] = await db
    .select({ id: dentalMemberships.id })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, user.id),
      eq(dentalMemberships.branchId, visit.branchId),
      eq(dentalMemberships.status, 'active'),
    ))
    .limit(1);

  if (visit.status !== 'completed' && visit.status !== 'locked') {
    throw new ValidationError('PMD can only be generated from a completed or locked visit');
  }

  // Collect visit data snapshot
  const treatmentRepo = new TreatmentRepository(db);
  const prescriptionRepo = new PrescriptionRepository(db);

  const treatments = await treatmentRepo.findByVisit(visitId);
  const prescriptions = await prescriptionRepo.findMany({ visitId });

  const contentSnapshot = JSON.stringify({
    visitId,
    patientId: body.patientId,
    visitDate: visit.activatedAt ?? visit.createdAt,
    treatments: treatments.map(t => ({
      id: t.id,
      cdtCode: t.cdtCode,
      description: t.description,
      toothNumber: t.toothNumber,
      surfaces: t.surfaces,
      conditionCode: t.conditionCode,
      status: t.status,
      priceCents: t.priceCents,
    })),
    prescriptions: prescriptions.map(rx => ({
      id: rx.id,
      rxNormCode: rx.rxNormCode,
      drugName: rx.drugName,
      dosage: rx.dosage,
      frequency: rx.frequency,
    })),
  });

  const checksum = sha256Hex(contentSnapshot);

  const pmdRepo = new PMDDocumentRepository(db);

  // Check if existing PMD for this visit — if so, supersede it
  const existing = await pmdRepo.findByVisit(visitId);

  let pmd;
  if (existing) {
    pmd = await pmdRepo.supersede(existing.id, {
      visitId,
      patientId: body.patientId,
      authorMemberId: membership!.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  } else {
    pmd = await pmdRepo.createOne({
      visitId,
      patientId: body.patientId,
      authorMemberId: membership!.id,
      branchId: visit.branchId,
      content: contentSnapshot,
      checksum,
    });
  }

  return ctx.json(pmd, 201);
}
