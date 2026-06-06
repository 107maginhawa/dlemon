/**
 * build-contract-spine.ts — derive the cross-layer "contract spine" and enrich the
 * understand-anything knowledge graph with it.
 *
 * WHY: backend handlers are wired to routes by CODEGEN (TypeSpec @operationId →
 * generated registry/routes), not by source imports. The import-only knowledge
 * graph therefore can't see the vertical slice an agent actually adds when building
 * a feature: TypeSpec operation → route → handler → SDK hook → frontend consumer.
 * This script reconstructs that spine deterministically from the generated artifacts
 * and (a) writes a machine-readable contract-spine.json and (b) injects `operation`
 * nodes + `implements`/`consumed_by` edges into knowledge-graph.json so navigation
 * reflects the real wiring and wired handlers stop looking like orphans.
 *
 * Sources (all generated / authoritative — never hand-maintained):
 *   - specs/api/dist/openapi/openapi.json            operationId ⇄ method+path
 *   - services/api-ts/src/generated/openapi/registry.ts  operationId ⇄ handler file
 *   - packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts  operationId ⇄ SDK hook
 *   - apps/dentalemon/src/features/**                operationId ⇄ frontend consumers
 *
 * Run AFTER any `/understand` regeneration (it is a deterministic post-step, not part
 * of the LLM analysis pass). Idempotent: prunes prior `operation` nodes/edges first.
 *
 * Usage: bun run scripts/build-contract-spine.ts
 */
import { Glob } from 'bun';

const ROOT = new URL('..', import.meta.url).pathname;
const OPENAPI = `${ROOT}specs/api/dist/openapi/openapi.json`;
const REGISTRY = `${ROOT}services/api-ts/src/generated/openapi/registry.ts`;
const RQ = `${ROOT}packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts`;
const FEATURES_DIR = `${ROOT}apps/dentalemon/src/features`;
const GRAPH = `${ROOT}.understand-anything/knowledge-graph.json`;
const SPINE_OUT = `${ROOT}.understand-anything/contract-spine.json`;

interface SpineEntry {
  operationId: string;
  method: string;
  path: string;
  handler: string | null; // repo-relative handler file
  sdkHooks: string[]; // generated react-query export names
  consumers: string[]; // repo-relative frontend files that use the SDK hook(s)
}

// ── 1. operationId ⇄ method+path (OpenAPI is authoritative) ──────────────────
const openapi = await Bun.file(OPENAPI).json();
const ops = new Map<string, SpineEntry>();
for (const [path, methods] of Object.entries<Record<string, any>>(openapi.paths ?? {})) {
  for (const [method, op] of Object.entries<any>(methods)) {
    if (!op || typeof op !== 'object' || !op.operationId) continue;
    ops.set(op.operationId, {
      operationId: op.operationId,
      method: method.toUpperCase(),
      path,
      handler: null,
      sdkHooks: [],
      consumers: [],
    });
  }
}

// ── 2. operationId ⇄ handler file (generated registry imports) ───────────────
const registrySrc = await Bun.file(REGISTRY).text();
const importRe = /import\s+\{\s*(\w+)\s*\}\s+from\s+'(\.\.\/\.\.\/handlers\/[^']+)'/g;
let m: RegExpExecArray | null;
let handlerHits = 0;
while ((m = importRe.exec(registrySrc))) {
  const [, opId, rel] = m;
  const entry = ops.get(opId);
  if (!entry) continue; // registry import without an OpenAPI op (shouldn't happen)
  // rel is `../../handlers/...` relative to services/api-ts/src/generated/openapi/
  entry.handler = `services/api-ts/src/handlers/${rel.replace('../../handlers/', '')}.ts`;
  handlerHits++;
}

