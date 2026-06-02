import { z } from 'zod';
import { TREATMENT_PLAN_STATUSES, TREATMENT_PLAN_APPROVAL_METHODS } from '../repos/treatment-plan.schema';

export const TreatmentPlanParams = z.object({
  patientId: z.string().uuid(),
});

export const TreatmentPlanPlanParams = z.object({
  patientId: z.string().uuid(),
  planId: z.string().uuid(),
});

export const CreateTreatmentPlanBody = z.object({
  providerId: z.string().uuid(),
  totalEstimateCents: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  // P2-10: optional CDT code-set year stamp (defaults to DEFAULT_CDT_CODE_SET_YEAR).
  cdtCodeSetYear: z.number().int().min(2000).max(2100).optional(),
});

export const UpdateTreatmentPlanBody = z.object({
  status: z.enum(TREATMENT_PLAN_STATUSES).optional(),
  totalEstimateCents: z.number().int().min(0).optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

// CR-05: treatment-plan approval record
export const ApproveTreatmentPlanBody = z.object({
  approvedByPersonId: z.string().uuid(),
  method: z.enum(TREATMENT_PLAN_APPROVAL_METHODS),
  consentFormId: z.string().uuid().optional(),
  planVersionId: z.string().uuid().optional(),
  signatureData: z.string().optional(),
});
