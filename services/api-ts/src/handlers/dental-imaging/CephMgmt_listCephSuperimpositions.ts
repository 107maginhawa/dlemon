import type { ValidatedContext, BaseContext } from '@/types/app';
import type { CephMgmt_listCephSuperimpositionsParams } from '@/generated/openapi/validators';
import { listCephSuperimpositions } from './cephSuperimposition';

export async function CephMgmt_listCephSuperimpositions(
  ctx: ValidatedContext<never, never, CephMgmt_listCephSuperimpositionsParams>
): Promise<Response> {
  return listCephSuperimpositions(ctx as BaseContext);
}
