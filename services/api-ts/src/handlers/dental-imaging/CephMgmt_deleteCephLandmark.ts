import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_deleteCephLandmarkParams } from '@/generated/openapi/validators';
import { deleteCephLandmark } from './deleteCephLandmark';

export async function CephMgmt_deleteCephLandmark(
  ctx: ValidatedContext<never, never, CephMgmt_deleteCephLandmarkParams>
): Promise<Response> {
  return deleteCephLandmark(ctx as BaseContext);
}
