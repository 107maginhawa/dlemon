/**
 * initializeDentition — POST /dental/patients/:patientId/dentition
 *
 * FR1.19: Dentition Management (deciduous auto-populate).
 * Route lives under /dental/patients so the codegen registry entry is here;
 * delegates to the canonical implementation in dental-visit/.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from '../dental-visit/repos/dental-chart.repo';
import { VisitRepository } from '../dental-visit/repos/visit.repo';
import type { ToothChartState } from '../dental-visit/repos/dental-chart.schema';
import type { InitializeDentitionBody, InitializeDentitionParams } from '@/generated/openapi/validators';

// ISO 3950 deciduous tooth numbers (primary dentition)
const DECIDUOUS_TEETH = [
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
];

// ISO 3950 permanent tooth numbers (adult dentition)
const PERMANENT_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18,
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
];

function getAgeYears(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function buildTeeth(numbers: number[], note?: string): ToothChartState[] {
  return numbers.map(n => ({
    toothNumber: n,
    state: 'healthy',
    ...(note ? { note } : {}),
  }));
}

export async function initializeDentition(
  ctx: ValidatedContext<InitializeDentitionBody, never, InitializeDentitionParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const params = ctx.req.valid('param');
  const patientId = params.patientId;
  const body = ctx.req.valid('json');

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(body.visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const age = getAgeYears(body.dateOfBirth);

  let teeth: ToothChartState[];
  let dentitionType: 'deciduous' | 'mixed' | 'permanent';

  if (age <= 5) {
    teeth = buildTeeth(DECIDUOUS_TEETH);
    dentitionType = 'deciduous';
  } else if (age <= 12) {
    teeth = [
      ...buildTeeth(DECIDUOUS_TEETH, 'primary'),
      ...buildTeeth(PERMANENT_TEETH, 'permanent'),
    ];
    dentitionType = 'mixed';
  } else {
    teeth = buildTeeth(PERMANENT_TEETH);
    dentitionType = 'permanent';
  }

  const repo = new DentalChartRepository(db, logger);
  const chart = await repo.upsert({
    visitId: body.visitId,
    patientId,
    teeth,
  });

  logger?.info({ action: 'initializeDentition', patientId, dentitionType }, 'Dentition initialized');

  return ctx.json({
    chartId: chart.id,
    patientId,
    dentitionType,
    toothCount: teeth.length,
    teeth,
  }, 201);
}
