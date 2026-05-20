import type { ValidatedContext } from '@/types/app';
import type { ImagingFindingsMgmt_listFindingsParams } from '@/generated/openapi/validators';
import { listFindings } from './listFindings';

/**
 * ImagingFindingsMgmt_listFindings
 *
 * Path: GET /dental/imaging/images/{imageId}/findings
 * OperationId: ImagingFindingsMgmt_listFindings
 */
export async function ImagingFindingsMgmt_listFindings(
  ctx: ValidatedContext<never, never, ImagingFindingsMgmt_listFindingsParams>
): Promise<Response> {
  return listFindings(ctx as any);
}
