//! QuickJS engine with native bindings for embedded api-ts.
//!
//! Internal module - not exposed to library consumers.
//! Use `ApiTsEmbedded` from the crate root instead.

use rquickjs::{
    Context, Ctx, Function, Object, Runtime, Value,
};
use std::sync::{mpsc, Arc, Mutex};

use hmac::{Hmac, Mac};
use sha2::{Digest as Sha256Digest, Sha256};
use sha1::Sha1;

use flate2::read::GzDecoder;
use std::io::Read as IoRead;

use crate::db::Database;

/// Embedded api-ts JS bundle (gzip-compressed).
/// Built by: `cd services/api-ts-embedded && bun run build`
const BUNDLE_GZ: &[u8] = include_bytes!("../dist/bundle.js.gz");

/// Per-request timing breakdown in microseconds.
///
/// `dispatch_us`, `jobs_us`, `read_us`, `iterations` are populated by the engine.
/// `command_us` is populated by the Tauri command layer (Rust side, includes mpsc
/// round-trip + header conversion). It's 0 when produced by the engine alone.
#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct EngineTimings {
    /// Time inside `dispatch_request` — Hono routing + middleware setup.
    pub dispatch_us: u64,
    /// Time spent in the job queue loop — handler execution + DB queries.
    pub jobs_us: u64,
    /// Time inside `read_response` — JS → Rust deserialization.
    pub read_us: u64,
    /// Number of job-queue iterations consumed before `__res` was set.
    pub iterations: u32,
    /// Total Tauri command duration (filled by the command layer; 0 at the engine boundary).
    pub command_us: u64,
}

/// Response from the embedded JS engine (internal)
#[derive(Debug)]
pub(crate) struct EngineResponse {
    pub(crate) status: u16,
    pub(crate) body: serde_json::Value,
    pub(crate) headers: Vec<(String, String)>,
    pub(crate) logs: Vec<String>,
    pub(crate) timings: EngineTimings,
}

/// Trait for JS engine implementations (internal)
pub(crate) trait JsEngine: Send + Sync {
    fn handle_request(
        &self,
        method: &str,
        url: &str,
        body: Option<&str>,
        headers: Vec<(&str, &str)>,
    ) -> Result<EngineResponse, String>;
}

/// Per-request log buffer (thread-safe for QuickJS)
type LogBuffer = Arc<Mutex<Vec<String>>>;

/// Request sent to the JS thread
struct JsRequest {
    method: String,
    url: String,
    body: Option<String>,
    headers: Vec<(String, String)>,
    reply: mpsc::Sender<Result<EngineResponse, String>>,
}

pub(crate) struct QuickJsEngine {
    tx: mpsc::Sender<JsRequest>,
}

