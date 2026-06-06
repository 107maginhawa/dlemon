import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListPractitionerRolesQuery } from '@/generated/openapi/validators';
import { PractitionerRoleRepository, type PractitionerRoleFilters } from './repos/practitioner-role.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';

/**
 * listPractitionerRoles
 *
 * Path: GET /providers/practitioner-roles
 * OperationId: listPractitionerRoles
 */
export async function listPractitionerRoles(
  ctx: ValidatedContext<never, ListPractitionerRolesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const { limit, offset } = parsePagination(query);

  const filters: PractitionerRoleFilters = {};
  if (query.practitioner) filters.practitionerId = query.practitioner;
  if (query.active !== undefined) filters.active = query.active;
  if (query.specialty) filters.specialty = query.specialty;

  const repo = new PractitionerRoleRepository(db, logger);
  const [data, totalCount] = await Promise.all([
    repo.findMany(filters, { pagination: { limit, offset } }),
    repo.count(filters),
  ]);

  const pagination = buildPaginationMeta(data, totalCount, limit, offset);

  logger?.info({ filters, pagination: { limit, offset }, resultCount: data.length, totalCount, action: 'list' }, 'PractitionerRoles listed');

  return ctx.json({ data, pagination }, 200);
}