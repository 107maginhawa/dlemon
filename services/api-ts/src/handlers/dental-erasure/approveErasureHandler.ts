/**
 * POST /dental/erasure-requests/{id}/approve — approve + run anonymization
 * (V-DG-002). Admin-only. A legal hold (reviewer-asserted) blocks erasure and
 * rejects the request. Approval is the explicit opt-in that performs the
 * (non-destructive) anonymization.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { StorageProvider } from '@/core/storage';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import { approveErasure } from './erasure-service';
import { physicalDeleteErasedFiles } from './erasure-storage';
import type { ErasureIdParamsType } from './utils/erasure-validators';

export async function approveErasureHandler(
  ctx: ValidatedContext<never, never, ErasureIdParamsType>,
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');
  if (user.role !== 'admin') throw new ForbiddenError('Only administrators can approve data erasure');

  const { id } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Body is optional ({ legalHold? }); tolerate an empty/absent JSON body.
  const body = (await ctx.req.json().catch(() => ({}))) as { legalHold?: boolean };

  const { request, fileIdsPendingS3Delete } = await approveErasure(db, logger, id, {
    reviewedBy: user.id,
    legalHold: body?.legalHold ?? false,
  });

  // V-DG-002: anonymization committed above. Physically delete the radiograph S3
  // objects + their storage rows (DATA_GOVERNANCE §3). Handler scope owns the
  // storage client. FAIL-OPEN — a storage error must not fail the erasure.
  if (request.status === 'anonymized' && fileIdsPendingS3Delete.length > 0) {
    const storage = ctx.get('storage') as StorageProvider | undefined;
    if (storage) {
      await physicalDeleteErasedFiles(
        db,
        storage,
        logger,
        {
          tenantId: request.tenantId,
          branchId: request.branchId,
          subjectPersonId: request.subjectPersonId,
          actorId: user.id,
        },
        fileIdsPendingS3Delete,
      );
    } else {
      logger?.warn(
        { erasureRequestId: request.id, pending: fileIdsPendingS3Delete.length },
        'erasure: no storage provider in context — S3 radiographs left pending physical delete',
      );
    }
  }

  return ctx.json(request, 200);
}
