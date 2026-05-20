/**
 * extract-surface-paths.ts — One-time codegen script
 *
 * Reads 32 column SVGs from docs/development/teeth/tooth-{1-32}-column.svg,
 * extracts the top-view (occlusal/incisal) 5-zone surface map paths,
 * and writes tooth-surface-paths.ts to the workspace components.
 *
 * Usage: bun scripts/extract-surface-paths.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SVG_DIR = join(import.meta.dir, '..', 'docs', 'development', 'teeth');
const OUT_FILE = join(
  import.meta.dir,
  '..',
  'apps',
  'dentalemon',
  'src',
  'features',
  'workspace',
  'components',
  'tooth-surface-paths.ts',
);

interface ZonePath {
  d: string;
  fill: string;
}

interface ToothSurfacePathData {
  /** ViewBox cropped to the top-view section of the column SVG */
  viewBox: string;
  zones: {
    center: ZonePath;
    left: ZonePath;
    right: ZonePath;
    top: ZonePath;
    bottom: ZonePath;
  };
}

function extractPathById(svgContent: string, id: string): { d: string; fill: string } | null {
  // Try: id before d
  const r1 = new RegExp(`<(?:path|rect)[^>]*id="${id}"[^>]*>`, 's');
  const m1 = svgContent.match(r1);
  if (m1) {
    const tag = m1[0]!;
    const d = tag.match(/\bd="([^"]+)"/)?.[1] ?? '';
    const fill = extractFill(tag);
    if (d) return { d, fill };
  }

  // Try: d before id
  const r2 = new RegExp(`<(?:path|rect)[^>]*d="([^"]+)"[^>]*id="${id}"`, 's');
  const m2 = svgContent.match(r2);
  if (m2) {
    const tag = m2[0]!;
    const d = m2[1]!;
    const fill = extractFill(tag);
    return { d, fill };
  }

  return null;
}

function extractFill(tag: string): string {
  // Check style attribute first
  const styleMatch = tag.match(/style="([^"]*)"/);
  if (styleMatch) {
    const fillMatch = styleMatch[1]!.match(/fill:([^;]+)/);
    if (fillMatch) return fillMatch[1]!.trim();
  }
  // Check fill attribute
  const fillAttr = tag.match(/\bfill="([^"]+)"/);
  if (fillAttr) return fillAttr[1]!;
  return '#fff';
}

function extractRectById(svgContent: string, id: string): { x: number; y: number; w: number; h: number } | null {
  const r = new RegExp(`<rect[^>]*id="${id}"[^>]*>`, 's');
  const m = svgContent.match(r);
  if (!m) return null;
  const tag = m[0]!;
  const x = parseFloat(tag.match(/\bx="([^"]+)"/)?.[1] ?? '0');
  const y = parseFloat(tag.match(/\by="([^"]+)"/)?.[1] ?? '0');
  const w = parseFloat(tag.match(/\bwidth="([^"]+)"/)?.[1] ?? '0');
  const h = parseFloat(tag.match(/\bheight="([^"]+)"/)?.[1] ?? '0');
  return { x, y, w, h };
}

/**
 * Extract only ABSOLUTE coordinate pairs from M and L commands in an SVG path d-string.
 * Relative commands (m, l, c, s, etc.) are ignored to avoid treating relative offsets
 * as absolute positions and producing a bogus bounding box.
 */
function parseAbsoluteCoords(d: string): Array<{ x: number; y: number }> {
  const coords: Array<{ x: number; y: number }> = [];
  // Match capital M or L followed by one or more coordinate pairs
  const re = /[ML]\s*((?:-?\d+\.?\d*)[, ]+(?:-?\d+\.?\d*)(?:[, ]+(?:-?\d+\.?\d*)[, ]+(?:-?\d+\.?\d*))*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const nums = (m[1]!.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      coords.push({ x: nums[i]!, y: nums[i + 1]! });
    }
  }
  return coords;
}

