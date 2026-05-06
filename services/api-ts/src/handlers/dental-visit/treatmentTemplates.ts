/**
 * Treatment Templates handlers (FR1.8)
 *
 * GET    /dental/treatment-templates?branchId=...  — list templates
 * POST   /dental/treatment-templates               — create template
 * PATCH  /dental/treatment-templates/:id           — update template
 * DELETE /dental/treatment-templates/:id           — deactivate template
 * POST   /dental/visits/:visitId/apply-template/:templateId — apply template to visit
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalTreatmentTemplates } from './repos/treatment-template.schema';
import { TreatmentRepository } from './repos/treatment.repo';
import { VisitRepository } from './repos/visit.repo';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const templateItemSchema = z.object({
  cdtCode: z.string(),
  description: z.string(),
  priceCents: z.number(),
  toothNumber: z.number().optional(),
  surfaces: z.array(z.string()).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  branchId: z.string().uuid('branchId is required'),
  description: z.string().optional(),
  items: z.array(templateItemSchema).min(1, 'items must be a non-empty array'),
});

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  items: z.array(templateItemSchema).optional(),
  active: z.boolean().optional(),
});

export async function listTreatmentTemplates(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.query('branchId');
  if (!branchId) throw new Error('branchId query parameter is required');
  await assertBranchAccess(db, user.id, branchId);

  const templates = await db.select().from(dentalTreatmentTemplates).where(
    and(eq(dentalTreatmentTemplates.branchId, branchId), eq(dentalTreatmentTemplates.active, true))
  );

  return ctx.json({ templates }, 200);
}

export async function createTreatmentTemplate(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const rawBody = await ctx.req.json();
  const body = createTemplateSchema.parse(rawBody);

  await assertBranchAccess(db, user.id, body.branchId);

  const [template] = await db.insert(dentalTreatmentTemplates).values({
    branchId: body.branchId,
    name: body.name,
    description: body.description ?? null,
    items: body.items,
    active: true,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning();

  return ctx.json(template, 201);
}

export async function updateTreatmentTemplate(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const templateId = ctx.req.param('id');
  if (!templateId) throw new NotFoundError('Treatment template not found');
  const db = ctx.get('database') as DatabaseInstance;
  const rawBody = await ctx.req.json();
  const body = updateTemplateSchema.parse(rawBody);

  const [existing] = await db.select().from(dentalTreatmentTemplates).where(eq(dentalTreatmentTemplates.id, templateId));
  if (!existing) throw new NotFoundError('Treatment template not found');

  await assertBranchAccess(db, user.id, existing.branchId);

  const updates: any = { updatedAt: new Date(), updatedBy: user.id };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.items !== undefined) updates.items = body.items;
  if (body.active !== undefined) updates.active = body.active;

  const [updated] = await db.update(dentalTreatmentTemplates).set(updates).where(eq(dentalTreatmentTemplates.id, templateId)).returning();
  return ctx.json(updated, 200);
}

export async function deleteTreatmentTemplate(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const templateId = ctx.req.param('id');
  if (!templateId) throw new NotFoundError('Treatment template not found');
  const db = ctx.get('database') as DatabaseInstance;

  const [existing] = await db.select().from(dentalTreatmentTemplates).where(eq(dentalTreatmentTemplates.id, templateId));
  if (!existing) throw new NotFoundError('Treatment template not found');

  await assertBranchAccess(db, user.id, existing.branchId);

  await db.update(dentalTreatmentTemplates).set({ active: false, updatedAt: new Date() }).where(eq(dentalTreatmentTemplates.id, templateId));
  return ctx.json({ success: true }, 200);
}

export async function applyTemplate(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId');
  if (!visitId) throw new NotFoundError('Visit not found');
  const templateId = ctx.req.param('templateId');
  if (!templateId) throw new NotFoundError('Treatment template not found');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit not found');

  await assertBranchAccess(db, user.id, visit.branchId);

  // FR1.16: Block on completed/locked
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError(`Cannot apply template to a ${visit.status} visit`, 'VISIT_IMMUTABLE');
  }

  const [template] = await db.select().from(dentalTreatmentTemplates).where(eq(dentalTreatmentTemplates.id, templateId));
  if (!template || !template.active) throw new NotFoundError('Treatment template not found');

  const treatmentRepo = new TreatmentRepository(db);
  const created = await Promise.all(
    template.items.map(item =>
      treatmentRepo.createOne({
        visitId,
        patientId: visit.patientId,
        cdtCode: item.cdtCode,
        description: item.description,
        priceCents: item.priceCents,
        toothNumber: item.toothNumber,
        surfaces: item.surfaces,
        status: 'planned',
        carriedOver: false,
      })
    )
  );

  logger?.info({ action: 'applyTemplate', visitId, templateId, count: created.length }, 'Template applied to visit');

  return ctx.json({ applied: created, count: created.length }, 201);
}
