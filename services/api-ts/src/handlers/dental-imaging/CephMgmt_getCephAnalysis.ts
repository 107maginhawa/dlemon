import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_getCephAnalysisParams } from '@/generated/openapi/validators';
import { getCephAnalysis } from './getCephAnalysis';

export async function CephMgmt_getCephAnalysis(
  ctx: ValidatedContext<never, never, CephMgmt_getCephAnalysisParams>
): Promise<Response> {
  return getCephAnalysis(ctx as BaseContext);
}
