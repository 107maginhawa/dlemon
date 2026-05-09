import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListPractitionersQuery } from '@/generated/openapi/validators';
import { PractitionerRepository, type PractitionerFilters } from './repos/practitioner.repo';
import { parsePagination, buildPaginationMeta } from '@/utils/query';

/**
 * listPractitioners
 *
 * Path: GET /providers/practitioners
 * OperationId: listPractitioners
 */
export async function listPractitioners(
  ctx: ValidatedContext<never, ListPractitionersQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const { limit, offset } = parsePagination(query);

  const filters: PractitionerFilters = {};
  if ((query as any).active !== undefined) filters.active = (query as any).active;
  if ((query as any).specialty) filters.specialty = (query as any).specialty;

  const repo = new PractitionerRepository(db, logger);
  const [data, totalCount] = await Promise.all([
    repo.findMany(filters, { pagination: { limit, offset } }),
    repo.count(filters),
  ]);

  const pagination = buildPaginationMeta(data, totalCount, limit, offset);

  logger?.info({ filters, pagination: { limit, offset }, resultCount: data.length, totalCount, action: 'list' }, 'Practitioners listed');

  return ctx.json({ data, pagination }, 200);
}