impl QuickJsEngine {
    /// Create a new QuickJS engine with the given database path.
    /// The JS bundle is embedded at compile time.
    pub(crate) fn new(db_path: &str) -> Result<Self, String> {
        let db = Arc::new(Database::new(db_path)?);
        let (tx, rx) = mpsc::channel::<JsRequest>();
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();

        let db_clone = db.clone();
        let bundle_bytes = BUNDLE_GZ.to_vec();

        // 64MB stack for QuickJS — the full api-ts bundle is ~14MB and needs
        // significant stack space during eval (parsing + IIFE execution).
        std::thread::Builder::new()
            .name("quickjs-engine".into())
            .stack_size(64 * 1024 * 1024)
            .spawn(move || {
                let log_buffer: LogBuffer = Arc::new(Mutex::new(Vec::new()));

                // Create QuickJS runtime and context
                let rt = match Runtime::new() {
                    Ok(rt) => rt,
                    Err(e) => {
                        let _ = ready_tx.send(Err(format!("Failed to create QuickJS runtime: {}", e)));
                        return;
                    }
                };

                // Set memory limits
                rt.set_memory_limit(512 * 1024 * 1024); // 512MB max
                rt.set_max_stack_size(64 * 1024 * 1024); // 64MB stack

                let ctx = match Context::full(&rt) {
                    Ok(ctx) => ctx,
                    Err(e) => {
                        let _ = ready_tx.send(Err(format!("Failed to create QuickJS context: {}", e)));
                        return;
                    }
                };

                // Setup context with native bindings and load bundle
                let setup_result = ctx.with(|ctx| {
                    setup_context(&ctx, &db_clone, &log_buffer, &bundle_bytes)
                });

                if let Err(e) = setup_result {
                    log::error!("Failed to setup QuickJS context: {}", e);
                    let _ = ready_tx.send(Err(e));
                    return;
                }

                // Run job queue to complete async IIFE initialization
                // The bundle has an async IIFE that sets up __dispatch - we need to
                // process the promise job queue until it completes.
                log::info!("Running job queue to complete bundle initialization...");
                let mut init_iterations = 0;
                let max_init_iterations = 10000;
                loop {
                    let mut jobs_executed = false;
                    while rt.is_job_pending() {
                        match rt.execute_pending_job() {
                            Ok(true) => {
                                jobs_executed = true;
                                init_iterations += 1;
                            }
                            Ok(false) => break,
                            Err(e) => {
                                log::warn!("Job execution error during init: {:?}", e);
                                break;
                            }
                        }
                    }

                    // Drain console logs periodically during init
                    ctx.with(|ctx| drain_console_logs(&ctx, &log_buffer));

                    // Check if __dispatch is defined
                    let dispatch_ready = ctx.with(|ctx| {
                        let globals = ctx.globals();
                        if let Ok(dispatch) = globals.get::<_, Value>("__dispatch") {
                            !dispatch.is_undefined() && !dispatch.is_null()
                        } else {
                            false
                        }
                    });

                    if dispatch_ready {
                        log::info!("__dispatch ready after {} job iterations", init_iterations);
                        break;
                    }

                    if !jobs_executed || init_iterations >= max_init_iterations {
                        log::warn!("Bundle init: no more jobs after {} iterations, __dispatch not yet ready", init_iterations);
                        break;
                    }
                }

                log::info!("QuickJS thread ready (bundle loaded)");
                let _ = ready_tx.send(Ok(()));

                // Event loop - process requests
                // IMPORTANT: Job queue operations (is_job_pending, execute_pending_job) must
                // happen OUTSIDE of ctx.with() because both borrow the runtime's internal RefCell.
                while let Ok(req) = rx.recv() {
                    // Phase 1: Clear logs and dispatch request (inside ctx.with)
                    if let Ok(mut logs) = log_buffer.lock() {
                        logs.clear();
                    }

                    let dispatch_start = std::time::Instant::now();
                    let dispatch_result = ctx.with(|ctx| {
                        dispatch_request(&ctx, &req.method, &req.url, req.body.as_deref(), &req.headers)
                    });
                    let dispatch_us = dispatch_start.elapsed().as_micros() as u64;

                    if let Err(e) = dispatch_result {
                        let _ = req.reply.send(Err(e));
                        continue;
                    }

                    // Phase 2: Run job queue until __res is set (outside ctx.with)
                    let jobs_start = std::time::Instant::now();
                    let max_iterations = 5000;
                    let mut iterations_used: u32 = max_iterations as u32;
                    for iteration in 0..max_iterations {
                        // Execute pending jobs - MUST be outside ctx.with()
                        while rt.is_job_pending() {
                            match rt.execute_pending_job() {
                                Ok(false) => break,
                                Ok(true) => continue,
                                Err(e) => {
                                    log::warn!("Job execution error: {:?}", e);
                                    break;
                                }
                            }
                        }

                        // Drain console logs (inside ctx.with)
                        ctx.with(|ctx| drain_console_logs(&ctx, &log_buffer));

                        // Check if __res is set (inside ctx.with)
                        let response_ready = ctx.with(|ctx| {
                            let globals = ctx.globals();
                            if let Ok(res_val) = globals.get::<_, Value>("__res") {
                                !res_val.is_null() && !res_val.is_undefined()
                            } else {
                                false
                            }
                        });

                        if response_ready {
                            iterations_used = (iteration + 1) as u32;
                            break;
                        }

                        if iteration > 0 && iteration % 500 == 0 {
                            log::info!("Still waiting for response after {} iterations...", iteration);
                        }
                    }
                    let jobs_us = jobs_start.elapsed().as_micros() as u64;

                    // Phase 3: Read response (inside ctx.with)
                    let read_start = std::time::Instant::now();
                    let result = ctx.with(|ctx| {
                        read_response(&ctx, &log_buffer)
                    });
                    let read_us = read_start.elapsed().as_micros() as u64;

                    // Attach timings to the response (or surface them in the error?
                    // For now, errors don't carry timings — they go via the Err arm.)
                    let result = result.map(|mut r| {
                        r.timings = EngineTimings {
                            dispatch_us,
                            jobs_us,
                            read_us,
                            iterations: iterations_used,
                            command_us: 0,
                        };
                        r
                    });
                    let _ = req.reply.send(result);
                }
                log::info!("QuickJS thread shutting down");
            })
            .map_err(|e| format!("Failed to spawn QuickJS thread: {}", e))?;

        ready_rx
            .recv()
            .map_err(|e| format!("JS thread died during setup: {}", e))?
            .map_err(|e| format!("JS thread setup failed: {}", e))?;

        log::info!("QuickJsEngine initialized (bundle pre-loaded)");
        Ok(Self { tx })
    }
}

