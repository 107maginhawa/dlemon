/**
 * extract-tooth-paths.ts — One-time codegen script
 *
 * Reads 32 column SVGs from docs/development/teeth/tooth-{1-32}-column.svg,
 * extracts front-view path data, and writes tooth-paths.ts to the workspace components.
 *
 * Usage: bun scripts/extract-tooth-paths.ts
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
  'tooth-paths.ts',
);

interface ExtractedTooth {
  viewBox: string;
  basePaths: Array<{ d: string; fill: string; stroke?: string }>;
  accentPaths: string[];
  statusZones: { right: string; left: string; top: string; bottom: string };
}

/**
 * Parse numbers from an SVG path d-attribute to compute bounding box.
 * Simple approach: extract all numeric values and find min/max for x,y coords.
 */
function computePathBBox(paths: string[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const d of paths) {
    // Extract all numbers (including negatives and decimals)
    const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    // Simple heuristic: treat pairs as (x,y) coordinates
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = nums[i]!;
      const y = nums[i + 1]!;
      if (x < 1000 && y < 1000) { // filter out obviously wrong values
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Fallback if no valid coords found
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 212, maxY: 400 };

  // Add small padding
  const pad = 5;
  return {
    minX: Math.max(0, Math.floor(minX) - pad),
    minY: Math.max(0, Math.floor(minY) - pad),
    maxX: Math.ceil(maxX) + pad,
    maxY: Math.ceil(maxY) + pad,
  };
}

function extractPathD(svgContent: string, pathId: string): string {
  // Match path with given id and extract d attribute
  const regex = new RegExp(`id="${pathId}"[^>]*?\\bd="([^"]+)"`, 's');
  const match = svgContent.match(regex);
  if (match) return match[1]!;

  // Try reverse: d before id
  const regex2 = new RegExp(`d="([^"]+)"[^>]*?id="${pathId}"`, 's');
  const match2 = svgContent.match(regex2);
  if (match2) return match2[1]!;

  return '';
}

function extractGroupPaths(svgContent: string, groupId: string): Array<{ d: string; fill: string }> {
  // Find the group by id and extract all path d-attributes within it
  const groupRegex = new RegExp(`<g[^>]*id="${groupId}"[^>]*>(.*?)</g>`, 's');
  const groupMatch = svgContent.match(groupRegex);
  if (!groupMatch) return [];

  const groupContent = groupMatch[1]!;
  const paths: Array<{ d: string; fill: string }> = [];
  const pathRegex = /<path[^>]*>/g;
  let m: RegExpExecArray | null;

  while ((m = pathRegex.exec(groupContent)) !== null) {
    const pathTag = m[0]!;
    const dMatch = pathTag.match(/\bd="([^"]+)"/);
    if (!dMatch) continue;

    // Extract fill from style or attribute
    let fill = '#fff';
    const styleMatch = pathTag.match(/style="([^"]*)"/);
    if (styleMatch) {
      const fillMatch = styleMatch[1]!.match(/fill:([^;]+)/);
      if (fillMatch) fill = fillMatch[1]!.trim();
    }
    const fillAttr = pathTag.match(/\bfill="([^"]+)"/);
    if (fillAttr) fill = fillAttr[1]!;

    paths.push({ d: dMatch[1]!, fill });
  }

  // Also extract ellipses as simplified paths
  const ellipseRegex = /<ellipse[^>]*>/g;
  while ((m = ellipseRegex.exec(groupContent)) !== null) {
    const tag = m[0]!;
    const cx = Number(tag.match(/cx="([^"]+)"/)?.[1] ?? 0);
    const cy = Number(tag.match(/cy="([^"]+)"/)?.[1] ?? 0);
    const rx = Number(tag.match(/rx="([^"]+)"/)?.[1] ?? 0);
    const ry = Number(tag.match(/ry="([^"]+)"/)?.[1] ?? 0);
    // Convert ellipse to path
    const d = `M${cx - rx},${cy}A${rx},${ry},0,1,0,${cx + rx},${cy}A${rx},${ry},0,1,0,${cx - rx},${cy}Z`;

    let fill = '#fff';
    const styleMatch = tag.match(/style="([^"]*)"/);
    if (styleMatch) {
      const fillMatch = styleMatch[1]!.match(/fill:([^;]+)/);
      if (fillMatch) fill = fillMatch[1]!.trim();
    }

    paths.push({ d, fill });
  }

  return paths;
}

