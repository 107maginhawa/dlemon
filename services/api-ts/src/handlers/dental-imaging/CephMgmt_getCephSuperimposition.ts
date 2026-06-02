import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_getCephSuperimpositionParams } from '@/generated/openapi/validators';
import { getCephSuperimposition } from './cephSuperimposition';

export async function CephMgmt_getCephSuperimposition(
  ctx: ValidatedContext<never, never, CephMgmt_getCephSuperimpositionParams>
): Promise<Response> {
  return getCephSuperimposition(ctx as BaseContext);
}
