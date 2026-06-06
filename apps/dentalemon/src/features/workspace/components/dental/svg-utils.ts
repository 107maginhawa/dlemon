import { transformSvgIds } from './types';
import type { SurfaceStatus } from './types';

// Module-level cache: toothNumber + variant → transformed SVG string
const svgCache = new Map<string, string>();

export async function loadAndPrepareSvg(
  toothNumber: number,
  variant: 'column' | 'surfacemap' = 'column',
): Promise<string> {
  const cacheKey = `${toothNumber}-${variant}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const url = `/teeth/tooth-${toothNumber}-${variant}.svg`;
  // eslint-disable-next-line no-restricted-syntax -- static public asset, not an API endpoint
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load SVG: ${url}`);

  const rawSvg = await response.text();
  const transformed = transformSvgIds(rawSvg, toothNumber);
  svgCache.set(cacheKey, transformed);
  return transformed;
}

/**
 * Apply surface colors to an SVG string using DOMParser.
 * Ported from MYCURE UniversalTooth.vue applySurfaceColors().
 *
 * - fillColor mode: colors every filled shape element with the given color
 * - surfacesStatus mode: colors specific surfaces by anatomical ID
 */
export function applySurfaceColors(
  svgContent: string,
  toothNumber: number,
  options: { fillColor?: string; surfacesStatus?: SurfaceStatus[] },
): string {
  if (!svgContent) return svgContent;

  const { fillColor, surfacesStatus } = options;
  if (!fillColor && (!surfacesStatus || surfacesStatus.length === 0)) return svgContent;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');

  if (fillColor) {
    const allShapes = doc.querySelectorAll('path, polygon, rect, circle, ellipse');
    allShapes.forEach(el => {
      if (!(el instanceof SVGElement)) return;
      const fillAttr = el.getAttribute('fill');
      const styleFill = el.style.fill;
      const inlineStyle = el.getAttribute('style') ?? '';
      const hasFillInStyle = inlineStyle.includes('fill:') && !inlineStyle.includes('fill:none');

      const hasFill =
        (fillAttr && fillAttr !== 'none' && fillAttr !== 'transparent') ||
        (styleFill && styleFill !== 'none' && styleFill !== 'transparent') ||
        hasFillInStyle;

      if (hasFill) {
        el.style.fill = fillColor;
      }
    });
  } else if (surfacesStatus?.length) {
    surfacesStatus.forEach(status => {
      const surfaceName = status.surface.toLowerCase();
      const idPrefix = `tooth-${toothNumber}`;

      // Query base ID + suffixes 1-5 (multiple path elements may share a logical surface)
      for (let i = 0; i <= 5; i++) {
        const suffix = i === 0 ? '' : String(i);
        const selector = `[id="${idPrefix}_${surfaceName}${suffix}"]`;
        doc.querySelectorAll(selector).forEach(el => {
          if (el instanceof SVGElement) {
            el.style.fill = status.colorCoding;
          }
        });
      }
    });
  }

  return new XMLSerializer().serializeToString(doc);
}