function extractTooth(n: number): ExtractedTooth {
  const svgPath = join(SVG_DIR, `tooth-${n}-column.svg`);
  const svg = readFileSync(svgPath, 'utf-8');

  const prefix = `tooth${n}`;
  const baseId = `tooth-${n}-front-base-shape`;

  // Extract base shape group paths
  const basePaths = extractGroupPaths(svg, baseId);
  if (basePaths.length === 0) {
    console.warn(`⚠ Tooth ${n}: no base paths found in group "${baseId}"`);
  }

  // Extract accent paths
  const accentGroup = extractGroupPaths(svg, `${prefix}-accents`);
  const accentPaths = accentGroup.map((p) => p.d);

  // Extract status zone paths
  const statusZones = {
    right: extractPathD(svg, 'front-right'),
    left: extractPathD(svg, 'front-left'),
    top: extractPathD(svg, 'front-top'),
    bottom: extractPathD(svg, 'front-bottom'),
  };

  // Compute viewBox from all paths
  const allDs = [
    ...basePaths.map((p) => p.d),
    ...accentPaths,
    ...Object.values(statusZones).filter(Boolean),
  ];
  const bbox = computePathBBox(allDs);
  const viewBox = `${bbox.minX} ${bbox.minY} ${bbox.maxX - bbox.minX} ${bbox.maxY - bbox.minY}`;

  return {
    viewBox,
    basePaths: basePaths.map((p) => ({ d: p.d, fill: p.fill, stroke: undefined })),
    accentPaths,
    statusZones,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const teeth: Record<number, ExtractedTooth> = {};
let failCount = 0;

for (let n = 1; n <= 32; n++) {
  try {
    teeth[n] = extractTooth(n);
    const pathCount = teeth[n]!.basePaths.length + teeth[n]!.accentPaths.length;
    console.log(`✓ Tooth ${n}: ${pathCount} paths, viewBox ${teeth[n]!.viewBox}`);
  } catch (err) {
    console.error(`✗ Tooth ${n}: ${err}`);
    failCount++;
  }
}

if (failCount > 0) {
  console.error(`\n${failCount} teeth failed extraction. Aborting.`);
  process.exit(1);
}

// Generate TypeScript output
const lines: string[] = [
  '/**',
  ' * tooth-paths.ts — AUTO-GENERATED by scripts/extract-tooth-paths.ts',
  ' *',
  ' * Contains front-view path data for 32 teeth (Universal numbering 1-32).',
  ' * Re-generate: bun scripts/extract-tooth-paths.ts',
  ' */',
  '',
  '/* eslint-disable */',
  '',
  'export interface ToothPathData {',
  '  viewBox: string;',
  '  basePaths: Array<{ d: string; fill: string }>;',
  '  accentPaths: string[];',
  '  statusZones: { right: string; left: string; top: string; bottom: string };',
  '}',
  '',
  'export const TOOTH_PATHS: Record<number, ToothPathData> = {',
];

for (let n = 1; n <= 32; n++) {
  const t = teeth[n]!;
  lines.push(`  ${n}: {`);
  lines.push(`    viewBox: ${JSON.stringify(t.viewBox)},`);
  lines.push(`    basePaths: ${JSON.stringify(t.basePaths)},`);
  lines.push(`    accentPaths: ${JSON.stringify(t.accentPaths)},`);
  lines.push(`    statusZones: ${JSON.stringify(t.statusZones)},`);
  lines.push(`  },`);
}

lines.push('};');
lines.push('');

writeFileSync(OUT_FILE, lines.join('\n'), 'utf-8');
console.log(`\n✓ Wrote ${OUT_FILE}`);
console.log(`  ${Object.keys(teeth).length} teeth, ${lines.length} lines`);
