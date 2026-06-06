/**
 * listDueRecalls — GET /dental/recalls/due?branchId=&from=&to=&page=&per_page= (P1-24)
 *
 * Branch-scoped recare due-list for the front desk. Returns non-terminal recalls
 * (pending/sent) whose dueDate falls within [from, to], enriched with patient
 * display name, ordered by dueDate. Defaults: from = today (branch tz), to = +30d.
 *
 * Authorization: the caller must be an active member of the branch (V-PAT-002
 * pattern, branch-scoped not patient-scoped).
 */

import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { RecallRepository } from '../repos/recall.repo';
import { getBranchReminderPolicy } from '@/handlers/dental-org/repos/org-scheduling.facade';
import { todayInTimezone, addMonths } from '../utils/recall-dates';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function listDueRecalls(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as {
    branchId: string;
    from?: string;
    to?: string;
    page?: number;
    perPage?: number;
  };

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-scoped authorization.
  await assertBranchAccess(db, user.id, query.branchId);

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (query.from && !DATE_RE.test(query.from)) throw new ValidationError('from must be YYYY-MM-DD');
  if (query.to && !DATE_RE.test(query.to)) throw new ValidationError('to must be YYYY-MM-DD');

  const { timezone } = await getBranchReminderPolicy(db, query.branchId);
  const today = todayInTimezone(timezone);
  const from = query.from ?? today;
  const to = query.to ?? addMonths(today, 1);

  const page = query.page && query.page > 0 ? query.page : 1;
  const perPage = query.perPage && query.perPage > 0 ? Math.min(query.perPage, 200) : 50;
  const offset = (page - 1) * perPage;

  const repo = new RecallRepository(db, ctx.get('logger'));
  const rows = await repo.findDueByBranch(query.branchId, from, to, { limit: perPage, offset });

  return ctx.json(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      patientName: r.patientName,
      type: r.type,
      dueDate: r.dueDate,
      status: r.status,
      intervalMonths: r.intervalMonths ?? null,
      sendAttempts: r.sendAttempts,
      lastSentAt: r.lastSentAt ? r.lastSentAt.toISOString() : null,
    })),
    200,
  );
}
