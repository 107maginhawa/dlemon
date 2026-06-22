import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver, FieldValues } from 'react-hook-form'
import type { ZodType } from 'zod'

/**
 * Deterministic zod → react-hook-form resolver.
 *
 * ponytail: @hookform/resolvers@5 declares no zod peer, so `zodResolver`'s overload
 * set is resolved against whatever zod copy the install hoists. A transitive zod@3
 * (pulled by @better-auth/drizzle-adapter + @ai-sdk/*) coexists with the app's zod@4,
 * and depending on the install layout the resolver's expected `$ZodType` brand can
 * come from the v3 copy while the schema is v4 — a non-deterministic TS2769 that only
 * some CI installs hit (the address/contact forms, which also pass a ZodObject union).
 *
 * Bind the schema→resolver contract in ONE place: `schema as never` short-circuits the
 * fragile overload resolution and the return cast asserts the result type, so every
 * form typechecks regardless of which zod copy the resolver binds. Runtime is
 * unaffected — `zodResolver` works fine at runtime; only the *types* drift. The form's
 * data type `T` still flows from the call site (`useForm<T>` infers it), preserving
 * field-level type safety.
 *
 * Upgrade path: drop the cast and inline `zodResolver` once a single zod major is the
 * only copy in the dependency tree.
 */
export function formResolver<T extends FieldValues>(schema: ZodType): Resolver<T> {
  return zodResolver(schema as never) as unknown as Resolver<T>
}
