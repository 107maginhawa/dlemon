import { z } from 'zod';
import { TREATMENT_PLAN_STATUSES } from '../repos/treatment-plan.schema';

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
});

export const UpdateTreatmentPlanBody = z.object({
  status: z.enum(TREATMENT_PLAN_STATUSES).optional(),
  totalEstimateCents: z.number().int().min(0).optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
