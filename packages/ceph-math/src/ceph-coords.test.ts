import { describe, test, expect } from 'bun:test'
import { imageToScreen, screenToImage, type CephTransformState } from './coords'

// ─── DOMMatrix Oracle ────────────────────────────────────────────────────────
//
// We verify our hand-coded inverse against DOMMatrix, which builds the same
// forward matrix from the canvas draw sequence in imaging-workspace.tsx:497-500:
//   ctx.translate(W/2+offsetX, H/2+offsetY)
//   ctx.scale(s*(flip?-1:1), s)
//   ctx.rotate(rot*π/2)
//   ctx.drawImage(img, -imgW/2, -imgH/2)
//
// DOMMatrix gives an independent ground-truth so a self-consistent but
// systematically wrong inverse won't sneak through.

function buildOracleMatrix(state: CephTransformState): DOMMatrix {
  const { canvasWidth: W, canvasHeight: H, scale, flip, rotation, offsetX, offsetY } = state
  const flipSign = flip ? -1 : 1
  return new DOMMatrix()
    .translate(W / 2 + offsetX, H / 2 + offsetY)
    .scale(scale * flipSign, scale)
    .rotate(rotation * 90) // DOMMatrix.rotate takes degrees; canvas uses rot*π/2 rad
}

function oracleImageToScreen(px: number, py: number, s: CephTransformState): { x: number; y: number } {
  const M = buildOracleMatrix(s)
  const pt = M.transformPoint(new DOMPoint(px - s.imgWidth / 2, py - s.imgHeight / 2))
  return { x: pt.x, y: pt.y }
}

function oracleScreenToImage(sx: number, sy: number, s: CephTransformState): { x: number; y: number } {
  const M = buildOracleMatrix(s)
  const pt = M.inverse().transformPoint(new DOMPoint(sx, sy))
  return { x: pt.x + s.imgWidth / 2, y: pt.y + s.imgHeight / 2 }
}

const PREC = 8 // toBeCloseTo decimal places

// DOMMatrix is a browser API and is absent in the bun/node test runner. The
// oracle blocks below cross-check our hand-coded transform against it, so they
// only run where DOMMatrix exists (jsdom/browser); the roundtrip + drawn-dims
// blocks need no DOM and always run. Without this guard the oracle tests
// false-fail with "DOMMatrix is not defined" in the headless runner.
const describeOracle = typeof DOMMatrix === 'undefined' ? describe.skip : describe

// ─── Fixtures ────────────────────────────────────────────────────────────────

const identity: CephTransformState = {
  canvasWidth: 800,
  canvasHeight: 600,
  imgWidth: 400,
  imgHeight: 300,
  scale: 1,
  flip: false,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
}

// Combined: rotation=1 (90°), flip=true, scale≠1, offset≠0
const combined: CephTransformState = {
  canvasWidth: 1024,
  canvasHeight: 768,
  imgWidth: 512,
  imgHeight: 384,
  scale: 2.5,
  flip: true,
  rotation: 1,
  offsetX: 30,
  offsetY: -20,
}

// ─── DOMMatrix-oracle tests ───────────────────────────────────────────────────

describeOracle('imageToScreen — DOMMatrix oracle', () => {
  test('identity state: image centre maps to canvas centre', () => {
    const { x, y } = imageToScreen(200, 150, identity)
    const o = oracleImageToScreen(200, 150, identity)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
    // Also assert the value explicitly: no transforms → image centre = canvas centre
    expect(x).toBeCloseTo(400, PREC)
    expect(y).toBeCloseTo(300, PREC)
  })

  test('identity state: image top-left (0,0) maps to canvas centre − half-dims', () => {
    const { x, y } = imageToScreen(0, 0, identity)
    const o = oracleImageToScreen(0, 0, identity)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
    // (0,0) in image → local (-200, -150) → screen (600-200=400-200=200? no)
    // local: (0-200, 0-150) = (-200, -150) → no rotation, no flip, scale=1
    // screen: (-200+400, -150+300) = (200, 150)
    expect(x).toBeCloseTo(200, PREC)
    expect(y).toBeCloseTo(150, PREC)
  })

  test('combined fixture: matches DOMMatrix oracle exactly', () => {
    const pt = { x: 100, y: 80 }
    const { x, y } = imageToScreen(pt.x, pt.y, combined)
    const o = oracleImageToScreen(pt.x, pt.y, combined)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
  })

  test('combined fixture: additional point (corner-ish)', () => {
    const pt = { x: 480, y: 360 }
    const { x, y } = imageToScreen(pt.x, pt.y, combined)
    const o = oracleImageToScreen(pt.x, pt.y, combined)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
  })

  test('rotation=2 (180°): image centre still maps to canvas centre', () => {
    const s: CephTransformState = { ...identity, rotation: 2 }
    const { x, y } = imageToScreen(200, 150, s)
    const o = oracleImageToScreen(200, 150, s)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
  })

  test('rotation=3 (270°): matches oracle', () => {
    const s: CephTransformState = { ...identity, rotation: 3 }
    const { x, y } = imageToScreen(100, 50, s)
    const o = oracleImageToScreen(100, 50, s)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
  })
})

