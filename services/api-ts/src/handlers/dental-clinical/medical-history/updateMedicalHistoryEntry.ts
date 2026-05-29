/**
 * updateMedicalHistoryEntry handler
 *
 * PATCH /dental/clinical/medical-history/{entryId}
 *
 * AC-CLI-005 (clinical safety invariant): medical history entries are
 * append-only. Once a systemic-health / allergy / medication observation is
 * recorded it must never be overwritten — a new entry is created instead, and
 * corrections flow through the additive amendment path (WF-038). Permitting an
 * in-place PATCH would silently corrupt the clinical record, so every update
 * attempt is rejected with APPEND_ONLY_VIOLATION (422).
 */

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { UpdateMedicalHistoryEntryBody, UpdateMedicalHistoryEntryParams } from '@/generated/openapi/validators';

export async function updateMedicalHistoryEntry(
  ctx: ValidatedContext<UpdateMedicalHistoryEntryBody, never, UpdateMedicalHistoryEntryParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  throw new BusinessLogicError(
    'Medical history entries are append-only. Create a new entry instead.',
    'APPEND_ONLY_VIOLATION',
  );
}
