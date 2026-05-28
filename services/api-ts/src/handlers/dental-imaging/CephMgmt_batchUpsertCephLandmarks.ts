import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_batchUpsertCephLandmarksBody, CephMgmt_batchUpsertCephLandmarksParams } from '@/generated/openapi/validators';
import { batchUpsertCephLandmarks } from './batchUpsertCephLandmarks';

export async function CephMgmt_batchUpsertCephLandmarks(
  ctx: ValidatedContext<CephMgmt_batchUpsertCephLandmarksBody, never, CephMgmt_batchUpsertCephLandmarksParams>
): Promise<Response> {
  return batchUpsertCephLandmarks(ctx as BaseContext);
}
