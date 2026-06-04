import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_previewCephSuperimpositionBody } from '@/generated/openapi/validators';
import { previewCephSuperimposition } from './cephSuperimposition';

export async function CephMgmt_previewCephSuperimposition(
  ctx: ValidatedContext<CephMgmt_previewCephSuperimpositionBody, never, never>
): Promise<Response> {
  return previewCephSuperimposition(ctx as BaseContext);
}
