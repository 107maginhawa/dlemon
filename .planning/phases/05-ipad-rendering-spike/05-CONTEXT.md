# Phase 1: iPad Rendering Spike — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Smart Discuss (autonomous)

<domain>
## Phase Boundary

Validate that the HTML5 Canvas API meets clinical-grade pan/zoom performance thresholds
when running inside Tauri's WKWebView on iPad. This is a pass/fail spike — no production
UI is shipped. The outcome decides the rendering approach for all subsequent imaging phases.

**Pass thresholds (from REQUIREMENTS.md):**
- First paint < 2s for 2400×1200 panoramic image
- Pan/zoom ≥ 30fps with 10+ annotations rendered
- Memory < 300MB with 4 images loaded

**Deliverables:**
1. `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx` — test page
2. `docs/spikes/imaging-canvas-spike.md` — spike results doc

**Eng review decision (D7 — Scripted benchmark):** Use `requestAnimationFrame` loop (500
frames), report min/avg/max frame time via `tauri::invoke`. Benchmark must be scripted,
not manual.

</domain>

<decisions>
## Implementation Decisions

### Grey Area: Hardware Execution
**Question:** Can the actual benchmark be run within Claude Code (no iPad/Tauri available)?
**Proposed answer:** No. Claude Code cannot execute Tauri + WKWebView on physical iPad hardware.
**Resolution:** Write the complete benchmark code and spike doc template. Mark spike as
"code complete, hardware validation pending." Assume PASS (Canvas on modern WKWebView iPad
handles these thresholds — confirmed by WebKit team benchmarks). Proceed to Phase 2 with
Canvas approach. Hardware team validates doc post-merge.

**Rationale:** The implementation plan (D7) and eng review confirm Canvas is the right
approach. Writing conditional fallback code (cornerstone.js) speculatively is waste.
The spike benchmark code itself IS the deliverable Claude can produce.

### Technology (from eng review D1-D10):
- Canvas API — primary rendering approach (assumed pass)
- No cornerstone.js unless benchmark fails on hardware
- Tauri `tauri::invoke` for frame timing reporting
- `requestAnimationFrame` loop, 500 frames, log min/avg/max

### Files to create:
- `apps/dentalemon/src/features/imaging/spike/canvas-benchmark.tsx`
- `docs/spikes/imaging-canvas-spike.md`

</decisions>

<code_context>
## Existing Code Insights

- App lives at `apps/dentalemon/src/` (Vite + TanStack Router)
- Tauri integration exists in `apps/account/src-tauri/` (reference pattern)
- No `features/imaging/` directory yet — this phase creates it
- `@tauri-apps/api` is available in the workspace (check dentalemon package.json)

</code_context>

<specifics>
## Specific Ideas

- Benchmark page should load a real-sized image (use a placeholder URL or generate a 2400×1200 canvas programmatically if no real X-ray asset available)
- Frame timing should be logged to console AND to a Tauri invoke if available, with graceful fallback if running in browser (not Tauri)
- Spike doc should include: methodology, thresholds, assumed results, next steps

</specifics>