impl JsEngine for QuickJsEngine {
    fn handle_request(
        &self,
        method: &str,
        url: &str,
        body: Option<&str>,
        headers: Vec<(&str, &str)>,
    ) -> Result<EngineResponse, String> {
        let (reply_tx, reply_rx) = mpsc::channel();
        let req = JsRequest {
            method: method.to_string(),
            url: url.to_string(),
            body: body.map(String::from),
            headers: headers
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
            reply: reply_tx,
        };
        self.tx
            .send(req)
            .map_err(|e| format!("JS thread send failed: {}", e))?;
        reply_rx
            .recv()
            .map_err(|e| format!("JS thread recv failed: {}", e))?
    }
}

// ── Context Setup ──────────────────────────────────────────────────────

fn decompress_bundle(bundle_gz: &[u8]) -> Result<String, String> {
    let mut decoder = GzDecoder::new(bundle_gz);
    let mut bundle = String::new();
    decoder
        .read_to_string(&mut bundle)
        .map_err(|e| format!("Failed to decompress bundle: {}", e))?;
    Ok(bundle)
}

fn setup_context(
    ctx: &Ctx<'_>,
    db: &Arc<Database>,
    log_buffer: &LogBuffer,
    bundle_gz: &[u8],
) -> Result<(), String> {
    // ── console ──
    setup_console(ctx, log_buffer)?;

    // ── __db ──
    setup_db(ctx, db)?;

    // ── __crypto ──
    setup_crypto(ctx)?;

    // ── __bcrypt ──
    setup_bcrypt(ctx)?;

    // ── Load bundle ──
    let bundle = decompress_bundle(bundle_gz)?;
    ctx.eval::<(), _>(bundle.as_str())
        .map_err(|e| format!("Failed to load bundle.js: {}", e))?;

    log::info!(
        "Bundle loaded ({:.0} KB decompressed from {:.0} KB gzip)",
        bundle.len() as f64 / 1024.0,
        bundle_gz.len() as f64 / 1024.0
    );
    Ok(())
}

// ── Console Binding ────────────────────────────────────────────────────
// Uses a global JS array to collect logs, avoiding RefCell re-entrancy issues

