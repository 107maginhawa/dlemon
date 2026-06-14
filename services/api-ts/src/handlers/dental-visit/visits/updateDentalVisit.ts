/**
 * updateDentalVisit handler
 *
 * PATCH /dental/visits/{visitId}
 * Updates visit status or chiefComplaint.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { AppError, UnauthorizedError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
import { VisitRepository } from '../repos/visit.repo';
import { VISIT_TRANSITIONS, type DentalVisitStatus } from '../repos/visit.schema';
import { TreatmentRepository, VisitNotesRepository } from '../repos/treatment.repo';
import { countAttachmentsForVisit, hasSignedConsentForVisit } from '@/handlers/dental-clinical/repos/clinical-visit.facade';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { User } from '@/types/auth';
import type { UpdateDentalVisitBody, UpdateDentalVisitParams } from '@/generated/openapi/validators';
import { logAuditEvent } from '@/core/audit-logger';

export async function updateDentalVisit(
  ctx: ValidatedContext<UpdateDentalVisitBody, never, UpdateDentalVisitParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new VisitRepository(db);

  const visit = await repo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');

  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // FR1.16: Immutability — completed/locked visits cannot be modified
  if (visit.status === 'locked') {
    throw new BusinessLogicError('Locked visits cannot be modified', 'VISIT_LOCKED');
  }

  // Validate status transition using VISIT_TRANSITIONS map
  if (body.status && body.status !== visit.status) {
    const allowed = VISIT_TRANSITIONS[visit.status as DentalVisitStatus] ?? [];
    if (!allowed.includes(body.status as DentalVisitStatus)) {
      throw new BusinessLogicError(
        `Cannot transition visit from ${visit.status} to ${body.status}`,
        'VISIT_TRANSITION_INVALID'
      );
    }
  }

  // chiefComplaint edits blocked on completed/locked
  if (visit.status === 'completed' && body.chiefComplaint !== undefined && body.status === undefined) {
    throw new BusinessLogicError('Completed visit notes cannot be edited', 'VISIT_IMMUTABLE');
  }

  const patch: Partial<{ status: DentalVisitStatus; chiefComplaint: string }> = {};

  if (body.status !== undefined) {
    patch.status = body.status as DentalVisitStatus;
  }

  if (body.chiefComplaint !== undefined) {
    patch.chiefComplaint = body.chiefComplaint;
  }

  const log = ctx.get('logger');
  const requestId = ctx.get('requestId');

  // RLS P1b activation: run each terminal write under app_rls scoped to the
  // visit's branch (resolved + authorized above on `db`). One scope covers the
  // visit (Tier-1) and any visit-anchored Tier-2a child the write touches. The
  // facade guard reads, the audit write, and the failure-isolated PMD generation
  // deliberately stay on `db` (the bypassing connection) per ADR-010.
  const runScoped = <T>(fn: (tx: DatabaseInstance) => Promise<T>): Promise<T> =>
    withTenantTx(db, { branchIds: [visit.branchId] }, fn);

  // Apply lifecycle timestamps on status transitions
  if (patch.status === 'active') {
    // V-VIS-003 / BR-001: app-level guard — return 409 instead of a raw 500 from
    // the partial unique index when another active visit exists for this patient.
    const existingActive = await repo.findActiveByPatient(visit.patientId);
    if (existingActive && existingActive.id !== visitId) {
      throw new ConflictError(
        'Active visit already exists for this patient. Complete or discard it first.',
        'ACTIVE_VISIT_EXISTS',
      );
    }
    const updated = await runScoped(async (tx) => {
      const r = new VisitRepository(tx);
      const activated = await r.activate(visitId);
      if (!activated) throw new NotFoundError('Dental visit');
      if (patch.chiefComplaint) await r.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
      return patch.chiefComplaint ? await r.findOneById(visitId) ?? activated : activated;
    });
    log?.info({ requestId, action: 'dental_visit_activate', visitId, by: user.id }, 'Visit activated');
    // V-VIS-001 / DE-001 VisitCheckedIn: per ADR-006 this is an audit-log-only marker
    // (no event bus) — satisfy it by writing the dental_audit_log row synchronously.
    // Note: createVisit / VisitRepository.createOne writes NO audit row, so the
    // check-in lifecycle event is recorded here at the draft→active transition.
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    await logAuditEvent(db, log, {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      action: 'visit.checked_in',
      resourceType: 'dental_visit',
      resourceId: visitId,
    });
    return ctx.json(updated);
  }

  if (patch.status === 'completed') {
    const treatRepo = new TreatmentRepository(db);
    const treatments = await treatRepo.findByVisit(visitId);

    const notesRepo = new VisitNotesRepository(db);
    const notes = await notesRepo.findByVisit(visitId);

    const attachmentCount = await countAttachmentsForVisit(db, visitId);

    // BR-005: Auto-discard an empty visit (no treatments, no notes, no attachments).
    // When the session ends with nothing recorded, discard instead of completing.
    // createDentalVisit always seeds an empty notes row, so check for meaningful
    // SOAP content rather than mere existence of the row.
    //
    // V-VIS-004: per MODULE_SPEC §5 (BR-005) + §18, auto-discard is DEFERRED behind
    // a default-false feature flag (dental_visit_auto_discard, ADR-010). It only runs
    // when the flag is explicitly enabled; otherwise empty visits complete normally.
    const autoDiscardEnabled = process.env['DENTAL_VISIT_AUTO_DISCARD'] === 'true';
    const hasNoTreatments = treatments.length === 0;
    const hasNoNotes = !notes || (!notes.subjective && !notes.objective && !notes.assessment && !notes.plan);
    const hasNoAttachments = attachmentCount === 0;

    if (autoDiscardEnabled && hasNoTreatments && hasNoNotes && hasNoAttachments) {
      const discarded = await runScoped(async (tx) => {
        const r = new VisitRepository(tx);
        const discardedRaw = await r.discard(visitId);
        if (!discardedRaw) throw new NotFoundError('Dental visit');
        if (patch.chiefComplaint) await r.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
        return patch.chiefComplaint ? await r.findOneById(visitId) ?? discardedRaw : discardedRaw;
      });
      log?.info({ requestId, action: 'dental_visit_discard', visitId, by: user.id }, 'Empty visit auto-discarded (BR-005)');
      return ctx.json(discarded);
    }

    // Non-empty visit — enforce normal completion guards
    if (treatments.some(t => t.status === 'diagnosed' || t.status === 'planned')) {
      throw new BusinessLogicError('Visit has incomplete treatments', 'VISIT_HAS_OPEN_TREATMENTS');
    }

    if (!await hasSignedConsentForVisit(db, visitId)) {
      throw new BusinessLogicError('Signed consent form required before completing visit', 'VISIT_CONSENT_REQUIRED');
    }

    if (!notes) {
      throw new BusinessLogicError('Visit notes required before completing visit', 'VISIT_NOTES_REQUIRED');
    }

    const updated = await runScoped(async (tx) => {
      const r = new VisitRepository(tx);
      const completedRaw = await r.complete(visitId);
      if (!completedRaw) throw new NotFoundError('Dental visit');
      if (patch.chiefComplaint) await r.updateStatus(visitId, { chiefComplaint: patch.chiefComplaint });
      return patch.chiefComplaint ? await r.findOneById(visitId) ?? completedRaw : completedRaw;
    });
    log?.info({ requestId, action: 'dental_visit_complete', visitId, by: user.id }, 'Visit completed');
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    // P1-C fail-closed + P2-A before/after (AUD-BR-004): completing a clinical visit
    // must never silently commit without an audit row.
    await logAuditEvent(db, log, {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      eventType: 'data-modification',
      action: 'visit.complete',
      resourceType: 'dental_visit',
      resourceId: visitId,
      before: { status: visit.status },
      after: { status: 'completed' },
    }, { failClosed: true });

    // FR12.1 / WF-021 (AHA dental-pmd FIX-001): auto-generate the Portable
    // Medical Document on completion. Failure-ISOLATED — a PMD generation error
    // must never roll back or fail the visit completion (the clinical record is
    // already committed + audited above). Dynamic import avoids a static
    // dental-visit ↔ dental-pmd cycle. The core is idempotent (supersede).
    try {
      const { generatePmdForVisit } = await import('@/handlers/dental-pmd/generatePMD');
      await generatePmdForVisit(db, { visit: updated, actorUserId: user.id, logger: log });
    } catch (pmdErr) {
      // Surface the AppError code (e.g. a config issue like a deactivated
      // membership → FORBIDDEN) so on-call can distinguish an actionable failure
      // from transient I/O. Still swallowed — completion must not fail on PMD.
      const code = pmdErr instanceof AppError ? pmdErr.code : undefined;
      log?.error(
        { requestId, visitId, code, err: pmdErr },
        'PMD auto-generation failed (visit completion unaffected)',
      );
    }
    return ctx.json(updated);
  }

  if (patch.status === 'locked') {
    const locked = await runScoped((tx) => new VisitRepository(tx).lock(visitId));
    if (!locked) throw new NotFoundError('Dental visit');
    log?.info({ requestId, action: 'dental_visit_lock', visitId, by: user.id }, 'Visit locked');
    // V-VIS-001 / DE-003 VisitLocked: per ADR-006 this is an audit-log-only marker
    // (no event bus) — satisfy it by writing the dental_audit_log row synchronously.
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    await logAuditEvent(db, log, {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      action: 'visit.locked',
      resourceType: 'dental_visit',
      resourceId: visitId,
    });
    return ctx.json(locked);
  }

  const updated = await runScoped((tx) => new VisitRepository(tx).updateStatus(visitId, patch));
  return ctx.json(updated);
}
