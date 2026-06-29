/**
 * Production attack-surface guard (task #37, reachability audit 2026-06-28).
 *
 * These base-template endpoints are live + authenticated but UNREACHABLE from the
 * dentalemon product — the FE implements every flow on `dental-*` endpoints. They
 * are 404'd in PRODUCTION ONLY, left live in dev/test so the upstream
 * `apps/account` reference app and the contract/unit suites keep working.
 *
 * This gates the HTTP route only — handler functions and repos are untouched, so
 * any server-side cross-module use is unaffected.
 *
 * To RE-ENABLE an endpoint in production: delete its line below. Nothing else
 * changes (no regen, no schema change). Verified product-used and therefore
 * intentionally NOT here: all `/storage/*` (imaging multipart uploads/downloads)
 * and all `/billing/*` (Stripe/payments — deferred, revisit when payments ship).
 *
 * Entries are "METHOD /path"; `:param` segments match any single path segment.
 */
import type { Hono } from 'hono';
import type { Variables } from '@/types/app';
import { NotFoundError } from '@/core/errors';

export const PROD_DISABLED_ROUTES: readonly string[] = [
  // audit — no FE log viewer; audit writes are internal and unaffected
  'GET /audit/logs',
  // booking (base) — product uses dental-scheduling /dental/public/* instead
  'POST /booking/bookings',
  'GET /booking/bookings',
  'GET /booking/bookings/:booking',
  'POST /booking/bookings/:booking/cancel',
  'POST /booking/bookings/:booking/confirm',
  'POST /booking/bookings/:booking/no-show',
  'POST /booking/bookings/:booking/reject',
  'POST /booking/events',
  'GET /booking/events',
  'GET /booking/events/:event',
  'PATCH /booking/events/:event',
  'DELETE /booking/events/:event',
  'POST /booking/events/:event/exceptions',
  'GET /booking/events/:event/exceptions',
  'GET /booking/events/:event/exceptions/:exception',
  'DELETE /booking/events/:event/exceptions/:exception',
  'GET /booking/events/:event/slots',
  'GET /booking/slots/:slotId',
  // comms (base) — chat rooms + WebRTC video; no FE surface
  'POST /comms/chat-rooms',
  'GET /comms/chat-rooms',
  'GET /comms/chat-rooms/:room',
  'GET /comms/chat-rooms/:room/messages',
  'POST /comms/chat-rooms/:room/messages',
  'POST /comms/chat-rooms/:room/video-call/end',
  'POST /comms/chat-rooms/:room/video-call/join',
  'POST /comms/chat-rooms/:room/video-call/leave',
  'PATCH /comms/chat-rooms/:room/video-call/participant',
  'GET /comms/ice-servers',
  // email (base) — template + queue admin; product uses notifs
  'GET /email/queue',
  'GET /email/queue/:queue',
  'POST /email/queue/:queue/cancel',
  'POST /email/queue/:queue/retry',
  'POST /email/templates',
  'GET /email/templates',
  'GET /email/templates/:template',
  'PATCH /email/templates/:template',
  'POST /email/templates/:template/test',
  // emr (base) — consultations; product uses dental clinical/case-presentation
  'POST /emr/consultations',
  'GET /emr/consultations',
  'GET /emr/consultations/:consultation',
  'PATCH /emr/consultations/:consultation',
  'POST /emr/consultations/:consultation/finalize',
  'GET /emr/patients',
  // patients (base) — parallel PII model; product uses dental-patient
  'POST /patients',
  'GET /patients',
  'GET /patients/:id',
  'PATCH /patients/:id',
  'DELETE /patients/:id',
  'POST /patients/merge',
  'POST /patients/unmerge',
  // persons (base) — createPerson (onboarding) + getPerson (profile) ARE used → kept
  'GET /persons',
  'PATCH /persons/:person',
  // providers (base) — practitioners + roles; product uses dental-org members
  'POST /providers',
  'POST /providers/practitioner-roles',
  'GET /providers/practitioner-roles',
  'GET /providers/practitioner-roles/:id',
  'PATCH /providers/practitioner-roles/:id',
  'DELETE /providers/practitioner-roles/:id',
  'POST /providers/practitioners',
  'GET /providers/practitioners',
  'GET /providers/practitioners/:id',
  'PATCH /providers/practitioners/:id',
  'DELETE /providers/practitioners/:id',
  // reviews (base NPS) — no FE surface
  'POST /reviews/',
  'GET /reviews/',
  'GET /reviews/:review',
  'DELETE /reviews/:review',
];

function toMatcher(entry: string): { method: string; re: RegExp } {
  const sep = entry.indexOf(' ');
  const method = entry.slice(0, sep);
  const path = entry.slice(sep + 1);
  // :param → one non-empty, non-slash segment; anchored so longer paths don't match.
  const re = new RegExp('^' + path.replace(/:[^/]+/g, '[^/]+') + '$');
  return { method, re };
}

/**
 * Mount the production-only route guard. No-op outside production.
 * Must be registered BEFORE the generated routes so it wraps them.
 */
export function mountProdDisabledRoutes(
  app: Hono<{ Variables: Variables }>,
  isProduction: boolean,
): void {
  if (!isProduction) return;
  const matchers = PROD_DISABLED_ROUTES.map(toMatcher);
  app.use('*', async (c, next) => {
    const method = c.req.method.toUpperCase();
    const path = c.req.path;
    if (matchers.some((m) => m.method === method && m.re.test(path))) {
      // Throw the canonical NotFoundError so the global error handler formats it
      // identically to any other unmatched route.
      throw new NotFoundError('Route not found', { resourceType: 'route', resource: path });
    }
    return next();
  });
}
