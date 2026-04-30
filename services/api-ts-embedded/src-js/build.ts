/**
 * Bundle api-ts for the embedded QuickJS engine.
 *
 * Uses explicit shims for all packages that don't work in QuickJS.
 * No magic plugins - everything is aliased explicitly.
 *
 * Usage:
 *   bun run src-js/build.ts              # minified production bundle
 *   bun run src-js/build.ts --no-minify  # unminified for debugging
 *
 * Output: dist/bundle.js + dist/bundle.js.gz
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { build, Plugin } from "esbuild";
import { gzipSync } from "zlib";

// @ts-expect-error unenv CJS
import { env, nodeless } from "unenv";

const noMinify = process.argv.includes("--no-minify");
const root = dirname(dirname(resolve(import.meta.filename)));
const outDir = resolve(root, "dist");
const shims = resolve(root, "src-js/shims");

mkdirSync(outDir, { recursive: true });

// 1. Read the Web API shim (plain JS, runs first in QuickJS)
const shimCode = readFileSync(resolve(root, "src-js/web-api-shim.js"), "utf-8");

// 2. Start with unenv aliases for Node.js built-ins (fs, path, crypto, os, etc.)
const unenvConfig = env(nodeless);
const alias: Record<string, string> = {};
for (const [key, value] of Object.entries(unenvConfig.alias)) {
  alias[key] = value as string;
}

// 3. Override with explicit shims for things that need special handling
// (unenv exports objects instead of classes for some modules)
Object.assign(alias, {
  // ─── Node.js built-ins (override unenv where needed) ─────────────────────
  // events: unenv exports {EventEmitter, once} but libs expect `class extends events`
  'events': resolve(shims, 'node/events.ts'),
  'node:events': resolve(shims, 'node/events.ts'),
  // stream: use our own with proper prototype chains
  'stream': resolve(shims, 'node/stream.ts'),
  'node:stream': resolve(shims, 'node/stream.ts'),
  // buffer: use globalThis.Buffer from web-api-shim
  'buffer': resolve(shims, 'node/buffer.ts'),
  'node:buffer': resolve(shims, 'node/buffer.ts'),
  // process: our minimal shim
  'process': resolve(shims, 'node/process.ts'),
  'node:process': resolve(shims, 'node/process.ts'),
  // util: need proper inherits()
  'util': resolve(shims, 'node/util.ts'),
  'node:util': resolve(shims, 'node/util.ts'),
  // crypto: need randomFillSync for nanoid
  'crypto': resolve(shims, 'node/crypto.ts'),
  'node:crypto': resolve(shims, 'node/crypto.ts'),

  // ─── npm packages ────────────────────────────────────────────────────────
  'readable-stream': resolve(shims, 'npm/readable-stream.ts'),
  'readable-stream/passthrough': resolve(shims, 'npm/readable-stream-passthrough.ts'),
  'readable-stream/transform': resolve(shims, 'npm/readable-stream-transform.ts'),
  'pino': resolve(shims, 'npm/pino.ts'),
  'pg': resolve(shims, 'npm/pg.ts'),
  'nodemailer': resolve(shims, 'npm/nodemailer.ts'),
  'pg-boss': resolve(shims, 'npm/pg-boss.ts'),
  'through2': resolve(shims, 'npm/through2.ts'),
  'bun:sqlite': resolve(shims, 'npm/bun-sqlite.ts'),
  'from2': resolve(shims, 'npm/from2.ts'),
  'concat-stream': resolve(shims, 'npm/concat-stream.ts'),
  'jimp': resolve(shims, 'npm/jimp.ts'),
  // AJV uses `new Function()` for code generation which doesn't work in QuickJS
  'ajv': resolve(shims, 'npm/ajv.ts'),
  'ajv-formats': resolve(shims, 'npm/ajv.ts'),
  // bcryptjs - delegate to native __bcrypt from Rust host
  'bcryptjs': resolve(shims, 'npm/bcryptjs.ts'),

  // ─── Cloud SDKs ──────────────────────────────────────────────────────────
  '@aws-sdk/client-s3': resolve(shims, 'cloud/aws-s3.ts'),
  '@smithy/smithy-client': resolve(shims, 'cloud/smithy.ts'),
  '@google-cloud/storage': resolve(shims, 'cloud/google-storage.ts'),
  'stripe': resolve(shims, 'cloud/stripe.ts'),
  'firebase-admin': resolve(shims, 'cloud/firebase.ts'),
});

// 4. Plugin to replace unenv internal runtime files with our shims
// unenv bundles its own events/stream internally which bypass our aliases
const unenvRedirectPlugin: Plugin = {
  name: 'unenv-redirect',
  setup(build) {
    // Replace unenv's internal events files with our shim
    build.onLoad({ filter: /unenv[\\/]runtime[\\/]node[\\/]events/ }, () => ({
      contents: `
        export * from '${resolve(shims, 'node/events.ts').replace(/\\/g, '/')}';
        export { default } from '${resolve(shims, 'node/events.ts').replace(/\\/g, '/')}';
      `,
      loader: 'ts',
    }));

    // Replace unenv's internal stream files with our shim
    build.onLoad({ filter: /unenv[\\/]runtime[\\/]node[\\/]stream/ }, () => ({
      contents: `
        export * from '${resolve(shims, 'node/stream.ts').replace(/\\/g, '/')}';
        export { default } from '${resolve(shims, 'node/stream.ts').replace(/\\/g, '/')}';
      `,
      loader: 'ts',
    }));
  },
};

// 5. Fallback plugin for packages not explicitly aliased
// Catches @aws-sdk/*, @smithy/*, and other packages we haven't explicitly shimmed
const fallbackStubPlugin: Plugin = {
  name: 'fallback-stub',
  setup(build) {
    // Skip packages that have explicit aliases
    const aliasedPaths = new Set(Object.keys(alias));

    const patterns = [
      /^@aws-sdk\/.+$/,      // All @aws-sdk packages
      /^@smithy\/.+$/,       // All @smithy packages
      /^@google-cloud\/.+$/, // All @google-cloud packages
      /^@puppeteer\/.+$/,    // Puppeteer packages
      /^firebase-admin\/.+$/,// Firebase subpaths
    ];

    for (const pattern of patterns) {
      build.onResolve({ filter: pattern }, (args) => {
        // Skip if explicitly aliased
        if (aliasedPaths.has(args.path)) return null;
        return {
          path: args.path,
          namespace: 'fallback-stub',
        };
      });
    }

    // Also catch specific packages that cause issues
    const specificPackages = [
      'puppeteer-core',
      'asynckit',
      'form-data',
      'graceful-fs',
      'node-html-parser',
      'sax',
      'iconv-lite',
      'xml2js',
      'hl7-standard',
      'xlsx-write-stream',
    ];

    for (const pkg of specificPackages) {
      build.onResolve({ filter: new RegExp(`^${pkg}$`) }, (args) => {
        if (aliasedPaths.has(args.path)) return null;
        return {
          path: args.path,
          namespace: 'fallback-stub',
        };
      });
    }

    // Return a simple stub module with all commonly needed exports
    build.onLoad({ filter: /.*/, namespace: 'fallback-stub' }, () => ({
      contents: `
        // Fallback stub for package not shimmed
        function Ctor() {}
        Ctor.prototype.pipe = function() { return this; };
        Ctor.prototype.on = function() { return this; };
        Ctor.prototype.once = function() { return this; };
        Ctor.prototype.emit = function() { return false; };
        Ctor.prototype.write = function() { return true; };
        Ctor.prototype.end = function() {};
        Ctor.prototype.send = async function() { return {}; };
        Ctor.prototype.destroy = function() {};

        export default Ctor;
        // AWS SDK
        export { Ctor as Client, Ctor as Command, Ctor as ServiceException };
        export { Ctor as S3Client, Ctor as SmithyClient };
        export { Ctor as PutObjectCommand, Ctor as GetObjectCommand };
        export { Ctor as DeleteObjectCommand, Ctor as HeadBucketCommand };
        export { Ctor as CreateBucketCommand, Ctor as ListObjectsV2Command };
        export { Ctor as CopyObjectCommand, Ctor as HeadObjectCommand };
        // AWS S3 presigner — getSignedUrl returns an empty URL in offline mode
        export async function getSignedUrl() { return ""; }
        // GCS
        export { Ctor as Storage, Ctor as Bucket, Ctor as File };
        // Streams
        export { Ctor as Readable, Ctor as Writable, Ctor as Transform };
        export { Ctor as PassThrough, Ctor as Duplex, Ctor as Stream };
        // Puppeteer
        export { Ctor as Browser, Ctor as Page, Ctor as BrowserFetcher };
        export function launch() { return Promise.resolve(new Ctor()); }
        // Stream utils
        export function pipeline() {}
        export function finished() {}
        export const promises = { pipeline: async () => {}, finished: async () => {} };
        export const __esModule = true;
      `,
      loader: 'js',
    }));
  },
};

