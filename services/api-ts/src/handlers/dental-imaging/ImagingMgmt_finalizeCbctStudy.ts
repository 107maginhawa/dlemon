import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_finalizeCbctStudyBody, ImagingMgmt_finalizeCbctStudyParams } from '@/generated/openapi/validators';
import { finalizeCbctStudy } from './finalizeCbctStudy';

/**
 * ImagingMgmt_finalizeCbctStudy
 *
 * Path: POST /dental/imaging/studies/{studyId}/cbct/finalize
 * OperationId: ImagingMgmt_finalizeCbctStudy
 *
 * Thin wrapper — the underlying handler reads ctx.req.param()/json() directly,
 * so the ValidatedContext → BaseContext narrowing only drops unused typed overloads.
 */
export async function ImagingMgmt_finalizeCbctStudy(
  ctx: ValidatedContext<ImagingMgmt_finalizeCbctStudyBody, never, ImagingMgmt_finalizeCbctStudyParams>
): Promise<Response> {
  return finalizeCbctStudy(ctx as BaseContext);
}
