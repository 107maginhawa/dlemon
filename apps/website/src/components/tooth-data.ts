// Tooth surface mapping + SVG id transform, ported verbatim from the product
// (apps/dentalemon .../dental/types.ts). Lets us color a specific tooth SURFACE
// (occlusal / mesial / distal / buccal …) instead of the whole tooth, matching
// the real chart. Pure functions, no deps.

export type ToothType = "molar" | "pre-molar" | "incisor" | "canine"

interface ToothInfo {
  type: ToothType
  arch: "upper" | "lower"
  quadrant: 1 | 2 | 3 | 4
}

// Universal (1-32) → anatomy. Only the fields the mapping needs.
export const UNIVERSAL_TOOTH_MAP: Record<number, ToothInfo> = {
  1: { type: "molar", arch: "upper", quadrant: 1 },
  2: { type: "molar", arch: "upper", quadrant: 1 },
  3: { type: "molar", arch: "upper", quadrant: 1 },
  4: { type: "pre-molar", arch: "upper", quadrant: 1 },
  5: { type: "pre-molar", arch: "upper", quadrant: 1 },
  6: { type: "canine", arch: "upper", quadrant: 1 },
  7: { type: "incisor", arch: "upper", quadrant: 1 },
  8: { type: "incisor", arch: "upper", quadrant: 1 },
  9: { type: "incisor", arch: "upper", quadrant: 2 },
  10: { type: "incisor", arch: "upper", quadrant: 2 },
  11: { type: "canine", arch: "upper", quadrant: 2 },
  12: { type: "pre-molar", arch: "upper", quadrant: 2 },
  13: { type: "pre-molar", arch: "upper", quadrant: 2 },
  14: { type: "molar", arch: "upper", quadrant: 2 },
  15: { type: "molar", arch: "upper", quadrant: 2 },
  16: { type: "molar", arch: "upper", quadrant: 2 },
  17: { type: "molar", arch: "lower", quadrant: 3 },
  18: { type: "molar", arch: "lower", quadrant: 3 },
  19: { type: "molar", arch: "lower", quadrant: 3 },
  20: { type: "pre-molar", arch: "lower", quadrant: 3 },
  21: { type: "pre-molar", arch: "lower", quadrant: 3 },
  22: { type: "canine", arch: "lower", quadrant: 3 },
  23: { type: "incisor", arch: "lower", quadrant: 3 },
  24: { type: "incisor", arch: "lower", quadrant: 3 },
  25: { type: "incisor", arch: "lower", quadrant: 4 },
  26: { type: "incisor", arch: "lower", quadrant: 4 },
  27: { type: "canine", arch: "lower", quadrant: 4 },
  28: { type: "pre-molar", arch: "lower", quadrant: 4 },
  29: { type: "pre-molar", arch: "lower", quadrant: 4 },
  30: { type: "molar", arch: "lower", quadrant: 4 },
  31: { type: "molar", arch: "lower", quadrant: 4 },
  32: { type: "molar", arch: "lower", quadrant: 4 },
}

interface SurfaceMapping {
  left: string
  right: string
  top: string
  bottom: string
  center: string
}

function getSurfaceMapping(toothNumber: number): SurfaceMapping {
  const info = UNIVERSAL_TOOTH_MAP[toothNumber]
  if (!info) throw new Error(`Invalid tooth number: ${toothNumber}`)
  const { type, arch, quadrant } = info
  const isAnterior = type === "canine" || type === "incisor"
  const isUpper = arch === "upper"
  const isRightSide = quadrant === 1 || quadrant === 4
  return {
    left: isRightSide ? "distal" : "mesial",
    right: isRightSide ? "mesial" : "distal",
    top: isAnterior ? "labial" : "buccal",
    bottom: isUpper ? "palatal" : "lingual",
    center: isAnterior ? "incisal" : "occlusal",
  }
}

function getCervicalMapping(toothNumber: number): { front: string; back: string } {
  const info = UNIVERSAL_TOOTH_MAP[toothNumber]
  if (!info) return { front: "cervicalbuccal", back: "cervicalpalatal" }
  const { type, arch } = info
  const isAnterior = type === "canine" || type === "incisor"
  const isUpper = arch === "upper"
  return {
    front: isAnterior ? "cervicallabial" : "cervicalbuccal",
    back: isUpper ? "cervicalpalatal" : "cervicallingual",
  }
}

