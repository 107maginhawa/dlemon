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
  type CoverageAuthorizationSummary,
} from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { estimateCoverage } from './utils/coverage-estimate';
import { SUBMISSION_CHANNELS, type ClaimLineStatus, type NewDentalInsuranceClaimLine, type SubmissionChannel } from './repos/dental-insurance-claim.schema';

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

  // Optional authorization (LOA) must belong to the same patient.
  let auth: CoverageAuthorizationSummary | null = null;
  if (body.authorizationId) {
    auth = await getCoverageAuthorizationForBilling(db, body.authorizationId, body.patientId);
    if (!auth) throw new BusinessLogicError('Coverage authorization not found for this patient');
    // BR-056: an expired / denied / past-validity LOA cannot back a new claim.
    // validUntil is a DATE column → a 'YYYY-MM-DD' string; ISO-date lexicographic
    // compare is chronologically correct. `< today` is INCLUSIVE of the validUntil
    // day (an LOA is still valid ON its validUntil date) — do not change to `<=`.
    const today = new Date().toISOString().slice(0, 10);
    const expired = auth.status === 'expired' || auth.status === 'denied'
      || (auth.validUntil != null && auth.validUntil < today);
    if (expired) {
      throw new BusinessLogicError('Cannot file a claim against an expired or invalid authorization', 'LOA_EXPIRED');
    }
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

  // BR-057: when an approved LOA backs the claim, the covered amount is capped at
  // the LOA's approved amount (per-procedure or blanket) and the patient copay is
  // billed − covered. Reuses the pure coverage engine that powers the estimate
  // endpoint, so the filed claim matches the pre-treatment estimate. Without an
  // approved LOA the patient owes the full billed amount (legacy default).
  let claimApprovedCents: number | null = null;
  let claimPatientPortionCents = billedAmountCents;
  let lineCoverage: Array<{ approvedAmountCents: number; status: ClaimLineStatus }> | null = null;
  if (auth && (auth.status === 'approved' || auth.status === 'partial')) {
    const annualLimitRemainingCents = profile.annualLimitCents != null
      ? Math.max(0, profile.annualLimitCents - (profile.annualLimitUsedCents ?? 0))
      : null;
    const est = estimateCoverage(
      lineInputs.map((l) => ({ cdtCode: l.cdtCode, billedAmountCents: l.billedAmountCents, description: l.description })),
      {
        hasActiveProfile: profile.active,
        approvedAmountCents: auth.approvedAmountCents ?? undefined,
        coveredProcedures: auth.coveredProcedures ?? undefined,
        annualLimitRemainingCents,
      },
    );
    claimApprovedCents = est.estimatedCoveredCents;
    claimPatientPortionCents = est.estimatedPatientPortionCents;
    lineCoverage = est.perLine.map((p) => ({
      approvedAmountCents: p.coveredCents,
      status: p.coveredCents === 0 ? 'disallowed' : (p.coveredCents >= p.billedAmountCents ? 'covered' : 'partial'),
    }));
  } else if (auth) {
    // A referenced-but-not-yet-approved LOA (e.g. 'requested') backs the claim but
    // applies NO coverage — the patient owes the full billed amount until the LOA
    // is approved. Log it so billing staff know coverage was deferred, not lost.
    logger?.warn({ action: 'createInsuranceClaim', authorizationId: body.authorizationId, loaStatus: auth.status }, 'Claim references an unapproved LOA — no coverage applied');
  }

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
      approvedAmountCents: claimApprovedCents,
      paidByPayerCents: 0,
      patientPortionCents: claimPatientPortionCents,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const lineRows: NewDentalInsuranceClaimLine[] = lineInputs.map((l, i) => {
      // lineCoverage (when set) is est.perLine, built by mapping the SAME lineInputs
      // array, so index i always aligns; fall back explicitly rather than assert.
      const cov = lineCoverage?.[i];
      return {
        claimId: createdClaim.id,
        treatmentId: l.treatmentId ?? null,
        invoiceLineItemId: l.invoiceLineItemId ?? null,
        cdtCode: l.cdtCode,
        description: l.description,
        billedAmountCents: Math.max(0, l.billedAmountCents),
        approvedAmountCents: cov ? cov.approvedAmountCents : null,
        paidAmountCents: 0,
        status: cov ? cov.status : 'pending',
        createdBy: user.id,
        updatedBy: user.id,
      };
    });
    const createdLines = await txClaimRepo.createLines(lineRows);
    return { claim: createdClaim, lines: createdLines };
  });

  logger?.info({ action: 'createInsuranceClaim', patientId: body.patientId, claimId: claim.id, lines: lines.length }, 'Insurance claim created');

  return ctx.json({ ...claim, lines }, 201);
}
