import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_updateCephLandmarkBody, CephMgmt_updateCephLandmarkParams } from '@/generated/openapi/validators';
import { updateCephLandmark } from './updateCephLandmark';

export async function CephMgmt_updateCephLandmark(
  ctx: ValidatedContext<CephMgmt_updateCephLandmarkBody, never, CephMgmt_updateCephLandmarkParams>
): Promise<Response> {
  return updateCephLandmark(ctx as BaseContext);
}