fn setup_console(ctx: &Ctx<'_>, _log_buffer: &LogBuffer) -> Result<(), String> {
    // Create console object with pure JS implementation that stores logs in a global array
    // We'll read __console_logs after each request to populate the Rust log buffer
    ctx.eval::<(), _>(r#"
        globalThis.__console_logs = [];
        globalThis.console = {
            _doLog: function(level, args) {
                const msg = args.map(a => {
                    if (a === null) return 'null';
                    if (a === undefined) return 'undefined';
                    if (typeof a === 'object') {
                        try { return JSON.stringify(a); }
                        catch { return '[object]'; }
                    }
                    return String(a);
                }).join(' ');
                globalThis.__console_logs.push({ level, msg });
            },
            log: function(...args) { this._doLog('info', args); },
            info: function(...args) { this._doLog('info', args); },
            warn: function(...args) { this._doLog('warn', args); },
            error: function(...args) { this._doLog('error', args); },
            debug: function(...args) { this._doLog('debug', args); },
        };
    "#).map_err(|e| format!("Failed to create console: {}", e))?;

    Ok(())
}

// Helper to drain console logs from JS and write to Rust log
fn drain_console_logs(ctx: &Ctx<'_>, log_buffer: &LogBuffer) {
    // Get and clear __console_logs array as JSON string
    let result: Result<String, _> = ctx.eval(r#"
        (function() {
            const logs = globalThis.__console_logs || [];
            globalThis.__console_logs = [];
            return JSON.stringify(logs);
        })()
    "#);

    if let Ok(json) = result {
        if let Ok(logs) = serde_json::from_str::<Vec<serde_json::Value>>(&json) {
            let mut buf = log_buffer.lock().unwrap_or_else(|e| e.into_inner());
            for log_entry in logs {
                let level = log_entry["level"].as_str().unwrap_or("info");
                let msg = log_entry["msg"].as_str().unwrap_or("");
                match level {
                    "error" => log::error!("[JS] {}", msg),
                    "warn" => log::warn!("[JS] {}", msg),
                    _ => log::info!("[JS] {}", msg),
                }
                buf.push(msg.to_string());
            }
        }
    }
}

// ── Database Binding ───────────────────────────────────────────────────

fn setup_db(ctx: &Ctx<'_>, db: &Arc<Database>) -> Result<(), String> {
    let db_obj = Object::new(ctx.clone()).map_err(|e| format!("Failed to create __db: {}", e))?;

    // execute(sql, params_json) -> { changes, last_insert_id } as JSON string
    // Note: params are passed as JSON string from JS wrapper
    // IMPORTANT: Don't use MutFn here - Arc<Database> is already thread-safe
    // and MutFn uses RefCell which causes re-entrancy panics during job execution
    let db_for_exec = db.clone();
    let execute_fn = Function::new(
        ctx.clone(),
        move |sql: String, params_json: String| -> Result<String, rquickjs::Error> {
            let params: Vec<serde_json::Value> = serde_json::from_str(&params_json)
                .unwrap_or_default();

            let result = db_for_exec
                .execute(&sql, params)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "result", e))?;

            Ok(serde_json::to_string(&result).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __db.execute: {}", e))?;

    // select(sql, params_json) -> rows[] as JSON string
    let db_for_sel = db.clone();
    let select_fn = Function::new(
        ctx.clone(),
        move |sql: String, params_json: String| -> Result<String, rquickjs::Error> {
            let params: Vec<serde_json::Value> = serde_json::from_str(&params_json)
                .unwrap_or_default();

            let rows = db_for_sel
                .select(&sql, params)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "result", e))?;

            Ok(serde_json::to_string(&rows).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __db.select: {}", e))?;

    // Set native functions with _native suffix
    db_obj.set("_execute_native", execute_fn).map_err(|e| format!("Failed to set __db._execute_native: {}", e))?;
    db_obj.set("_select_native", select_fn).map_err(|e| format!("Failed to set __db._select_native: {}", e))?;

    ctx.globals()
        .set("__db", db_obj)
        .map_err(|e| format!("Failed to register __db: {}", e))?;

    // Add JS wrappers that handle JSON serialization
    ctx.eval::<(), _>(r#"
        globalThis.__db.execute = function(sql, params) {
            const result = globalThis.__db._execute_native(sql, JSON.stringify(params || []));
            return JSON.parse(result);
        };
        globalThis.__db.select = function(sql, params) {
            const result = globalThis.__db._select_native(sql, JSON.stringify(params || []));
            return JSON.parse(result);
        };
    "#).map_err(|e| format!("Failed to create __db JS wrappers: {}", e))?;

    Ok(())
}

// ── Crypto Binding ─────────────────────────────────────────────────────
// Uses simple typed parameters and JSON strings to avoid RefCell re-entrancy issues

fn setup_crypto(ctx: &Ctx<'_>) -> Result<(), String> {
    let crypto_obj = Object::new(ctx.clone()).map_err(|e| format!("Failed to create __crypto: {}", e))?;

    // _getRandomValues_native(length) -> JSON string of number[]
    let rand_fn = Function::new(
        ctx.clone(),
        |len: i32| -> Result<String, rquickjs::Error> {
            let mut bytes = vec![0u8; len as usize];
            getrandom::getrandom(&mut bytes)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "bytes", format!("getrandom failed: {}", e)))?;
            let nums: Vec<i32> = bytes.into_iter().map(|b| b as i32).collect();
            Ok(serde_json::to_string(&nums).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __crypto._getRandomValues_native: {}", e))?;

    // randomUUID() -> string
    let uuid_fn = Function::new(
        ctx.clone(),
        || -> Result<String, rquickjs::Error> {
            Ok(uuid::Uuid::new_v4().to_string())
        },
    )
    .map_err(|e| format!("Failed to create __crypto.randomUUID: {}", e))?;

    // _sha256_native(bytes_json) -> JSON string of number[]
    let sha256_fn = Function::new(
        ctx.clone(),
        |bytes_json: String| -> Result<String, rquickjs::Error> {
            let bytes: Vec<u8> = serde_json::from_str::<Vec<i32>>(&bytes_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();
            let hash = Sha256::digest(&bytes);
            let nums: Vec<i32> = hash.iter().map(|b| *b as i32).collect();
            Ok(serde_json::to_string(&nums).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __crypto._sha256_native: {}", e))?;

    // _sha1_native(bytes_json) -> JSON string of number[]
    let sha1_fn = Function::new(
        ctx.clone(),
        |bytes_json: String| -> Result<String, rquickjs::Error> {
            let bytes: Vec<u8> = serde_json::from_str::<Vec<i32>>(&bytes_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();
            let hash = Sha1::digest(&bytes);
            let nums: Vec<i32> = hash.iter().map(|b| *b as i32).collect();
            Ok(serde_json::to_string(&nums).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __crypto._sha1_native: {}", e))?;

    // _hmacSha256Sign_native(key_json, data_json) -> JSON string of number[]
    let hmac_sign_fn = Function::new(
        ctx.clone(),
        |key_json: String, data_json: String| -> Result<String, rquickjs::Error> {
            let key: Vec<u8> = serde_json::from_str::<Vec<i32>>(&key_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();
            let data: Vec<u8> = serde_json::from_str::<Vec<i32>>(&data_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();

            let mut mac = Hmac::<Sha256>::new_from_slice(&key)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "hmac", format!("HMAC init failed: {}", e)))?;
            mac.update(&data);
            let result = mac.finalize().into_bytes();
            let nums: Vec<i32> = result.iter().map(|b| *b as i32).collect();
            Ok(serde_json::to_string(&nums).unwrap())
        },
    )
    .map_err(|e| format!("Failed to create __crypto._hmacSha256Sign_native: {}", e))?;

    // _hmacSha256Verify_native(key_json, sig_json, data_json) -> boolean
    let hmac_verify_fn = Function::new(
        ctx.clone(),
        |key_json: String, sig_json: String, data_json: String| -> Result<bool, rquickjs::Error> {
            let key: Vec<u8> = serde_json::from_str::<Vec<i32>>(&key_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();
            let sig: Vec<u8> = serde_json::from_str::<Vec<i32>>(&sig_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();
            let data: Vec<u8> = serde_json::from_str::<Vec<i32>>(&data_json)
                .unwrap_or_default()
                .into_iter()
                .map(|n| n as u8)
                .collect();

            let mut mac = Hmac::<Sha256>::new_from_slice(&key)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "hmac", format!("HMAC init failed: {}", e)))?;
            mac.update(&data);
            Ok(mac.verify_slice(&sig).is_ok())
        },
    )
    .map_err(|e| format!("Failed to create __crypto._hmacSha256Verify_native: {}", e))?;

    // Set native functions
    crypto_obj.set("_getRandomValues_native", rand_fn).map_err(|e| format!("Failed to set: {}", e))?;
    crypto_obj.set("randomUUID", uuid_fn).map_err(|e| format!("Failed to set: {}", e))?;
    crypto_obj.set("_sha256_native", sha256_fn).map_err(|e| format!("Failed to set: {}", e))?;
    crypto_obj.set("_sha1_native", sha1_fn).map_err(|e| format!("Failed to set: {}", e))?;
    crypto_obj.set("_hmacSha256Sign_native", hmac_sign_fn).map_err(|e| format!("Failed to set: {}", e))?;
    crypto_obj.set("_hmacSha256Verify_native", hmac_verify_fn).map_err(|e| format!("Failed to set: {}", e))?;

    ctx.globals()
        .set("__crypto", crypto_obj)
        .map_err(|e| format!("Failed to register __crypto: {}", e))?;

    // Add JS wrappers for array-based APIs
    ctx.eval::<(), _>(r#"
        globalThis.__crypto.getRandomValues = function(len) {
            return JSON.parse(globalThis.__crypto._getRandomValues_native(len || 0));
        };
        globalThis.__crypto.sha256 = function(bytes) {
            return JSON.parse(globalThis.__crypto._sha256_native(JSON.stringify(bytes || [])));
        };
        globalThis.__crypto.sha1 = function(bytes) {
            return JSON.parse(globalThis.__crypto._sha1_native(JSON.stringify(bytes || [])));
        };
        globalThis.__crypto.hmacSha256Sign = function(key, data) {
            return JSON.parse(globalThis.__crypto._hmacSha256Sign_native(
                JSON.stringify(key || []),
                JSON.stringify(data || [])
            ));
        };
        globalThis.__crypto.hmacSha256Verify = function(key, sig, data) {
            return globalThis.__crypto._hmacSha256Verify_native(
                JSON.stringify(key || []),
                JSON.stringify(sig || []),
                JSON.stringify(data || [])
            );
        };
    "#).map_err(|e| format!("Failed to create __crypto JS wrappers: {}", e))?;

    Ok(())
}

// ── Bcrypt Binding ─────────────────────────────────────────────────────
// Uses simple typed parameters to avoid RefCell re-entrancy issues

fn setup_bcrypt(ctx: &Ctx<'_>) -> Result<(), String> {
    let bcrypt_obj = Object::new(ctx.clone()).map_err(|e| format!("Failed to create __bcrypt: {}", e))?;

    // hash(password) -> string (using simple String parameter)
    let hash_fn = Function::new(
        ctx.clone(),
        |password: String| -> Result<String, rquickjs::Error> {
            let hash = bcrypt::hash(&password, 10)
                .map_err(|e| rquickjs::Error::new_from_js_message("native", "hash", format!("bcrypt hash failed: {}", e)))?;
            Ok(hash)
        },
    )
    .map_err(|e| format!("Failed to create __bcrypt.hash: {}", e))?;

    // verify(password, hash) -> boolean (using simple String parameters)
    let verify_fn = Function::new(
        ctx.clone(),
        |password: String, hash: String| -> Result<bool, rquickjs::Error> {
            Ok(bcrypt::verify(&password, &hash).unwrap_or(false))
        },
    )
    .map_err(|e| format!("Failed to create __bcrypt.verify: {}", e))?;

    bcrypt_obj.set("hash", hash_fn).map_err(|e| format!("Failed to set __bcrypt.hash: {}", e))?;
    bcrypt_obj.set("verify", verify_fn).map_err(|e| format!("Failed to set __bcrypt.verify: {}", e))?;

    ctx.globals()
        .set("__bcrypt", bcrypt_obj)
        .map_err(|e| format!("Failed to register __bcrypt: {}", e))?;

    Ok(())
}

// ── Request Dispatch ──────────────────────────────────────────────────
// Split into dispatch_request and read_response to allow job queue
// operations to happen outside of ctx.with() blocks.

/// Phase 1: Set up request globals and call __dispatch
fn dispatch_request(
    ctx: &Ctx<'_>,
    method: &str,
    url: &str,
    body: Option<&str>,
    headers: &[(String, String)],
) -> Result<(), String> {
    let headers_map: std::collections::HashMap<&str, &str> =
        headers.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    let headers_json = serde_json::to_string(&headers_map).unwrap_or_else(|_| "{}".to_string());

    // Set request arguments as globals
    let globals = ctx.globals();
    globals
        .set("__arg_method", method)
        .map_err(|e| format!("Failed to set __arg_method: {}", e))?;
    globals
        .set("__arg_url", url)
        .map_err(|e| format!("Failed to set __arg_url: {}", e))?;

    match body {
        Some(b) => globals.set("__arg_body", b).map_err(|e| format!("Failed to set __arg_body: {}", e))?,
        None => globals
            .set("__arg_body", Value::new_null(ctx.clone()))
            .map_err(|e| format!("Failed to set __arg_body: {}", e))?,
    }

    globals
        .set("__arg_headers", headers_json.as_str())
        .map_err(|e| format!("Failed to set __arg_headers: {}", e))?;

    // Reset __res and call dispatch with error capture
    ctx.eval::<(), _>(
        r#"
        globalThis.__res = null;
        try {
            if (typeof globalThis.__dispatch !== 'function') {
                throw new Error('__dispatch is not defined or not a function');
            }
            globalThis.__dispatch(__arg_method, __arg_url, __arg_body, __arg_headers);
        } catch (e) {
            console.error('[Dispatch Error]', e?.message || e, e?.stack || '');
            globalThis.__res = JSON.stringify({
                s: 500,
                b: JSON.stringify({ error: e?.message || String(e) }),
                h: {},
            });
        }
        "#,
    )
    .map_err(|e| format!("Failed to execute dispatch: {}", e))?;

    Ok(())
}

/// Phase 3: Read __res and return the response
fn read_response(
    ctx: &Ctx<'_>,
    log_buffer: &LogBuffer,
) -> Result<EngineResponse, String> {
    // Drain any remaining console logs
    drain_console_logs(ctx, log_buffer);

    // Collect logs
    let logs = if let Ok(mut buf) = log_buffer.lock() {
        buf.drain(..).collect()
    } else {
        vec![]
    };

    // Parse response
    let globals = ctx.globals();
    let res_val: Value = globals
        .get("__res")
        .map_err(|e| format!("Failed to read __res: {}", e))?;

    if let Some(s) = res_val.as_string() {
        let s = s.to_string().map_err(|e| format!("Failed to convert __res to string: {}", e))?;
        let parsed: serde_json::Value =
            serde_json::from_str(&s).map_err(|e| format!("Failed to parse response JSON: {} — raw: {}", e, s))?;
        let status = parsed["s"].as_u64().unwrap_or(200) as u16;
        let body_str = parsed["b"].as_str().unwrap_or("null");
        let body: serde_json::Value =
            serde_json::from_str(body_str).unwrap_or_else(|_| serde_json::Value::String(body_str.to_string()));
        let mut resp_headers = Vec::new();
        if let Some(h) = parsed["h"].as_object() {
            for (k, v) in h {
                if let Some(vs) = v.as_str() {
                    resp_headers.push((k.clone(), vs.to_string()));
                }
            }
        }
        Ok(EngineResponse {
            status,
            body,
            headers: resp_headers,
            logs,
            timings: EngineTimings::default(),
        })
    } else {
        Err(format!("No response from bundle (__res not set). Logs: {:?}", logs))
    }
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_console_log() {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();
        let log_buffer: LogBuffer = Arc::new(Mutex::new(Vec::new()));

        ctx.with(|ctx| {
            setup_console(&ctx, &log_buffer).unwrap();
            ctx.eval::<(), _>("console.log('test', 123, true)").unwrap();
            // Drain logs from JS globalThis.__console_logs to log_buffer
            drain_console_logs(&ctx, &log_buffer);
        });

        let logs = log_buffer.lock().unwrap();
        assert_eq!(logs.len(), 1);
        assert!(logs[0].contains("test"));
        assert!(logs[0].contains("123"));
        assert!(logs[0].contains("true"));
    }

    #[test]
    fn test_crypto_uuid() {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();

        ctx.with(|ctx| {
            setup_crypto(&ctx).unwrap();
            let uuid: String = ctx.eval("__crypto.randomUUID()").unwrap();
            assert_eq!(uuid.len(), 36); // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            assert!(uuid.contains('-'));
        });
    }

    #[test]
    fn test_crypto_sha256() {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();

        ctx.with(|ctx| {
            setup_crypto(&ctx).unwrap();
            // SHA256 of empty input
            let result: Vec<i32> = ctx.eval("__crypto.sha256([])").unwrap();
            assert_eq!(result.len(), 32); // SHA256 produces 32 bytes
        });
    }

    #[test]
    fn test_bcrypt_hash_verify() {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();

        ctx.with(|ctx| {
            setup_bcrypt(&ctx).unwrap();
            let hash: String = ctx.eval("__bcrypt.hash('password123')").unwrap();
            assert!(hash.starts_with("$2")); // bcrypt hash format

            // Verify correct password
            ctx.globals().set("__test_hash", hash.as_str()).unwrap();
            let is_valid: bool = ctx.eval("__bcrypt.verify('password123', __test_hash)").unwrap();
            assert!(is_valid);

            // Verify wrong password
            let is_invalid: bool = ctx.eval("__bcrypt.verify('wrongpassword', __test_hash)").unwrap();
            assert!(!is_invalid);
        });
    }

    #[test]
    fn test_promise_resolution() {
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();

        ctx.with(|ctx| {
            ctx.eval::<(), _>("globalThis.result = null; Promise.resolve(42).then(v => globalThis.result = v)")
                .unwrap();
        });

        // Run job queue
        while rt.is_job_pending() {
            rt.execute_pending_job().unwrap();
        }

        ctx.with(|ctx| {
            let result: i32 = ctx.globals().get("result").unwrap();
            assert_eq!(result, 42);
        });
    }

    #[test]
    fn test_db_operations() {
        let db = Arc::new(Database::new(":memory:").unwrap());
        let rt = Runtime::new().unwrap();
        let ctx = Context::full(&rt).unwrap();

        ctx.with(|ctx| {
            setup_db(&ctx, &db).unwrap();

            // Create table
            ctx.eval::<(), _>("__db.execute('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')")
                .unwrap();

            // Insert data
            ctx.eval::<(), _>("__db.execute('INSERT INTO test (name) VALUES (?)', ['Alice'])")
                .unwrap();
            ctx.eval::<(), _>("__db.execute('INSERT INTO test (name) VALUES (?)', ['Bob'])")
                .unwrap();

            // Select data and verify length via JS
            let count: i32 = ctx.eval("__db.select('SELECT * FROM test').length").unwrap();
            assert_eq!(count, 2);

            // Verify data values via JS
            let first_name: String = ctx.eval("__db.select('SELECT * FROM test')[0][1]").unwrap();
            assert_eq!(first_name, "Alice");
        });
    }
}
