# Imaging Canvas Rendering Spike

**Date:** 2026-05-11
**Phase:** v1.3 Phase 1 — iPad Rendering Spike
**Requirements:** IMG-02 (view with zoom/pan), IMG-18 (offline-capable)
**Status:** Code complete — hardware validation pending

## Methodology

Benchmark component: `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx`

- Generates a 2400×1200 programmatic panoramic image (simulated X-ray grayscale gradient)
- Renders 10 canvas overlay annotations (circles + labels in `#FFE97D` lemon accent)
- Runs 500 `requestAnimationFrame` frames with animated pan (±200px, ±100px) + zoom (1.0×→1.5×→1.0×)
- Reports: first paint ms, min/avg/max frame ms, avg FPS, memory delta (Chrome only)

**How to run:**
1. Add a route to the benchmark in the Vite dev app (e.g., `/imaging-spike`)
2. Open in Safari on iPad (or Chrome on desktop for memory data)
3. Click "Run Benchmark" and wait for 500 frames (~10–20s)
4. Fill in the Results table below

**Note:** dentalemon is a web app without Tauri integration. The benchmark runs in the
browser (Safari/WKWebView on iPad, or Chrome on desktop). `performance.memory` is
Chrome-only — use iPad Safari's process inspector for memory measurement if needed.

## Thresholds (from REQUIREMENTS.md / v1.3 eng review)

| Metric | Threshold | Unit |
|--------|-----------|------|
| First paint | < 2000 | ms |
| Pan/zoom FPS | ≥ 30 | fps (avg over 500 frames) |
| Memory delta | < 300 | MB |

## Results

> ⚠️ Hardware validation pending — fill in after running on iPad Safari.

| Metric | Result | Pass? |
|--------|--------|-------|
| First paint | — ms | — |
| Avg FPS | — fps | — |
| Frame min/avg/max | —/—/— ms | — |
| Memory delta | — MB | — |
| **Overall** | — | — |

**Device:** (fill in — iPad model, iOS version, Safari version)
**Date tested:** (fill in)

## Decision

**If PASS (expected):** Proceed with plain Canvas API for Phase 2 — no third-party rendering
library. HTML5 Canvas + `requestAnimationFrame` is the rendering approach.

**If FAIL:** Evaluate `cornerstone.js` (OHIF medical imaging Canvas wrapper) or a tiled
WebGL renderer. Re-run spike with candidate library before committing to Phase 2 scope.

## Confidence Basis (for assumed PASS)

- Modern Safari (WKWebView) on iPad Pro/Air handles 60fps Canvas rendering with complex
  scenes. 30fps threshold is conservative.
- 2400×1200 image with 10 annotations is within typical Canvas compositing budget.
- `drawImage` from offscreen canvas is GPU-accelerated on all modern WebKit versions.
- First paint < 2s: programmatic generation takes ~5–50ms; image decode (if real JPEG) adds
  ~200–500ms on iPad — well within threshold.

## Related Files

- Benchmark component: `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx`
- Phase plan: `.planning/phases/05-ipad-rendering-spike/05-01-PLAN.md`
- Phase context: `.planning/phases/05-ipad-rendering-spike/05-CONTEXT.md`
- Requirements: `.planning/REQUIREMENTS.md` → IMG-01 through IMG-18
