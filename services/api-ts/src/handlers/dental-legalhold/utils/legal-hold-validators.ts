/**
 * Zod validators for the legal-hold HTTP endpoints (V-DG-002 support).
 */

import { z } from 'zod';
import { VALID_LEGAL_HOLD_STATUSES } from '../repos/legal-hold.schema';

export const PlaceLegalHoldBody = z.object({
  tenantId: z.string().uuid(),
  subjectPersonId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  name: z.string().min(1, 'name is required'),
  reason: z.string().min(1, 'reason is required'),
  note: z.string().optional(),
});
export type PlaceLegalHoldBodyType = z.infer<typeof PlaceLegalHoldBody>;

export const LegalHoldIdParams = z.object({ id: z.string().uuid() });
export type LegalHoldIdParamsType = z.infer<typeof LegalHoldIdParams>;

export const ListLegalHoldQuery = z.object({
  status: z.enum(VALID_LEGAL_HOLD_STATUSES).optional(),
  subjectPersonId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});
export type ListLegalHoldQueryType = z.infer<typeof ListLegalHoldQuery>;