function getBBoxFromPaths(paths: string[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of paths) {
    for (const { x, y } of parseAbsoluteCoords(d)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 490, maxX: 212, maxY: 560 };
  // Add padding to account for path strokes and curves extending beyond anchor points
  const pad = 42;
  return {
    minX: Math.max(0, Math.floor(minX) - pad),
    minY: Math.max(0, Math.floor(minY) - pad),
    maxX: Math.min(212, Math.ceil(maxX) + pad),
    maxY: Math.ceil(maxY) + pad,
  };
}

/** Convert a rect to an SVG path d-string */
function rectToPath(x: number, y: number, w: number, h: number): string {
  return `M${x},${y}L${x + w},${y}L${x + w},${y + h}L${x},${y + h}Z`;
}

function extractSurfacePaths(n: number): ToothSurfacePathData {
  const svgPath = join(SVG_DIR, `tooth-${n}-column.svg`);
  const svg = readFileSync(svgPath, 'utf-8');

  const prefix = `tooth${n}`;

  // Extract the 5 zone paths from the top-view group
  // Zones: center (occlusal center), left, right, top (buccal side), bottom (lingual side)
  const zoneIds = {
    center: `${prefix}-top-center`,
    left:   `${prefix}-top-left`,
    right:  `${prefix}-top-right`,
    top:    `${prefix}-top-top`,
    bottom: `${prefix}-top-bottom`,
  };

  const zones: Record<string, ZonePath> = {};

  for (const [key, id] of Object.entries(zoneIds)) {
    const extracted = extractPathById(svg, id);
    if (extracted && extracted.d) {
      zones[key] = extracted;
    } else {
      // Try to find a rect element with this id (some teeth use rects for center)
      const rect = extractRectById(svg, id);
      if (rect) {
        zones[key] = {
          d: rectToPath(rect.x, rect.y, rect.w, rect.h),
          fill: '#fff',
        };
      } else {
        console.warn(`⚠ Tooth ${n}: missing zone path "${id}" — using fallback`);
        zones[key] = { d: '', fill: '#fff' };
      }
    }
  }

  // Compute viewBox from all zone paths
  const allDs = Object.values(zones).map((z) => z.d).filter(Boolean);
  const bbox = getBBoxFromPaths(allDs);
  const vbWidth = bbox.maxX - bbox.minX;
  const vbHeight = bbox.maxY - bbox.minY;
  const viewBox = `${bbox.minX} ${bbox.minY} ${vbWidth} ${vbHeight}`;

  return {
    viewBox,
    zones: {
      center: zones.center!,
      left:   zones.left!,
      right:  zones.right!,
      top:    zones.top!,
      bottom: zones.bottom!,
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const surfacePaths: Record<number, ToothSurfacePathData> = {};
let failCount = 0;

for (let n = 1; n <= 32; n++) {
  try {
    surfacePaths[n] = extractSurfacePaths(n);
    const zoneCount = Object.values(surfacePaths[n]!.zones).filter((z) => z.d).length;
    console.log(`✓ Tooth ${n}: ${zoneCount}/5 zones, viewBox ${surfacePaths[n]!.viewBox}`);
  } catch (err) {
    console.error(`✗ Tooth ${n}: ${err}`);
    failCount++;
  }
}

if (failCount > 0) {
  console.error(`\n${failCount} teeth failed extraction. Aborting.`);
  process.exit(1);
}

// ── Generate TypeScript output ─────────────────────────────────────────────────

function jsonToTs(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

const lines: string[] = [
  '/**',
  ' * tooth-surface-paths.ts — AUTO-GENERATED by scripts/extract-surface-paths.ts',
  ' *',
  ' * Contains top-view (occlusal/incisal) 5-zone surface map path data for all 32 teeth.',
  ' * Universal numbering (1-32).',
  ' * Re-generate: bun scripts/extract-surface-paths.ts',
  ' */',
  '',
  '/* eslint-disable */',
  '',
  'export interface ZonePath {',
  '  d: string;',
  '  fill: string;',
  '}',
  '',
  'export interface ToothSurfacePathData {',
  '  /** ViewBox cropped to the occlusal/top-view section */',
  '  viewBox: string;',
  '  zones: {',
  '    /** Occlusal/incisal center zone */',
  '    center: ZonePath;',
  '    /** Left zone (mesial or distal depending on quadrant) */',
  '    left: ZonePath;',
  '    /** Right zone (distal or mesial depending on quadrant) */',
  '    right: ZonePath;',
  '    /** Top zone (buccal/labial) */',
  '    top: ZonePath;',
  '    /** Bottom zone (lingual/palatal) */',
  '    bottom: ZonePath;',
  '  };',
  '}',
  '',
  'export const TOOTH_SURFACE_PATHS: Record<number, ToothSurfacePathData> = {',
];

for (let n = 1; n <= 32; n++) {
  const data = surfacePaths[n]!;
  lines.push(`  ${n}: ${jsonToTs(data)},`);
}

lines.push('};');
lines.push('');

const output = lines.join('\n');
writeFileSync(OUT_FILE, output, 'utf-8');
console.log(`\n✅ Written to ${OUT_FILE}`);
