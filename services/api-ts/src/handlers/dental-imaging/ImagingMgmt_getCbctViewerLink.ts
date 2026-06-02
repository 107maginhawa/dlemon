import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_getCbctViewerLinkParams } from '@/generated/openapi/validators';
import { getCbctViewerLink } from './getCbctViewerLink';

/**
 * ImagingMgmt_getCbctViewerLink
 *
 * Path: GET /dental/imaging/studies/{studyId}/cbct/viewer-link
 * OperationId: ImagingMgmt_getCbctViewerLink
 *
 * Thin wrapper — the underlying handler reads ctx.req.param() directly.
 */
export async function ImagingMgmt_getCbctViewerLink(
  ctx: ValidatedContext<never, never, ImagingMgmt_getCbctViewerLinkParams>
): Promise<Response> {
  return getCbctViewerLink(ctx as BaseContext);
}
