/**
 * oli-runtime-loop.spec.ts — the OLI runtime execution loop (data-driven).
 *
 * GENERATED ONCE by `/oli-check --runtime --live`, then committed. It reads the
 * CODE_* knowledge-graph maps + oli-runtime.config.ts at RUN TIME and derives a
 * target matrix (route × interactive element). Re-running `/oli-codebase-map`
 * grows coverage with NO regeneration of this file. Headless subprocess — zero
 * LLM tokens per run.
 *
 * It catches the runtime-UI class static analysis can't reach: handlers that
 * throw, data surfaces that 4xx/401 with no error UI (false-empty / infinite
 * skeleton), and dead navigation links.
 *
 * Regenerate ONLY when the contract version changes (new map fields to consume)
 * or assertion logic is upgraded in the template — guarded by `contractVersion`.
 */
import { test, expect, type Browser, type Page, type Frame } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { config } from "./oli-runtime.config";
import { authAdapter } from "./oli-runtime.auth";

// --------------------------------------------------------------------------
// Load maps
// --------------------------------------------------------------------------
const ROOT = process.cwd();
function loadMap(name: string): any {
  return JSON.parse(readFileSync(resolve(ROOT, config.mapsDir, name), "utf8"));
}
const routeMap = loadMap("CODE_ROUTE_MAP.json");
const registry = loadMap("CODE_COMPONENT_REGISTRY.json");

if (routeMap.version !== config.contractVersion) {
  console.warn(
    `[oli-runtime] contract version mismatch: maps=${routeMap.version} runner=${config.contractVersion}. ` +
      `Regenerate the runner if new map fields are needed.`,
  );
}

const IGNORE_URL = new RegExp(config.ignoreUrlSource, "i");
const LOADING_TEXT = config.loadingTextSource;

