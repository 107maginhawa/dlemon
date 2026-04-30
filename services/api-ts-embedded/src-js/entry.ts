/**
 * Embedded entry point for api-ts running inside the QuickJS engine.
 *
 * Imports `createApp` from @monobase/api-ts and initializes it with a
 * sqlite-proxy Drizzle instance bridged to the host's native SQLite via
 * QuickJS globals (`__db.execute` / `__db.select`). External services
 * (S3, email, push, billing) are stubbed — offline-first does not need
 * cloud egress.
 */
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { createApp } from "@monobase/api-ts/app";
import type { Config } from "@monobase/api-ts/core/config";

// ── Globals from QuickJS host ───────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __db = (globalThis as any).__db;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const __bcrypt = (globalThis as any).__bcrypt;

// ── Global error handlers ────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).addEventListener === "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).addEventListener("unhandledrejection", (event: any) => {
    console.error("[UNHANDLED_REJECTION]", event?.reason?.message || event?.reason || event);
    if (event?.reason?.stack) console.error("[UNHANDLED_REJECTION] Stack:", event.reason.stack);
  });
}

// ── Create Drizzle sqlite-proxy instance ────────────────────────────
// CRITICAL: Return plain objects, not Promises!
// Drizzle sqlite-proxy internally wraps the result in a Promise. Returning
// a Promise here yields nested Promises that QuickJS can't handle.
const db = drizzle(
  ((sql: string, params: unknown[], method: string) => {
    try {
      if (method === "run") {
        __db.execute(sql, params);
        return { rows: [] as unknown[][] };
      }
      const rows = __db.select(sql, params) as unknown[][];
      return { rows };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error("[DB] Error:", e?.message || String(e));
      throw e;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
);

// ── Build embedded config ──────────────────────────────────────────
// Mirrors services/api-ts/src/boa-entry.ts but injects the pre-built Drizzle
// instance via `database.instance` (added in the Phase C refactor).
const config: Config = {
  server: {
    host: "localhost",
    port: 0, // Not used in embedded mode
  },
  database: {
    url: "sqlite://:embedded:",
    logging: false,
    // Pre-built sqlite-proxy Drizzle instance — createApp short-circuits
    // and uses this directly instead of calling createDatabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instance: db as any,
  },
  cors: {
    origins: ["*"],
    credentials: true,
    allowLocalNetwork: true,
    allowTunneling: false,
    strict: false,
  },
  logging: {
    level: "info",
    pretty: false,
  },
  auth: {
    baseUrl: "http://localhost",
    secret: "embedded-secret-change-in-production",
    sessionExpiresIn: 60 * 60 * 24 * 7,
    rateLimitEnabled: false,
    rateLimitWindow: 60,
    rateLimitMax: 100,
    adminEmails: [],
    socialProviders: {},
    // Use native bcrypt bindings provided by the QuickJS host
    password: {
      hash: async (password: string) => __bcrypt.hash(password),
      verify: async ({ hash, password }: { hash: string; password: string }) =>
        __bcrypt.verify(password, hash),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  rateLimit: {
    enabled: false,
    max: 1000,
  },
  storage: {
    provider: "minio",
    endpoint: "",
    publicEndpoint: "",
    bucket: "local",
    region: "us-east-1",
    credentials: { accessKeyId: "", secretAccessKey: "" },
    uploadUrlExpiry: 300,
    downloadUrlExpiry: 900,
  },
  email: {
    provider: "smtp",
    from: { name: "Monobase Account", email: "noreply@localhost" },
    smtp: {
      host: "localhost",
      port: 1025,
      secure: false,
      auth: { user: "", pass: "" },
    },
  },
  notifs: {
    provider: "onesignal",
  },
  billing: {
    provider: "stripe",
    stripe: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webrtc: {
    iceServers: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
};

// ── Create and initialize the api-ts app ────────────────────────────
// Wrapped in async IIFE — esbuild es2017 target doesn't support top-level await.
(async () => {
  try {
    const app = createApp(config);

    // ── Expose to QuickJS host ──────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__dispatch = function (
      method: string,
      url: string,
      body: string | null,
      headersJson: string,
    ) {
      // Step 1: Parse headers synchronously
      let headers: Record<string, string>;
      try {
        headers = headersJson ? JSON.parse(headersJson) : {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.error("[Dispatch] Failed to parse headers:", e?.message);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__res = JSON.stringify({
          s: 500,
          b: JSON.stringify({ error: "Failed to parse headers" }),
          h: {},
        });
        return;
      }

      // Step 2: Create Request synchronously
      const req = new Request(url, { method, headers, body });

      // Step 3: Call fetch and chain with explicit .then()
      Promise.resolve()
        .then(() => app.fetch(req))
        .then((res: Response) => res.text().then((txt: string) => ({ res, txt })))
        .then(({ res, txt }: { res: Response; txt: string }) => {
          const hdrs: Record<string, string> = {};
          if (res.headers && res.headers.forEach) {
            res.headers.forEach((v: string, k: string) => {
              hdrs[k] = v;
            });
          }
          if (res.status >= 400) {
            console.error("[Dispatch] Error response:", res.status, txt);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).__res = JSON.stringify({
            s: res.status,
            b: txt,
            h: hdrs,
          });
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((e: any) => {
          console.error("[Dispatch] Error:", e?.message || String(e));
          if (e?.stack) console.error("[Dispatch] Stack:", e.stack);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).__res = JSON.stringify({
            s: 500,
            b: JSON.stringify({ error: e?.message || "Dispatch error" }),
            h: {},
          });
        });
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.error("[Embedded] Failed to initialize api-ts:", e?.message || String(e));
    if (e?.stack) console.error("[Embedded] Stack:", e.stack);
  }
})();
