/**
 * Consent Form Templates handlers (FR8.4b)
 *
 * GET    /dental/branches/:branchId/consent-templates         — list templates
 * POST   /dental/branches/:branchId/consent-templates         — create template
 * PATCH  /dental/branches/:branchId/consent-templates/:id     — update template
 * DELETE /dental/branches/:branchId/consent-templates/:id     — soft-delete (active=false)
 *
 * FR8.13: Access control — write operations restricted to dentist_owner role.
 */

import { z } from 'zod';
import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalConsentTemplates } from './repos/consent-template.schema';
import { dentalMemberships } from './repos/membership.schema';
import { dentalBranches } from './repos/branch.schema';
import { logAuditEvent } from '@/core/audit-logger';
import { eq, and } from 'drizzle-orm';

/**
 * V-ORG-002: Resolve the owning org id for a branch (audit tenantId). Returns
 * the branchId as a safe fallback if the branch row is somehow missing so the
 * audit write still succeeds.
 */
async function resolveTenantId(db: DatabaseInstance, branchId: string): Promise<string> {
  const [branch] = await db
    .select({ organizationId: dentalBranches.organizationId })
    .from(dentalBranches)
    .where(eq(dentalBranches.id, branchId));
  return branch?.organizationId ?? branchId;
}

const createConsentTemplateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  body: z.string().min(1, 'body is required'),
  requiresWitnessSignature: z.boolean().optional().default(false),
});

const updateConsentTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  requiresWitnessSignature: z.boolean().optional(),
});

export async function getMemberRole(db: DatabaseInstance, userId: string, branchId: string): Promise<string | null> {
  // EF-ORG-P020: Only an *active* membership grants role-based access. A
  // revoked/inactive/invited member must not retain their role privileges.
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(
      eq(dentalMemberships.personId, userId),
      eq(dentalMemberships.branchId, branchId),
      eq(dentalMemberships.status, 'active'),
    ));
  return member?.role ?? null;
}

export async function listConsentTemplates(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  const templates = await db
    .select()
    .from(dentalConsentTemplates)
    .where(and(
      eq(dentalConsentTemplates.branchId, branchId),
      eq(dentalConsentTemplates.active, true),
    ));

  return ctx.json({ templates }, 200);
}

export async function createConsentTemplate(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  // FR8.13: Only dentist_owner can manage templates
  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can manage consent templates');
  }

  const rawBody = await ctx.req.json();
  const body = createConsentTemplateSchema.parse(rawBody);

  const [created] = await db
    .insert(dentalConsentTemplates)
    .values({
      branchId,
      name: body.name,
      body: body.body,
      requiresWitnessSignature: body.requiresWitnessSignature,
      active: true,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  // V-ORG-002 / §10b (AL-*): consent-template lifecycle is owner-only and must
  // be audited. Template name is config text (non-PHI); the body is not logged.
  const logger = ctx.get('logger');
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: await resolveTenantId(db, branchId),
      branchId,
      eventType: 'data-modification',
      action: 'consent_template.create',
      resourceType: 'dental_consent_template',
      resourceId: created!.id,
      metadata: { templateName: body.name },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'V-ORG-002: failed to write consent_template.create audit log');
  }

  return ctx.json({ template: created }, 201);
}

export async function updateConsentTemplate(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;
  const templateId = ctx.req.param('id') as string;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can manage consent templates');
  }

  const [existing] = await db
    .select()
    .from(dentalConsentTemplates)
    .where(and(eq(dentalConsentTemplates.id, templateId), eq(dentalConsentTemplates.branchId, branchId)));
  if (!existing) throw new NotFoundError('Consent template not found');

  const rawBody = await ctx.req.json();
  const body = updateConsentTemplateSchema.parse(rawBody);

  const [updated] = await db
    .update(dentalConsentTemplates)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.body !== undefined ? { body: body.body } : {}),
      ...(body.requiresWitnessSignature !== undefined ? { requiresWitnessSignature: body.requiresWitnessSignature } : {}),
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(dentalConsentTemplates.id, templateId))
    .returning();

  // V-ORG-002 / §10b (AL-*): audit consent-template updates.
  const logger = ctx.get('logger');
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: await resolveTenantId(db, branchId),
      branchId,
      eventType: 'data-modification',
      action: 'consent_template.update',
      resourceType: 'dental_consent_template',
      resourceId: templateId,
      metadata: { changedKeys: Object.keys(body) },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'V-ORG-002: failed to write consent_template.update audit log');
  }

  return ctx.json({ template: updated }, 200);
}

export async function deleteConsentTemplate(ctx: BaseContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;
  const templateId = ctx.req.param('id') as string;

  // Branch-level authorization
  await assertBranchAccess(db, user.id, branchId);

  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can manage consent templates');
  }

  const [existing] = await db
    .select()
    .from(dentalConsentTemplates)
    .where(and(eq(dentalConsentTemplates.id, templateId), eq(dentalConsentTemplates.branchId, branchId)));
  if (!existing) throw new NotFoundError('Consent template not found');

  // Soft delete
  await db
    .update(dentalConsentTemplates)
    .set({ active: false, updatedAt: new Date(), updatedBy: user.id })
    .where(eq(dentalConsentTemplates.id, templateId));

  // V-ORG-002 / §10b (AL-*): audit consent-template soft-deletes.
  const logger = ctx.get('logger');
  try {
    await logAuditEvent(db, logger, {
      personId: user.id,
      tenantId: await resolveTenantId(db, branchId),
      branchId,
      eventType: 'data-modification',
      action: 'consent_template.delete',
      resourceType: 'dental_consent_template',
      resourceId: templateId,
      metadata: { softDelete: true },
    });
  } catch (auditErr) {
    logger?.warn?.({ auditErr }, 'V-ORG-002: failed to write consent_template.delete audit log');
  }

  return ctx.json({ deleted: true }, 200);
}