// --------------------------------------------------------------------------
// Route normalization: file-based route keys carry pathless layout segments
// (/^_/) and route groups (/^\(.*\)$/) that DON'T appear in the URL, plus
// $param / :param tokens. Build (a) navigable concrete paths and (b) matchers
// for "does this live href resolve to a known route".
// --------------------------------------------------------------------------
function cleanSegments(routeKey: string): string[] {
  return routeKey
    .split("/")
    .filter(Boolean)
    .filter((s) => !/^_/.test(s) && !/^\(.*\)$/.test(s));
}
function toNavPath(routeKey: string, params: Record<string, string>): string | null {
  const out: string[] = [];
  for (const seg of cleanSegments(routeKey)) {
    const m = seg.match(/^[$:](.+)$/);
    if (m) {
      const v = params[m[1]!]; // m[1] is the (.+) group — defined when m matched
      if (!v) return null; // required param with no fixture → unnavigable
      out.push(v);
    } else {
      out.push(seg);
    }
  }
  return "/" + out.join("/");
}
function routeMatchers(): RegExp[] {
  return Object.keys(routeMap.routes).map((k) => {
    const body = cleanSegments(k)
      .map((seg) => (/^[$:]/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    return new RegExp(`^/${body}/?$`);
  });
}
const MATCHERS = routeMatchers();
function hrefResolves(pathname: string): boolean {
  return MATCHERS.some((re) => re.test(pathname));
}

// --------------------------------------------------------------------------
// Build the target matrix
// --------------------------------------------------------------------------
type Target =
  | { kind: "page-load"; id: string; route: string; nav: string }
  | { kind: "nav-links"; id: string; route: string; nav: string }
  | { kind: "data-surface"; id: string; route: string; nav: string; opener: string; surface: string; label: string };

function buildMatrix(params: Record<string, string>): { targets: Target[]; skipped: string[] } {
  const targets: Target[] = [];
  const skipped: string[] = [];
  const deny = new Set(config.denyRoutes);

  for (const [routeKey, r] of Object.entries<any>(routeMap.routes)) {
    if (deny.has(routeKey)) continue;
    if (!r.page_component) continue;
    if (r.method && !["GET", "*"].includes(r.method)) continue;
    const nav = toNavPath(routeKey, params);
    if (!nav) {
      skipped.push(`page-load ${routeKey} (unresolved param)`);
      continue;
    }
    targets.push({ kind: "page-load", id: routeKey, route: routeKey, nav });
    if (config.navLinkCheck) targets.push({ kind: "nav-links", id: routeKey, route: routeKey, nav });
  }

  // data-surface bindings (config-pinned; the map's loading_state_hygiene set is
  // the candidate provenance, but routes_used_in/api_calls are not reliably
  // populated, so the route+opener binding lives in config).
  for (const ds of config.dataSurfaces) {
    const nav = toNavPath(ds.route, params);
    if (!nav) {
      skipped.push(`data-surface ${ds.label} (unresolved param on ${ds.route})`);
      continue;
    }
    targets.push({
      kind: "data-surface",
      id: `${ds.route}::${ds.label}`,
      route: ds.route,
      nav,
      opener: ds.openerTestid,
      surface: ds.surfaceTestid,
      label: ds.label,
    });
  }

  if (targets.length > config.maxTargets) {
    const rank = (t: Target) => (t.kind === "data-surface" ? 0 : t.kind === "page-load" ? 1 : 2);
    targets.sort((a, b) => rank(a) - rank(b));
    skipped.push(`capped at maxTargets=${config.maxTargets} (${targets.length - config.maxTargets} dropped)`);
    targets.length = config.maxTargets;
  }
  return { targets, skipped };
}

// --------------------------------------------------------------------------
// Findings sink
// --------------------------------------------------------------------------
type Severity = "P0" | "P1" | "P2" | "P3";
interface Finding {
  id: string;
  kind: string;
  route: string;
  severity: Severity;
  status: "pass" | "fail";
  detail: string;
}
const findings: Finding[] = [];

// Not all 4xx are equal: 401/403 (auth) and 5xx (server) are almost always real
// bugs → P1 (BLOCK). A bare 404 is often "resource not created yet" and handled
// gracefully by the UI → P2 (WARN), so we don't false-block on benign empties.
// A 400 (Bad Request) means the FRONTEND sent a malformed/invalid request —
// e.g. a required query param missing (`?branchId=` / `branchId=undefined`). That
// is always a client bug, not a benign empty, and it renders a hard error state.
// Treating 400 as P2 is exactly why this sweep passed while the calendar grid was
// 400-broken for every user; 400 is now P1-blocking (404 stays P2).
function classifyBad(bad: { url: string; status: number }[]): { sev: Severity; detail: string } | null {
  if (!bad.length) return null;
  const blocking = bad.some((b) => b.status >= 500 || b.status === 400 || b.status === 401 || b.status === 403);
  return { sev: blocking ? "P1" : "P2", detail: bad.map((b) => `${b.status} ${b.url}`).join(" | ") };
}
function record(t: Target, status: "pass" | "fail", severity: Severity, detail: string) {
  findings.push({ id: t.id, kind: t.kind, route: t.route, severity, status, detail });
}

// --------------------------------------------------------------------------
// Page listeners (own 4xx-inclusive network capture — do NOT inherit the app's
// >=500-only fixture listener, or 401s pass silently).
// --------------------------------------------------------------------------
function attach(page: Page) {
  const errors: string[] = [];
  const bad: { url: string; status: number }[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("crash", () => errors.push("page crashed"));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const txt = m.text();
    // HTTP failures are owned by the response listener (→ P1); don't double-count
    // a "Failed to load resource: 401" as a P0 JS error.
    if (/failed to load resource/i.test(txt)) return;
    if (!IGNORE_URL.test(txt)) errors.push(`console.error: ${txt.slice(0, 200)}`);
  });
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400 && !IGNORE_URL.test(r.url())) bad.push({ url: r.url(), status: s });
  });
  return { errors, bad };
}

async function skeletonCleared(scope: Page | Frame): Promise<boolean> {
  try {
    await scope.waitForFunction(
      ({ sel, rx }: { sel: string; rx: string }) => {
        const hasSkel = sel.trim() ? !!document.querySelector(sel) : false;
        const hasText = new RegExp(rx, "i").test(document.body.innerText);
        return !hasSkel && !hasText;
      },
      { sel: config.skeletonSelectors, rx: LOADING_TEXT },
      { timeout: config.skeletonCeilingMs, polling: 150 },
    );
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// Worker-scoped auth: sign in + seed ONCE per worker; reuse storageState +
// dynamic param fixtures across the whole matrix.
// --------------------------------------------------------------------------
const loop = test.extend<{}, { session: { storageState: any; params: Record<string, string> } }>({
  session: [
    async ({ browser }, use) => {
      const ctx = await browser.newContext({ baseURL: config.baseURL });
      const page = await ctx.newPage();
      const res = await authAdapter.setup(page);
      const storageState = await ctx.storageState();
      await ctx.close();
      await use({ storageState, params: { ...config.paramFixtures, ...(res.paramFixtures ?? {}) } });
    },
    { scope: "worker" },
  ],
});

async function freshPage(browser: Browser, storageState: any): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: config.baseURL, storageState });
  // surface unhandledrejection as a console error we capture
  await ctx.addInitScript(() => {
    window.addEventListener("unhandledrejection", (e: any) =>
      console.error(`[oli-unhandledrejection] ${e?.reason?.message ?? e?.reason}`),
    );
  });
  return ctx.newPage();
}

