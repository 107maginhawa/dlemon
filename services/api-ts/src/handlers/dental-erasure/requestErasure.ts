/**
 * Codegen entrypoint for operationId `requestErasure`.
 * The generated registry imports handlers by `<operationId>.ts` exporting
 * `<operationId>`; this re-exports the implementation handler (named
 * `requestErasureHandler` to avoid colliding with the `requestErasure`
 * service function in erasure-service.ts).
 */
export { requestErasureHandler as requestErasure } from './requestErasureHandler';
