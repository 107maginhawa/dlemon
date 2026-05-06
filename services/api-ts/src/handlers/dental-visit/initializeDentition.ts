/**
 * initializeDentition — FR1.19 Dentition Management
 *
 * POST /dental/patients/:patientId/dentition
 *
 * Auto-populates a patient's dental chart with the appropriate tooth set based on age:
 * - Deciduous (baby) teeth: tooth numbers 51–65 (primary dentition, ISO numbering)
 * - Permanent teeth: tooth numbers 11–48 (adult dentition, ISO numbering)
 * - Mixed dentition (6–12 years): returns both sets with deciduous marked as primary
 *
 * This is called during patient onboarding or first visit creation for pediatric patients.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { VisitRepository } from './repos/visit.repo';
import type { ToothChartState } from './repos/dental-chart.schema';

// ISO 3950 deciduous tooth numbers (primary dentition)
// Upper right: 51-55, Upper left: 61-65, Lower left: 71-75, Lower right: 81-85
const DECIDUOUS_TEETH = [
  51, 52, 53, 54, 55,
  61, 62, 63, 64, 65,
  71, 72, 73, 74, 75,
  81, 82, 83, 84, 85,
];

// ISO 3950 permanent tooth numbers (adult dentition)
// Upper right: 11-18, Upper left: 21-28, Lower left: 31-38, Lower right: 41-48
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

export async function initializeDentition(ctx: Context): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const patientId = ctx.req.param('patientId') as string;

  const body = await ctx.req.json().catch(() => ({})) as {
    dateOfBirth?: string;
    visitId?: string;
  };

  if (!body.dateOfBirth) {
    throw new ValidationError('dateOfBirth is required to determine dentition type');
  }
  if (!body.visitId) {
    throw new ValidationError('visitId is required to associate the dental chart');
  }

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(body.visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const age = getAgeYears(body.dateOfBirth);

  let teeth: ToothChartState[];
  let dentitionType: 'deciduous' | 'mixed' | 'permanent';

  if (age <= 5) {
    // Full deciduous dentition
    teeth = buildTeeth(DECIDUOUS_TEETH);
    dentitionType = 'deciduous';
  } else if (age <= 12) {
    // Mixed dentition — both deciduous and permanent present
    teeth = [
      ...buildTeeth(DECIDUOUS_TEETH, 'primary'),
      ...buildTeeth(PERMANENT_TEETH, 'permanent'),
    ];
    dentitionType = 'mixed';
  } else {
    // Full permanent dentition
    teeth = buildTeeth(PERMANENT_TEETH);
    dentitionType = 'permanent';
  }

  const repo = new DentalChartRepository(db, logger);
  const chart = await repo.upsert({
    visitId: body.visitId,
    patientId,
    teeth,
  });

  return ctx.json({
    chartId: chart.id,
    patientId,
    dentitionType,
    toothCount: teeth.length,
    teeth,
  }, 201);
}
