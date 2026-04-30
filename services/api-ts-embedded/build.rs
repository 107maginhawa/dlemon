//! Build script for api-ts-embedded.
//!
//! Runs `bun run src-js/build.ts` to produce `dist/bundle.js.gz` before
//! the Rust compiler sees `include_bytes!("../dist/bundle.js.gz")`.
//!
//! Cargo re-runs this script when any file in `src-js/` changes, so
//! downstream crates (e.g. dentalemon's Tauri app) automatically get
//! a fresh JS bundle whenever the embedded entry or shims are modified.

use std::env;
use std::path::Path;
use std::process::Command;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let root = Path::new(&manifest_dir);

    // Re-run when any JS source file changes
    println!("cargo:rerun-if-changed=src-js/");

    // Skip JS build if the bundle already exists and API_TS_EMBEDDED_SKIP_JS_BUILD is set
    // (useful for CI where the bundle is pre-built)
    if env::var("API_TS_EMBEDDED_SKIP_JS_BUILD").is_ok() {
        let bundle = root.join("dist/bundle.js.gz");
        if bundle.exists() {
            println!("cargo:warning=Skipping JS build (API_TS_EMBEDDED_SKIP_JS_BUILD set, bundle exists)");
            return;
        }
        println!("cargo:warning=API_TS_EMBEDDED_SKIP_JS_BUILD set but bundle missing, building anyway");
    }

    // Run the JS bundler
    let status = Command::new("bun")
        .args(["run", "src-js/build.ts"])
        .current_dir(root)
        .status()
        .expect("Failed to run `bun run src-js/build.ts`. Is bun installed?");

    if !status.success() {
        panic!(
            "JS bundle build failed (exit code: {}). Run `bun run build` manually for details.",
            status.code().unwrap_or(-1)
        );
    }
}
