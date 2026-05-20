/**
 * getImportedPMD — FR12.2: Read / parse an imported PMD
 *
 * GET /dental/pmd/imported/:id
 *
 * Returns the imported PMD with parsed content (JSON or raw text).
 * If content is valid JSON, returns a parsed structured view.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { ImportedPMDRepository } from './repos/imported-pmd.repo';
import { PatientRepository } from '@/handlers/patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function getImportedPMD(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const id = ctx.req.param('id')!;
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ImportedPMDRepository(db);

  const record = await repo.findOneById(id);
  if (!record) throw new NotFoundError('Imported PMD not found');

  // Branch-level authorization via patient's preferred branch
  const patientRepo = new PatientRepository(db);
  const patient = await patientRepo.findOneById(record.patientId);
  if (!patient) throw new NotFoundError('Patient');
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchAccess(db, user.id, patient.preferredBranchId);

  // FR12.2: Parse content — try JSON first, fall back to raw text
  let parsedContent: unknown;
  let contentType: 'json' | 'text' = 'text';
  try {
    parsedContent = JSON.parse(record.content);
    contentType = 'json';
  } catch {
    parsedContent = record.content;
  }

  const audit = ctx.get('audit') as any;
  if (audit?.logEvent) {
    await audit.logEvent({ eventType: 'data-access', category: 'clinical', action: 'read', outcome: 'success', user: user.id, userType: 'client', resourceType: 'imported-pmd', resource: id, description: 'Imported PMD retrieved', details: { resultCount: 1 }, ipAddress: ctx.req.header('x-forwarded-for'), userAgent: ctx.req.header('user-agent'), request: ctx.req.header('x-request-id') }, user.id);
  }

  return ctx.json({
    id: record.id,
    patientId: record.patientId,
    sourceFacility: record.sourceFacility,
    sourceReference: record.sourceReference,
    importedAt: record.importedAt,
    safetyFloorMerged: record.safetyFloorMerged === 'true',
    contentType,
    content: parsedContent,
  }, 200);
}