// Rename the SVG's generic shape ids to anatomical surface ids
// (tooth-{N}_{surface}) so applySurfaceColors can target individual surfaces.
export function transformSvgIds(svgContent: string, toothNumber: number): string {
  const mapping = getSurfaceMapping(toothNumber)
  const cervicalMapping = getCervicalMapping(toothNumber)
  const isLower = UNIVERSAL_TOOTH_MAP[toothNumber]?.arch === "lower"

  return svgContent
    .replace(/id="tooth-\d+-front-base-shape"/g, `id="tooth-${toothNumber}_${mapping.top}"`)
    .replace(/id="front-left"/g, `id="tooth-${toothNumber}_${mapping.left}"`)
    .replace(/id="front-right"/g, `id="tooth-${toothNumber}_${mapping.right}"`)
    .replace(/id="front-top"/g, `id="tooth-${toothNumber}_${isLower ? mapping.center + "4" : cervicalMapping.front}"`)
    .replace(/id="front-bottom"/g, `id="tooth-${toothNumber}_${isLower ? cervicalMapping.front : mapping.center + "4"}"`)
    .replace(/id="tooth\d+-back-view-base-shape"/g, `id="tooth-${toothNumber}_${mapping.bottom}"`)
    .replace(/id="back-left"/g, `id="tooth-${toothNumber}_${mapping.left}1"`)
    .replace(/id="back-right"/g, `id="tooth-${toothNumber}_${mapping.right}1"`)
    .replace(/id="back-top"/g, `id="tooth-${toothNumber}_${isLower ? cervicalMapping.back : mapping.center + "5"}"`)
    .replace(/id="back-bottom"/g, `id="tooth-${toothNumber}_${isLower ? mapping.center + "5" : cervicalMapping.back}"`)
    .replace(/id="tooth\d+-top-left"/g, `id="tooth-${toothNumber}_${mapping.left}2"`)
    .replace(/id="tooth\d+-top-right"/g, `id="tooth-${toothNumber}_${mapping.right}2"`)
    .replace(/id="tooth\d+-top-top"/g, `id="tooth-${toothNumber}_${mapping.top}2"`)
    .replace(/id="tooth\d+-top-bottom"/g, `id="tooth-${toothNumber}_${mapping.bottom}2"`)
    .replace(/id="tooth\d+-top-center"/g, `id="tooth-${toothNumber}_${mapping.center}"`)
}

export interface SurfaceStatus {
  surface: string
  colorCoding: string
}

// Apply colors to an SVG string via DOMParser. fillColor = whole tooth (crowns,
// whole-tooth states); surfacesStatus = paint specific surfaces only.
export function applyColors(
  svgContent: string,
  toothNumber: number,
  options: { fillColor?: string; surfacesStatus?: SurfaceStatus[] },
): string {
  const { fillColor, surfacesStatus } = options
  if (!svgContent) return svgContent
  if (!fillColor && (!surfacesStatus || surfacesStatus.length === 0)) return svgContent

  const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml")

  if (fillColor) {
    doc.querySelectorAll("path, polygon, rect, circle, ellipse").forEach((el) => {
      if (!(el instanceof SVGElement)) return
      const fillAttr = el.getAttribute("fill")
      const styleFill = el.style.fill
      const inline = el.getAttribute("style") ?? ""
      const hasFillInStyle = inline.includes("fill:") && !inline.includes("fill:none")
      const hasFill =
        (fillAttr && fillAttr !== "none" && fillAttr !== "transparent") ||
        (styleFill && styleFill !== "none" && styleFill !== "transparent") ||
        hasFillInStyle
      if (hasFill) el.style.fill = fillColor
    })
  } else if (surfacesStatus?.length) {
    surfacesStatus.forEach((status) => {
      const surfaceName = status.surface.toLowerCase()
      const idPrefix = `tooth-${toothNumber}`
      for (let i = 0; i <= 5; i++) {
        const suffix = i === 0 ? "" : String(i)
        doc.querySelectorAll(`[id="${idPrefix}_${surfaceName}${suffix}"]`).forEach((el) => {
          if (el instanceof SVGElement) el.style.fill = status.colorCoding
        })
      }
    })
  }

  return new XMLSerializer().serializeToString(doc)
}

// FDI (11-48) → Universal (1-32).
export const FDI_TO_UNIVERSAL: Record<number, number> = {
  11: 8, 12: 7, 13: 6, 14: 5, 15: 4, 16: 3, 17: 2, 18: 1,
  21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
  31: 24, 32: 23, 33: 22, 34: 21, 35: 20, 36: 19, 37: 18, 38: 17,
  41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
}
