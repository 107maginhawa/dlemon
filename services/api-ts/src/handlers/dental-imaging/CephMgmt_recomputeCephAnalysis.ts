import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_recomputeCephAnalysisParams } from '@/generated/openapi/validators';
import { recomputeCephAnalysis } from './recomputeCephAnalysis';

export async function CephMgmt_recomputeCephAnalysis(
  ctx: ValidatedContext<never, never, CephMgmt_recomputeCephAnalysisParams>
): Promise<Response> {
  return recomputeCephAnalysis(ctx as BaseContext);
}
