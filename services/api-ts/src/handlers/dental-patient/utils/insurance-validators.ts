import { z } from 'zod';
import { CLAIM_DRAFT_STATUSES } from '../repos/claim-draft.schema';

export const InsuranceProfileParams = z.object({
  patientId: z.string().uuid(),
});

export const InsuranceProfileIdParams = z.object({
  patientId: z.string().uuid(),
  profileId: z.string().uuid(),
});

export const ClaimDraftParams = z.object({
  patientId: z.string().uuid(),
});

export const ClaimDraftIdParams = z.object({
  patientId: z.string().uuid(),
  claimId: z.string().uuid(),
});

export const ClaimReadinessParams = z.object({
  patientId: z.string().uuid(),
  claimId: z.string().uuid(),
});

export const CreateInsuranceProfileBody = z.object({
  insurerName: z.string().min(1, 'insurerName required'),
  policyNumber: z.string().min(1, 'policyNumber required'),
  groupNumber: z.string().optional(),
  subscriberName: z.string().min(1, 'subscriberName required'),
  subscriberDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'subscriberDob must be YYYY-MM-DD').optional(),
  relationship: z.enum(['self', 'spouse', 'child', 'other']).optional(),
  notes: z.string().optional(),
});

export const UpdateInsuranceProfileBody = z.object({
  insurerName: z.string().min(1).optional(),
  policyNumber: z.string().min(1).optional(),
  groupNumber: z.string().optional(),
  subscriberName: z.string().min(1).optional(),
  subscriberDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relationship: z.enum(['self', 'spouse', 'child', 'other']).optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const CreateClaimDraftBody = z.object({
  insuranceProfileId: z.string().uuid(),
  visitId: z.string().uuid().optional(),
  cdtCode: z.string().min(1, 'cdtCode required'),
  icd10Code: z.string().optional(),
  diagnosisDescription: z.string().optional(),
  feeAmountCents: z.number().int().min(0),
  notes: z.string().optional(),
});

export const UpdateClaimDraftStatusBody = z.object({
  status: z.enum(CLAIM_DRAFT_STATUSES),
});
