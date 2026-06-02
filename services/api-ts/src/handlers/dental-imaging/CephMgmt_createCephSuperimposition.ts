import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_createCephSuperimpositionBody } from '@/generated/openapi/validators';
import { createCephSuperimposition } from './cephSuperimposition';

export async function CephMgmt_createCephSuperimposition(
  ctx: ValidatedContext<CephMgmt_createCephSuperimpositionBody, never, never>
): Promise<Response> {
  return createCephSuperimposition(ctx as BaseContext);
}