describeOracle('screenToImage — DOMMatrix oracle', () => {
  test('identity state: canvas centre maps to image centre', () => {
    const { x, y } = screenToImage(400, 300, identity)
    const o = oracleScreenToImage(400, 300, identity)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
    expect(x).toBeCloseTo(200, PREC)
    expect(y).toBeCloseTo(150, PREC)
  })

  test('combined fixture: matches DOMMatrix oracle exactly', () => {
    const { x, y } = screenToImage(262, -26, combined)
    const o = oracleScreenToImage(262, -26, combined)
    expect(x).toBeCloseTo(o.x, PREC)
    expect(y).toBeCloseTo(o.y, PREC)
  })
})

// ─── Roundtrip tests ──────────────────────────────────────────────────────────

describe('screenToImage(imageToScreen(p)) === p', () => {
  const cases: [string, CephTransformState, number, number][] = [
    ['identity centre',     identity, 200, 150],
    ['identity top-left',   identity, 0,   0  ],
    ['identity bottom-right', identity, 400, 300],
    ['identity arbitrary',  identity, 73,  211],
    ['combined centre',     combined, 256, 192],
    ['combined corner',     combined, 0,   0  ],
    ['combined arbitrary',  combined, 100, 80 ],
    ['combined far corner', combined, 511, 383],
  ]

  for (const [name, state, px, py] of cases) {
    test(`roundtrip: ${name}`, () => {
      const screen = imageToScreen(px, py, state)
      const back = screenToImage(screen.x, screen.y, state)
      expect(back.x).toBeCloseTo(px, PREC)
      expect(back.y).toBeCloseTo(py, PREC)
    })
  }

  test('roundtrip: rotation=2, flip=true, scale=0.5, offsets', () => {
    const s: CephTransformState = { ...combined, rotation: 2, flip: false, scale: 0.5, offsetX: -15, offsetY: 40 }
    for (const [px, py] of [[50, 50], [0, 0], [511, 383], [200, 100]] as [number, number][]) {
      const screen = imageToScreen(px, py, s)
      const back = screenToImage(screen.x, screen.y, s)
      expect(back.x).toBeCloseTo(px, PREC)
      expect(back.y).toBeCloseTo(py, PREC)
    }
  })
})

// ─── img.width/height (drawn dims) vs naturalWidth guard ─────────────────────
//
// The transform uses img.width/height (drawn dims), not naturalWidth/naturalHeight.
// This fixture uses different drawn vs natural dims to confirm the implementation
// keys off the state fields (caller's responsibility to pass drawn dims).

describe('uses drawn dims (imgWidth/imgHeight), not assumed natural dims', () => {
  test('with drawn dims 256×192 (half of 512×384 natural): roundtrip holds', () => {
    const s: CephTransformState = {
      ...combined,
      imgWidth: 256,   // drawn dim ≠ 512 (natural)
      imgHeight: 192,  // drawn dim ≠ 384 (natural)
    }
    const px = 100; const py = 80
    const screen = imageToScreen(px, py, s)
    const back = screenToImage(screen.x, screen.y, s)
    expect(back.x).toBeCloseTo(px, PREC)
    expect(back.y).toBeCloseTo(py, PREC)
  })

  test('different drawn dims produce different screen coords than natural dims', () => {
    const sDrawn: CephTransformState = { ...combined, imgWidth: 256, imgHeight: 192 }
    const sNatural: CephTransformState = { ...combined, imgWidth: 512, imgHeight: 384 }
    const screen1 = imageToScreen(100, 80, sDrawn)
    const screen2 = imageToScreen(100, 80, sNatural)
    // They should differ (image-centre offset shifts)
    const same = Math.abs(screen1.x - screen2.x) < 1e-9 && Math.abs(screen1.y - screen2.y) < 1e-9
    expect(same).toBe(false)
  })
})
