import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_createCephReportParams } from '@/generated/openapi/validators';
import { createCephReport } from './createCephReport';

export async function CephMgmt_createCephReport(
  ctx: ValidatedContext<never, never, CephMgmt_createCephReportParams>
): Promise<Response> {
  return createCephReport(ctx as BaseContext);
}
