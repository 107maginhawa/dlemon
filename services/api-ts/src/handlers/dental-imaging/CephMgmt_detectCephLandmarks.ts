import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_detectCephLandmarksParams } from '@/generated/openapi/validators';
import { detectCephLandmarks } from './detectCephLandmarks';

export async function CephMgmt_detectCephLandmarks(
  ctx: ValidatedContext<never, never, CephMgmt_detectCephLandmarksParams>
): Promise<Response> {
  return detectCephLandmarks(ctx as BaseContext);
}
