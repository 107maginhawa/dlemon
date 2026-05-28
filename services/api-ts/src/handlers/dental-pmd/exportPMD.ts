/**
 * exportPMD — FR12.6: Share / export a PMD document as a downloadable file
 *
 * GET /dental/visits/:visitId/pmd/export
 *
 * Returns the PMD content as a downloadable JSON file.
 * The filename includes the visit ID and generation timestamp.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import type { User } from '@/types/auth';
import { PMDDocumentRepository } from './repos/pmd-document.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';

export async function exportPMD(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  const repo = new PMDDocumentRepository(db);

  const pmds = await repo.findMany({ visitId });
  if (pmds.length === 0) throw new NotFoundError('No PMD found for this visit');

  // Use the most recent non-superseded PMD
  const pmd = pmds
    .filter(p => p.status !== 'superseded')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    ?? pmds[0]!;

  const ts = new Date(pmd.createdAt).toISOString().slice(0, 10);
  const filename = `pmd-${visitId.slice(0, 8)}-${ts}.json`;

  // Compose export envelope
  const exportData = {
    pmdId: pmd.id,
    visitId: pmd.visitId,
    patientId: pmd.patientId,
    branchId: pmd.branchId,
    status: pmd.status,
    checksum: pmd.checksum,
    generatedAt: pmd.createdAt,
    signedAt: pmd.signedAt,
    content: JSON.parse(pmd.content),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