// --------------------------------------------------------------------------
// Emit results
// --------------------------------------------------------------------------
loop.afterAll(async () => {
  const out = resolve(ROOT, config.resultsOut);
  mkdirSync(dirname(out), { recursive: true });
  const summary = {
    generated_at_run: true,
    contract_version: routeMap.version,
    totals: {
      pass: findings.filter((f) => f.status === "pass").length,
      fail: findings.filter((f) => f.status === "fail").length,
      P0: findings.filter((f) => f.status === "fail" && f.severity === "P0").length,
      P1: findings.filter((f) => f.status === "fail" && f.severity === "P1").length,
      P2: findings.filter((f) => f.status === "fail" && f.severity === "P2").length,
      P3: findings.filter((f) => f.status === "fail" && f.severity === "P3").length,
    },
    findings,
  };
  writeFileSync(out, JSON.stringify(summary, null, 2));
});

// --------------------------------------------------------------------------
// Generate the tests. The matrix needs the dynamic params, so we build it
// lazily inside each test from the worker session (params known after auth).
// --------------------------------------------------------------------------
loop("oli-runtime-loop", async ({ browser, session }) => {
  test.setTimeout(300_000); // signup + full matrix walk; bounded waits, no sleeps
  const { targets, skipped } = buildMatrix(session.params);
  for (const s of skipped) record({ kind: "skip", id: s, route: "-" } as any, "fail", "P3", s);

  for (const t of targets) {
    const page = await freshPage(browser, session.storageState);
    const { errors, bad } = attach(page);
    try {
      if (t.kind === "page-load") {
        await page.goto(t.nav, { waitUntil: "domcontentloaded" });
        await skeletonCleared(page);
        // Wait for the route's async data fetches to settle before classifying —
        // skeletonCleared can resolve before a fast data query returns its 4xx, so
        // a page-load 400 (e.g. the calendar's missing-branchId grid query) would be
        // recorded "ok" and the response captured too late. Bounded + non-fatal so a
        // polling/websocket app can't hang the run.
        await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        const cb = classifyBad(bad);
        if (errors.length) record(t, "fail", "P0", `errors on load: ${errors.join(" | ")}`);
        else if (cb) record(t, "fail", cb.sev, `bad responses: ${cb.detail}`);
        else record(t, "pass", "P3", "ok");
      } else if (t.kind === "nav-links") {
        await page.goto(t.nav, { waitUntil: "domcontentloaded" });
        const links = await page.locator('a[href], [role="link"]').all();
        const dead: string[] = [];
        for (const l of links) {
          const href = (await l.getAttribute("href")) ?? "";
          if (!href.startsWith("/") || href.startsWith("//")) continue; // external/anchor — skip
          const pathname = href.split(/[?#]/)[0] ?? href;
          if (!hrefResolves(pathname)) dead.push(href);
        }
        if (errors.length) record(t, "fail", "P0", `errors rendering links: ${errors.join(" | ")}`);
        else if (dead.length) record(t, "fail", "P1", `dead nav links (no matching route): ${[...new Set(dead)].join(", ")}`);
        else record(t, "pass", "P3", "links resolve");
      } else if (t.kind === "data-surface") {
        await page.goto(t.nav, { waitUntil: "domcontentloaded" });
        const opener = page.getByTestId(t.opener);
        // SPA: the opener mounts after the route's data renders — wait before counting.
        await opener.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        if ((await opener.count()) === 0) {
          record(t, "fail", "P3", `opener testid '${t.opener}' not found — configure or add data-testid`);
        } else {
          // Attribute only what THIS interaction triggers: drop page-load noise
          // (unrelated async 4xx from other widgets on the route) before clicking.
          errors.length = 0;
          bad.length = 0;
          await opener.first().click();
          const surface = page.getByTestId(t.surface);
          await surface.first().waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
          await skeletonCleared(page);
          const opened = (await surface.count()) > 0;
          const cb = classifyBad(bad);
          if (errors.length) record(t, "fail", "P0", `${t.label}: errors on open: ${errors.join(" | ")}`);
          else if (cb) record(t, "fail", cb.sev, `${t.label}: surface request failed: ${cb.detail}`);
          else if (!opened) record(t, "fail", "P1", `${t.label}: opener clicked but surface '${t.surface}' never appeared`);
          else record(t, "pass", "P3", `${t.label}: opened, no error`);
        }
      }
    } catch (e: any) {
      record(t, "fail", "P1", `runner exception: ${e?.message ?? e}`);
    } finally {
      await page.context().close();
    }
  }

  // Single assertion: no blocking (P0/P1) runtime findings.
  const blocking = findings.filter((f) => f.status === "fail" && (f.severity === "P0" || f.severity === "P1"));
  expect(blocking, blocking.map((f) => `[${f.severity}] ${f.kind} ${f.route}: ${f.detail}`).join("\n")).toEqual([]);
});