// 4. Bundle the api-ts embedded entry with esbuild
console.log(`Building embedded bundle${noMinify ? ' (unminified)' : ''}...`);

const result = await build({
  entryPoints: [resolve(root, "src-js/entry.ts")],
  bundle: true,
  format: "iife",
  target: "es2017",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["import", "default"],
  minify: !noMinify,
  treeShaking: true,
  write: false,
  logLevel: "warning",
  plugins: [unenvRedirectPlugin, fallbackStubPlugin],
  alias,
  define: {
    "global": "globalThis",
    "process.env.NODE_ENV": '"production"',
    "process.env": "{}",
    "process.versions": "{}",
    "process.stdin": "undefined",
    "process.stdout": "undefined",
    "process.stderr": "undefined",
  },
  external: [],
});

if (result.errors.length > 0) {
  console.error("Build failed:", result.errors);
  process.exit(1);
}

let honoBundle = new TextDecoder().decode(result.outputFiles[0].contents);

// 5. Combine: shim first, then the Hono + api-ts IIFE
const combined = [
  "// === Web API Shim ===",
  shimCode,
  "",
  "// === api-ts Embedded App (IIFE) ===",
  honoBundle,
].join("\n");

writeFileSync(resolve(outDir, "bundle.js"), combined);

// 6. Write gzip-compressed bundle for binary embedding
const compressed = gzipSync(Buffer.from(combined), { level: 9 });
writeFileSync(resolve(outDir, "bundle.js.gz"), compressed);

const sizeKB = (combined.length / 1024).toFixed(1);
const gzSizeKB = (compressed.length / 1024).toFixed(1);
console.log(`✓ Wrote ${outDir}/bundle.js (${sizeKB} KB, gzip: ${gzSizeKB} KB)`);
