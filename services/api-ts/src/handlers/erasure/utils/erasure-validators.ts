/**
 * Zod validators for the erasure HTTP endpoints (V-DG-002). Hand-written to
 * match the manual dental-route registration style in app.ts (the dental
 * modules are manually wired, not codegen-routed).
 */

import { z } from 'zod';
import { VALID_ERASURE_STATUSES } from '../repos/erasure-request.schema';

export const RequestErasureBody = z.object({
  subjectPersonId: z.string().uuid(),
  subjectPatientId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  reason: z.string().min(1, 'reason is required'),
});
export type RequestErasureBodyType = z.infer<typeof RequestErasureBody>;

export const ApproveErasureBody = z
  .object({
    // Reviewer asserts whether the subject is under an active legal hold.
    // (No LegalHold store exists yet — caller-supplied predicate.)
    legalHold: z.boolean().optional(),
  })
  .strict()
  .default({});
export type ApproveErasureBodyType = z.infer<typeof ApproveErasureBody>;

export const RejectErasureBody = z.object({
  rejectionReason: z.string().min(1, 'rejectionReason is required'),
});
export type RejectErasureBodyType = z.infer<typeof RejectErasureBody>;

export const ErasureIdParams = z.object({
  id: z.string().uuid(),
});
export type ErasureIdParamsType = z.infer<typeof ErasureIdParams>;

export const ListErasureQuery = z.object({
  status: z.enum(VALID_ERASURE_STATUSES).optional(),
  subjectPersonId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});
export type ListErasureQueryType = z.infer<typeof ListErasureQuery>;
