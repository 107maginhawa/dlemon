import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_getCephReportQuery, CephMgmt_getCephReportParams } from '@/generated/openapi/validators';
import { getCephReport } from './getCephReport';

export async function CephMgmt_getCephReport(
  ctx: ValidatedContext<never, CephMgmt_getCephReportQuery, CephMgmt_getCephReportParams>
): Promise<Response> {
  return getCephReport(ctx as BaseContext);
}
