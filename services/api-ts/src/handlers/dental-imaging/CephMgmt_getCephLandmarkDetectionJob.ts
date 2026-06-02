import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_getCephLandmarkDetectionJobParams } from '@/generated/openapi/validators';
import { getCephLandmarkDetectionJob } from './getCephLandmarkDetectionJob';

export async function CephMgmt_getCephLandmarkDetectionJob(
  ctx: ValidatedContext<never, never, CephMgmt_getCephLandmarkDetectionJobParams>
): Promise<Response> {
  return getCephLandmarkDetectionJob(ctx as BaseContext);
}
