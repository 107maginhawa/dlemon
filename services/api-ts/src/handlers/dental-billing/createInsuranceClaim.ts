/**
 * createInsuranceClaim — POST /dental/billing/claims
 *
 * P1-26: create an invoice-anchored, multi-line HMO claim (the submittable
 * unit). Mirrors createClaimDraft's guards (patient lookup, branch access,
 * archived-patient block) and validates the insurance profile belongs to the
 * patient. Lines may be supplied inline or derived from invoice line items.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import {
  getInsuranceProfileForBilling,
  getCoverageAuthorizationForBilling,
} from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { SUBMISSION_CHANNELS, type NewDentalInsuranceClaimLine, type SubmissionChannel } from './repos/dental-insurance-claim.schema';

interface ClaimLineInput {
  treatmentId?: string;
  invoiceLineItemId?: string;
  cdtCode: string;
  description: string;
  billedAmountCents: number;
}

export async function createInsuranceClaim(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const body = ctx.req.valid('json') as {
    patientId: string;
    insuranceProfileId: string;
    invoiceId?: string;
    visitId?: string;
    authorizationId?: string;
    submissionChannel?: string;
    lines?: ClaimLineInput[];
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, body.patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // EF-PAT-004: branch-level authorization (patient's preferred branch).
  await assertBranchAccess(db, user.id, patient.preferredBranchId!);

  // EF-PAT-001: block writes on archived patients
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  // Profile must belong to this patient.
  const profile = await getInsuranceProfileForBilling(db, body.insuranceProfileId, body.patientId);
  if (!profile) throw new BusinessLogicError('Insurance profile not found for this patient');

  // Optional authorization must belong to the same patient.
  if (body.authorizationId) {
    const auth = await getCoverageAuthorizationForBilling(db, body.authorizationId, body.patientId);
    if (!auth) throw new BusinessLogicError('Coverage authorization not found for this patient');
  }

  const invoiceRepo = new DentalInvoiceRepository(db);

  // Derive lines from the invoice when none are supplied inline. The invoice
  // read stays on db (entity resolution + ownership guard).
  let lineInputs: ClaimLineInput[] = body.lines ?? [];
  if (body.invoiceId) {
    const found = await invoiceRepo.findWithLineItems(body.invoiceId);
    if (!found) throw new NotFoundError('Invoice');
    if (found.invoice.patientId !== body.patientId) {
      throw new BusinessLogicError('Invoice does not belong to this patient', 'INVOICE_PATIENT_MISMATCH');
    }
    if (lineInputs.length === 0) {
      lineInputs = found.lineItems.map((li) => ({
        treatmentId: li.treatmentId ?? undefined,
        invoiceLineItemId: li.id,
        cdtCode: li.cdtCode ?? 'UNSPECIFIED',
        description: li.description,
        billedAmountCents: li.amountCents,
      }));
    }
  }

  if (lineInputs.length === 0) {
    throw new BusinessLogicError('A claim must have at least one line', 'NO_CLAIM_LINES');
  }

  const billedAmountCents = lineInputs.reduce((s, l) => s + Math.max(0, l.billedAmountCents), 0);

  // RLS P1b activation: route the claim insert (+ its lines) through a single
  // withTenantTx so the app_rls policy on the Tier-1 dental_insurance_claim
  // enforces the branch scope as a second wall (WITH CHECK) and the writes stay
  // atomic. Authz above stays on db to preserve the exact 403/404.
  const { claim, lines } = await withTenantTx(db, { branchIds: [patient.preferredBranchId!] }, async (tx) => {
    const txClaimRepo = new DentalInsuranceClaimRepository(tx, logger);
    const createdClaim = await txClaimRepo.createOne({
      patientId: body.patientId,
      insuranceProfileId: body.insuranceProfileId,
      branchId: patient.preferredBranchId!,
      invoiceId: body.invoiceId ?? null,
      visitId: body.visitId ?? null,
      authorizationId: body.authorizationId ?? null,
      claimNumber: txClaimRepo.generateClaimNumber(),
      status: 'draft',
      submissionChannel: (body.submissionChannel && SUBMISSION_CHANNELS.includes(body.submissionChannel as SubmissionChannel) ? body.submissionChannel as SubmissionChannel : null),
      billedAmountCents,
      paidByPayerCents: 0,
      patientPortionCents: billedAmountCents,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const lineRows: NewDentalInsuranceClaimLine[] = lineInputs.map((l) => ({
      claimId: createdClaim.id,
      treatmentId: l.treatmentId ?? null,
      invoiceLineItemId: l.invoiceLineItemId ?? null,
      cdtCode: l.cdtCode,
      description: l.description,
      billedAmountCents: Math.max(0, l.billedAmountCents),
      paidAmountCents: 0,
      status: 'pending',
      createdBy: user.id,
      updatedBy: user.id,
    }));
    const createdLines = await txClaimRepo.createLines(lineRows);
    return { claim: createdClaim, lines: createdLines };
  });

  logger?.info({ action: 'createInsuranceClaim', patientId: body.patientId, claimId: claim.id, lines: lines.length }, 'Insurance claim created');

  return ctx.json({ ...claim, lines }, 201);
}
