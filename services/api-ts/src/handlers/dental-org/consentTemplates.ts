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

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '@/core/errors';
import { dentalConsentTemplates } from './repos/consent-template.schema';
import { dentalMemberships } from './repos/membership.schema';
import { eq, and } from 'drizzle-orm';

async function getMemberRole(db: DatabaseInstance, userId: string, branchId: string): Promise<string | null> {
  const [member] = await db
    .select({ role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(and(eq(dentalMemberships.personId, userId), eq(dentalMemberships.branchId, branchId)));
  return member?.role ?? null;
}

export async function listConsentTemplates(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;

  const templates = await db
    .select()
    .from(dentalConsentTemplates)
    .where(and(
      eq(dentalConsentTemplates.branchId, branchId),
      eq(dentalConsentTemplates.active, true),
    ));

  return ctx.json({ templates }, 200);
}

export async function createConsentTemplate(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;

  // FR8.13: Only dentist_owner can manage templates
  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can manage consent templates');
  }

  const body = await ctx.req.json().catch(() => null) as any;
  if (!body?.name) throw new ValidationError('name is required');
  if (!body?.body) throw new ValidationError('body is required');

  const [created] = await db
    .insert(dentalConsentTemplates)
    .values({
      branchId,
      name: body.name,
      body: body.body,
      requiresWitnessSignature: body.requiresWitnessSignature ?? false,
      active: true,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  return ctx.json({ template: created }, 201);
}

export async function updateConsentTemplate(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;
  const templateId = ctx.req.param('id') as string;

  const role = await getMemberRole(db, user.id, branchId);
  if (!role || role !== 'dentist_owner') {
    throw new ForbiddenError('Only the dentist owner can manage consent templates');
  }

  const [existing] = await db
    .select()
    .from(dentalConsentTemplates)
    .where(and(eq(dentalConsentTemplates.id, templateId), eq(dentalConsentTemplates.branchId, branchId)));
  if (!existing) throw new NotFoundError('Consent template not found');

  const body = await ctx.req.json().catch(() => ({})) as any;

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

  return ctx.json({ template: updated }, 200);
}

export async function deleteConsentTemplate(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as any;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.param('branchId') as string;
  const templateId = ctx.req.param('id') as string;

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

  return ctx.json({ deleted: true }, 200);
}
