/**
 * fe-route-matrix.test.ts — TDD for the frontend route reachability matrix.
 *
 * Run from repo root:  bun test ./scripts/coverage/fe-route-matrix.test.ts
 * (the leading ./ is required for Bun path filters). These are root-level tests:
 * they do NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 *
 * The matrix answers, per frontend route: "does any e2e/journey spec navigate to
 * it?" — a REACHABILITY PROXY (a route exercised by some spec), not a full
 * render-smoke. The pure pieces under test here are:
 *   (a) parseRouteTree     — routeTree.gen.ts → canonical { routePath, file } list
 *   (b) navigationTokens   — a route → the literal tokens a spec would use to nav
 *   (c) build              — joins (a)+(b) against the real test corpora
 */

import { describe, expect, test } from 'bun:test';
import {
  parseRouteTree,
  navigationTokens,
  buildRouteMatrix,
} from './fe-route-matrix';

// ─────────────────────────────────────────────────────────────────────────────
// (a) routeTree.gen.ts parser
// ─────────────────────────────────────────────────────────────────────────────

describe('parseRouteTree', () => {
  // A faithful (trimmed) slice of the generated FileRoutesByPath module blocks,
  // which carry both the `id` (→ file) and `fullPath` (→ routePath) for a route.
  const fixture = `
declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_workspace': {
      id: '/_workspace'
      path: ''
      fullPath: '/'
      preLoaderRoute: typeof WorkspaceRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_dashboard/calendar': {
      id: '/_dashboard/calendar'
      path: '/calendar'
      fullPath: '/calendar'
      preLoaderRoute: typeof DashboardCalendarRouteImport
      parentRoute: typeof DashboardRoute
    }
    '/book/$branchId': {
      id: '/book/$branchId'
      path: '/book/$branchId'
      fullPath: '/book/$branchId'
      preLoaderRoute: typeof BookBranchIdRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_workspace/$patientId': {
      id: '/_workspace/$patientId'
      path: '/$patientId'
      fullPath: '/$patientId'
      preLoaderRoute: typeof WorkspacePatientIdRouteImport
      parentRoute: typeof WorkspaceRoute
    }
    '/_portal/portal/': {
      id: '/_portal/portal/'
      path: '/portal'
      fullPath: '/portal/'
      preLoaderRoute: typeof PortalPortalIndexRouteImport
      parentRoute: typeof PortalRoute
    }
  }
}
`;

  test('enumerates navigable routes with a stable routePath + source file', () => {
    const routes = parseRouteTree(fixture);
    const byPath = new Map(routes.map((r) => [r.routePath, r]));

    expect(byPath.get('/')?.file).toBe('apps/dentalemon/src/routes/index.tsx');
    expect(byPath.get('/calendar')?.file).toBe(
      'apps/dentalemon/src/routes/_dashboard/calendar.tsx',
    );
    expect(byPath.get('/book/$branchId')?.file).toBe(
      'apps/dentalemon/src/routes/book.$branchId.tsx',
    );
    expect(byPath.get('/$patientId')?.file).toBe(
      'apps/dentalemon/src/routes/_workspace/$patientId.tsx',
    );
  });

  test('normalises the portal index fullPath ("/portal/") to "/portal"', () => {
    const routes = parseRouteTree(fixture);
    const paths = routes.map((r) => r.routePath);
    expect(paths).toContain('/portal');
    expect(paths).not.toContain('/portal/');
  });

  test('drops pathless layout routes (path: "") — they are not destinations', () => {
    const routes = parseRouteTree(fixture);
    const ids = routes.map((r) => r.id);
    // _workspace is a pathless layout (path: '', fullPath collides with '/').
    expect(ids).not.toContain('/_workspace');
    // The real index route '/' survives.
    expect(routes.some((r) => r.routePath === '/')).toBe(true);
  });

  test('routePaths are unique and sorted', () => {
    const routes = parseRouteTree(fixture);
    const paths = routes.map((r) => r.routePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect([...paths].sort()).toEqual(paths);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) navigation tokens (the heuristic's search literals)
// ─────────────────────────────────────────────────────────────────────────────

describe('navigationTokens', () => {
  test('a static route searches for its exact path', () => {
    expect(navigationTokens('/calendar')).toEqual(['/calendar']);
  });

  test('a param route searches for the static prefix before the first param', () => {
    expect(navigationTokens('/book/$branchId')).toContain('/book/');
    expect(navigationTokens('/imaging-ceph-report/$imageId')).toContain(
      '/imaging-ceph-report/',
    );
    expect(navigationTokens('/patients/$patientId')).toContain('/patients/');
  });

  test('the index route "/" never degenerates to a match-everything token', () => {
    // "/" is everywhere; matching the bare slash would call every route exercised.
    expect(navigationTokens('/')).toEqual(['/']);
    // and the token list must not include the empty string.
    expect(navigationTokens('/')).not.toContain('');
  });

  test('a param-FIRST route also emits the discriminating placeholder token', () => {
    // The static prefix of "/$patientId" collapses to "/" (too loose), so the
    // route must additionally be searchable by its param placeholder + JS interp.
    const tokens = navigationTokens('/$patientId');
    expect(tokens).toContain('$patientId');
    expect(tokens).toContain('${patientId}');
    // It must NOT rely on the bare "/" (which would match everything).
    expect(tokens).not.toContain('/');
  });

  test('a nested param route emits its leading static segment', () => {
    const tokens = navigationTokens('/$patientId/case-presentation/$presentationId');
    // The first non-param static segment is "case-presentation".
    expect(tokens.some((t) => t.includes('case-presentation'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) end-to-end build against the real route tree + corpora
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRouteMatrix (real route tree + e2e/journey corpora)', () => {
  const rows = buildRouteMatrix();

  test('produces a non-empty row set with the documented shape', () => {
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) {
      expect(typeof r.routePath).toBe('string');
      expect(r.routePath.startsWith('/')).toBe(true);
      expect(r.file).toMatch(/^apps\/dentalemon\/src\/routes\//);
      expect(typeof r.exercisedByE2E).toBe('boolean');
    }
  });

  test('rows are unique by routePath and sorted', () => {
    const paths = rows.map((r) => r.routePath);
    expect(new Set(paths).size).toBe(paths.length);
    expect([...paths].sort()).toEqual(paths);
  });

  test('heavily-exercised core routes are marked exercised', () => {
    const byPath = new Map(rows.map((r) => [r.routePath, r]));
    expect(byPath.get('/calendar')?.exercisedByE2E).toBe(true);
    expect(byPath.get('/patients')?.exercisedByE2E).toBe(true);
    expect(byPath.get('/billing')?.exercisedByE2E).toBe(true);
  });

  test('the patient portal (never navigated by any spec) is a reachability gap', () => {
    const byPath = new Map(rows.map((r) => [r.routePath, r]));
    // /portal, /portal/bills, /portal/appointments are not touched by any spec.
    expect(byPath.get('/portal/bills')?.exercisedByE2E).toBe(false);
  });
});
