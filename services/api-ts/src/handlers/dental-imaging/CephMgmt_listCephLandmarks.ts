import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_listCephLandmarksParams } from '@/generated/openapi/validators';
import { listCephLandmarks } from './listCephLandmarks';

export async function CephMgmt_listCephLandmarks(
  ctx: ValidatedContext<never, never, CephMgmt_listCephLandmarksParams>
): Promise<Response> {
  return listCephLandmarks(ctx as BaseContext);
}
