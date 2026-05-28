/**
 * getTreatmentPlanVersion — GET /dental/patients/:patientId/treatment-plan/versions/:versionId
 *
 * Returns a specific immutable treatment plan snapshot by its UUID.
 * The patientId path segment is verified to match the stored row for
 * authorization (prevents cross-patient version access).
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { treatmentPlanVersions } from '../repos/treatment-plan-version.schema';
import { eq, and } from 'drizzle-orm';

export async function getTreatmentPlanVersion(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId');
  const versionId = ctx.req.param('versionId');
  if (!patientId) throw new ValidationError('patientId is required');
  if (!versionId) throw new ValidationError('versionId is required');
  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new ValidationError('branchId query parameter is required');

  const db = ctx.get('database') as DatabaseInstance;
  await assertBranchAccess(db, user.id, branchId);

  const [row] = await db
    .select()
    .from(treatmentPlanVersions)
    .where(
      and(
        eq(treatmentPlanVersions.id, versionId),
        eq(treatmentPlanVersions.patientId, patientId),
      ),
    );

  if (!row) throw new NotFoundError('Treatment plan version not found');

  return ctx.json(
    { id: row.id, createdAt: row.createdAt, createdBy: row.createdBy, version: row.version, patientId: row.patientId, snapshot: row.snapshot },
    200,
  );
}