// ── 3. operationId ⇄ SDK hook names (generated react-query exports) ──────────
const rqSrc = await Bun.file(RQ).text();
const exportRe = /export const (\w+?)(Options|Mutation|QueryKey|InfiniteOptions) =/g;
const sdkByOp = new Map<string, Set<string>>();
while ((m = exportRe.exec(rqSrc))) {
  const base = m[1];
  const full = m[1] + m[2];
  if (!sdkByOp.has(base)) sdkByOp.set(base, new Set());
  sdkByOp.get(base)!.add(full);
}
// hey-api camelCases the operationId for SDK names: `CephMgmt_getCephAnalysis`
// → `cephMgmtGetCephAnalysis` (capitalize after each `_`, lowercase the first char).
const toSdkBase = (opId: string): string =>
  opId.replace(/_(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase());
for (const entry of ops.values()) {
  const hooks = sdkByOp.get(entry.operationId) ?? sdkByOp.get(toSdkBase(entry.operationId));
  if (hooks) entry.sdkHooks = [...hooks].sort();
}

// ── 4. operationId ⇄ frontend consumers (scan features for SDK hook usage) ───
const featureFiles: { rel: string; text: string }[] = [];
const glob = new Glob('**/*.{ts,tsx}');
for await (const f of glob.scan({ cwd: FEATURES_DIR, onlyFiles: true })) {
  if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
  const abs = `${FEATURES_DIR}/${f}`;
  featureFiles.push({ rel: `apps/dentalemon/src/features/${f}`, text: await Bun.file(abs).text() });
}
for (const entry of ops.values()) {
  if (entry.sdkHooks.length === 0) continue;
  for (const { rel, text } of featureFiles) {
    // A consumer references one of the generated hook names by identifier.
    if (entry.sdkHooks.some((h) => new RegExp(`\\b${h}\\b`).test(text))) {
      entry.consumers.push(rel);
    }
  }
  entry.consumers.sort();
}

// ── 5. write the machine-readable spine ──────────────────────────────────────
const spine = [...ops.values()].sort((a, b) => a.operationId.localeCompare(b.operationId));
const withHandler = spine.filter((s) => s.handler).length;
const withSdk = spine.filter((s) => s.sdkHooks.length).length;
const withConsumers = spine.filter((s) => s.consumers.length).length;
await Bun.write(
  SPINE_OUT,
  JSON.stringify(
    {
      version: 1,
      generatedFrom: ['openapi.json', 'registry.ts', 'react-query.gen.ts', 'features/**'],
      counts: { operations: spine.length, withHandler, withSdk, withConsumers },
      operations: spine,
    },
    null,
    2,
  ),
);

// ── 6. inject operation nodes + contract edges into the knowledge graph ───────
const graph = await Bun.file(GRAPH).json();
const fileNodeIds = new Set<string>(graph.nodes.map((n: any) => n.id));
// Prune any prior injection so this is idempotent.
graph.nodes = graph.nodes.filter((n: any) => n.type !== 'operation');
graph.edges = graph.edges.filter(
  (e: any) => e.type !== 'implements_operation' && e.type !== 'operation_consumed_by',
);

let implEdges = 0;
let consumerEdges = 0;
for (const s of spine) {
  const opNodeId = `op:${s.operationId}`;
  graph.nodes.push({
    id: opNodeId,
    type: 'operation',
    name: s.operationId,
    summary: `${s.method} ${s.path} — wired by codegen registry to its handler; consumed via SDK hook(s) ${s.sdkHooks.join(', ') || '(none)'}.`,
    tags: ['contract', 'operation', s.method.toLowerCase()],
    method: s.method,
    path: s.path,
    handler: s.handler,
    sdkHooks: s.sdkHooks,
  });
  // handler --implements_operation--> operation  (kills the "orphan handler" lie)
  const handlerId = s.handler ? `file:${s.handler}` : null;
  if (handlerId && fileNodeIds.has(handlerId)) {
    graph.edges.push({ source: handlerId, target: opNodeId, type: 'implements_operation', direction: 'forward', weight: 1 });
    implEdges++;
  }
  // operation --operation_consumed_by--> each frontend consumer (the contract spine)
  for (const c of s.consumers) {
    const cid = `file:${c}`;
    if (fileNodeIds.has(cid)) {
      graph.edges.push({ source: opNodeId, target: cid, type: 'operation_consumed_by', direction: 'forward', weight: 1 });
      consumerEdges++;
    }
  }
}
await Bun.write(GRAPH, JSON.stringify(graph));

console.log(
  `contract-spine: ${spine.length} ops | handler=${withHandler} sdk=${withSdk} consumers=${withConsumers}\n` +
    `graph injected: ${spine.length} operation nodes, ${implEdges} implements_operation, ${consumerEdges} operation_consumed_by edges`,
);
