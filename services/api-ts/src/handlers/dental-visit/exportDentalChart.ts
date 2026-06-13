/**
 * exportDentalChart handler — P0-B
 *
 * GET /dental/visits/{visitId}/chart/export
 *
 * Returns a structured (not screenshot) snapshot of a visit's chart: header
 * (patient/provider/branch/date), the odontogram tooth/surface table with each
 * tooth's derived layer, a legend, and a proposed/completed/declined treatment
 * summary. Mirrors exportPMD (a portable clinical record for referral / legal).
 */
import { inArray, eq } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getDentalPatientWithPerson } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { getBranchAndProviderNames } from '@/handlers/dental-org/repos/org-clinical.facade';
import { VisitRepository } from './repos/visit.repo';
import { DentalChartRepository } from './repos/dental-chart.repo';
import { DentalChartBaselineRepository } from './repos/dental-chart-baseline.repo';
import { dentalTreatments } from './repos/treatment.schema';
import { dentalVisits } from './repos/visit.schema';
import type { ToothChartState } from './repos/dental-chart.schema';
import { buildChartExport, type ChartExportTreatmentInput } from './chart/chart-export';
import type { ExportDentalChartParams } from '@/generated/openapi/validators';
import type { User } from '@/types/auth';

export async function exportDentalChart(
  ctx: ValidatedContext<never, never, ExportDentalChartParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const visit = await new VisitRepository(db).findOneById(visitId);
  if (!visit) throw new NotFoundError('Dental visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  // Patient header (name + DOB).
  const patient = await getDentalPatientWithPerson(db, visit.patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  const patientName = [patient.person.firstName, patient.person.lastName].filter(Boolean).join(' ').trim()
    || 'Unknown patient';

  // Chart teeth: the visit's own chart, else the carried-forward patient baseline.
  const chartRepo = new DentalChartRepository(db);
  const chart = await chartRepo.findByVisit(visitId);
  let chartTeeth: ToothChartState[] = (chart?.teeth as ToothChartState[]) ?? [];
  if (!chart) {
    const baseline = await new DentalChartBaselineRepository(db).findByPatient(visit.patientId);
    chartTeeth = baseline?.teeth ?? [];
  }

  // Treatments across ALL the patient's visits (the plan is a living document).
  const visits = await db
    .select({ id: dentalVisits.id })
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, visit.patientId));
  const visitIds = visits.map((v) => v.id);
  const treatmentRows = visitIds.length
    ? await db.select().from(dentalTreatments).where(inArray(dentalTreatments.visitId, visitIds))
    : [];
  const treatments: ChartExportTreatmentInput[] = treatmentRows.map((t) => ({
    toothNumber: t.toothNumber,
    cdtCode: t.cdtCode,
    description: t.description,
    surfaces: t.surfaces,
    status: t.status,
    priceCents: t.priceCents,
  }));

  const { branchName, providerName } = await getBranchAndProviderNames(db, visit.branchId, visit.dentistMemberId);

  const exportDoc = buildChartExport({
    patient: { id: visit.patientId, name: patientName, dateOfBirth: patient.person.dateOfBirth },
    visit: {
      id: visit.id,
      date: visit.activatedAt ?? visit.createdAt,
      status: visit.status,
      providerMemberId: visit.dentistMemberId,
      branchId: visit.branchId,
    },
    branchName,
    providerName,
    chartTeeth,
    treatments,
    generatedAt: new Date(),
  });

  return ctx.json(exportDoc, 200);
}
