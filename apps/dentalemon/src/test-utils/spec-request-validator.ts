/**
 * Spec-driven request-shape conformance (VERIFICATION_HARDENING.md P6).
 *
 * A TEST-ONLY SDK request interceptor that grades an outgoing request BODY against
 * the OpenAPI contract (`@monobase/api-spec/openapi.json`) with ajv, and throws on
 * mismatch. It moves the "is the request shaped right?" check off hand-authored
 * mocks (which encode the implementer's assumptions) onto the spec — catching the
 * common adjacent drift family: a renamed / missing required field, a wrong type, or
 * an invalid enum, at the cheap unit layer.
 *
 * OPT-IN by design. `installSpecRequestValidator(client)` registers an ENFORCING
 * interceptor on the client it is given and returns an `uninstall()`; a test brackets
 * it (install in beforeAll, uninstall in afterAll) so enforcement is scoped to that
 * test. It is NOT installed globally: the existing unit-test corpus sends
 * intentionally-partial request bodies (one field under test) that a spec validator
 * would correctly-but-unhelpfully reject, so blanket enforcement would fail tests
 * that are not about request shape. New request-shape tests opt in.
 *
 * Scope (be honest — do NOT over-credit, per the plan):
 *   - REQUEST half only, and only operations whose body is `application/json`.
 *     Multipart/upload and bodyless GET/DELETE are skipped.
 *   - OpenAPI 3.0 usually leaves `additionalProperties` unset, so an EXTRA field is
 *     allowed; a renamed OPTIONAL field is not caught. A renamed REQUIRED field IS
 *     caught (its canonical name goes missing). Wrong enum / wrong scalar type caught.
 *   - It would NOT have caught the New-Visit incident on its own (both calls' shapes
 *     are valid); it prevents the family next door.
 *
 * Graceful degradation: the OpenAPI doc is a gitignored build artifact. If it cannot
 * be loaded, installs are no-ops and `isSpecRequestValidatorActive()` is false, so the
 * proving test skips and the corpus is unaffected.
 */
import Ajv, { type ValidateFunction } from 'ajv'
import { createRequire } from 'node:module'

type AnyRecord = Record<string, unknown>

interface OpenApiDoc {
  paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: unknown }> } }>>
  components?: unknown
}

/** Load the OpenAPI doc once, or null when the build artifact is absent. */
let specCache: OpenApiDoc | null | undefined
function getSpec(): OpenApiDoc | null {
  if (specCache === undefined) {
    try {
      const require = createRequire(import.meta.url)
      specCache = require('@monobase/api-spec/openapi.json') as OpenApiDoc
    } catch {
      specCache = null
    }
  }
  return specCache
}

/** True when the OpenAPI doc is loadable (so enforcement can run). */
export function isSpecRequestValidatorActive(): boolean {
  return getSpec() != null
}

/** Convert OpenAPI 3.0 `nullable: true` into Draft-07 nullability (deep copy). */
function deNullable(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(deNullable)
  if (node && typeof node === 'object') {
    const src = node as AnyRecord
    const out: AnyRecord = {}
    for (const [k, v] of Object.entries(src)) out[k] = deNullable(v)
    if (out.nullable === true) {
      delete out.nullable
      if (typeof out.type === 'string') {
        out.type = [out.type, 'null']
      } else if (Array.isArray(out.type) && !out.type.includes('null')) {
        out.type = [...out.type, 'null']
      } else if (typeof out.$ref === 'string') {
        const ref = out.$ref
        delete out.$ref
        return { anyOf: [{ $ref: ref }, { type: 'null' }] }
      } else if (Array.isArray(out.enum) && !out.enum.includes(null)) {
        out.enum = [...out.enum, null]
      }
    }
    return out
  }
  return node
}

function templateToRegExp(template: string): RegExp {
  const parts = template.split('/').map((seg) =>
    /^\{.+\}$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  )
  return new RegExp(`^${parts.join('/')}$`)
}

