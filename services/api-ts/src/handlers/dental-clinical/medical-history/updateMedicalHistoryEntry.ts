/**
 * updateMedicalHistoryEntry handler
 *
 * PATCH /dental/clinical/medical-history/{entryId}
 *
 * AC-CLI-005 (clinical safety invariant): medical history entries are
 * append-only. Once a systemic-health / allergy / medication observation is
 * recorded it must never be overwritten — a new entry is created instead, and
 * corrections flow through the additive amendment path (WF-038). Permitting an
 * in-place PATCH would silently corrupt the clinical record, so the resource is
 * immutable: every update attempt is rejected with 405 MEDICAL_HISTORY_IMMUTABLE
 * (V-CLN-009 — the route exists but the method is not allowed on this resource).
 */

import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, AppError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { UpdateMedicalHistoryEntryBody, UpdateMedicalHistoryEntryParams } from '@/generated/openapi/validators';

export async function updateMedicalHistoryEntry(
  ctx: ValidatedContext<UpdateMedicalHistoryEntryBody, never, UpdateMedicalHistoryEntryParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  // V-CLN-009: medical history entries are immutable — PATCH is not an allowed
  // method on this resource. Corrections flow through the additive amendment path.
  throw new AppError(
    'Medical history entries are immutable. Create a new entry or file an amendment instead.',
    'MEDICAL_HISTORY_IMMUTABLE',
    405,
  );
}