function toJsonPointer(template: string): string {
  return template.replace(/~/g, '~0').replace(/\//g, '~1')
}

let warned = false
function warnOnce(message: string): void {
  if (warned) return
  warned = true
  // eslint-disable-next-line no-console
  console.warn(`[spec-request-validator] ${message}`)
}

// Built once, reused across installs.
interface Engine {
  ajv: Ajv
  matchers: Array<{ template: string; re: RegExp }>
  cache: Map<string, ValidateFunction | null>
  paths: OpenApiDoc['paths']
}
let engineCache: Engine | null | undefined
function getEngine(): Engine | null {
  if (engineCache !== undefined) return engineCache
  const openapi = getSpec()
  if (!openapi || !openapi.paths) {
    engineCache = null
    return null
  }
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false })
  ajv.addSchema(deNullable(openapi) as object, 'openapi.json')
  engineCache = {
    ajv,
    matchers: Object.keys(openapi.paths).map((template) => ({ template, re: templateToRegExp(template) })),
    cache: new Map(),
    paths: openapi.paths,
  }
  return engineCache
}

function validatorFor(engine: Engine, template: string, method: string): ValidateFunction | null {
  const key = `${method} ${template}`
  if (engine.cache.has(key)) return engine.cache.get(key) ?? null
  const op = engine.paths[template]?.[method]
  const hasJsonBody = !!op?.requestBody?.content?.['application/json']?.schema
  let compiled: ValidateFunction | null = null
  if (hasJsonBody) {
    const ref = `openapi.json#/paths/${toJsonPointer(template)}/${method}/requestBody/content/${toJsonPointer('application/json')}/schema`
    try {
      compiled = engine.ajv.compile({ $ref: ref })
    } catch {
      compiled = null
    }
  }
  engine.cache.set(key, compiled)
  return compiled
}

interface RequestLike {
  url: string
  method?: string
}
interface OptsLike {
  url?: string
  method?: string
  body?: unknown
}
interface ClientLike {
  interceptors: {
    request: {
      use: (fn: (request: RequestLike, opts: OptsLike) => RequestLike) => number | unknown
      eject: (id: number | unknown) => void
    }
  }
}

/**
 * Grade a request body against the OpenAPI contract for a given operation. Pure and
 * side-effect-free — the unit-testable core. Returns `{ ok: true }` (never fails) when
 * the spec is absent or the operation has no JSON request body, so it cannot produce
 * false negatives in environments without the built spec.
 */
export function validateRequestBody(
  method: string,
  pathTemplate: string,
  body: unknown,
): { ok: boolean; errors: string } {
  const engine = getEngine()
  if (!engine) return { ok: true, errors: '' }
  const validate = validatorFor(engine, pathTemplate, method.toLowerCase())
  if (!validate) return { ok: true, errors: '' }
  const ok = validate(body) as boolean
  return { ok, errors: ok ? '' : engine.ajv.errorsText(validate.errors, { dataVar: 'body' }) }
}

export interface SpecValidatorHandle {
  /** True when the interceptor is enforcing (spec was loadable). */
  active: boolean
  /** Remove the interceptor — call in afterAll so enforcement does not leak. */
  uninstall: () => void
}

/**
 * Install the spec request-body validator on `client` and return a handle whose
 * `uninstall()` removes it. Enforcement is active immediately for that client.
 */
export function installSpecRequestValidator(client: ClientLike): SpecValidatorHandle {
  const engine = getEngine()
  if (!engine) {
    warnOnce('OpenAPI doc not loadable (build: `cd specs/api && bun run build`); request-shape validation is OFF.')
    return { active: false, uninstall: () => {} }
  }

  const id = client.interceptors.request.use((request: RequestLike, opts: OptsLike) => {
    const method = String(opts?.method ?? request.method ?? 'GET').toLowerCase()
    if (method === 'get' || method === 'head' || method === 'delete') return request

    const body = opts?.body
    const isPlainObject =
      body != null && typeof body === 'object' && !Array.isArray(body) &&
      !(typeof FormData !== 'undefined' && body instanceof FormData) &&
      !(typeof Blob !== 'undefined' && body instanceof Blob)
    if (!isPlainObject) return request

    let template: string | undefined = opts?.url && engine.paths[opts.url] ? opts.url : undefined
    if (!template) {
      let pathname = ''
      try {
        pathname = new URL(request.url).pathname
      } catch {
        pathname = (request.url || '').split('?')[0] ?? ''
      }
      template = engine.matchers.find((m) => m.re.test(pathname))?.template
    }
    if (!template) return request

    const { ok, errors } = validateRequestBody(method, template, body)
    if (!ok) {
      throw new Error(
        `[spec-request-validator] ${method.toUpperCase()} ${template} request body violates the OpenAPI contract: ${errors}`,
      )
    }
    return request
  })

  return { active: true, uninstall: () => client.interceptors.request.eject(id) }
}
