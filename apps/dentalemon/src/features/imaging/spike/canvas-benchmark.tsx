import { useEffect, useRef, useState } from 'react'

interface BenchmarkResult {
  firstPaintMs: number
  minFrameMs: number
  avgFrameMs: number
  maxFrameMs: number
  fps: number
  memoryMB: number | null
  passed: boolean
}

const THRESHOLDS = {
  firstPaintMs: 2000,
  minFps: 30,
  memoryMB: 300,
}

const ANNOTATION_COUNT = 10
const FRAME_COUNT = 500
const IMAGE_WIDTH = 2400
const IMAGE_HEIGHT = 1200

function generateTestImage(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)
  gradient.addColorStop(0, '#1a1a1a')
  gradient.addColorStop(0.3, '#4a4a4a')
  gradient.addColorStop(0.6, '#2a2a2a')
  gradient.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)

  for (let i = 0; i < 32; i++) {
    const x = (i / 32) * IMAGE_WIDTH + 20
    ctx.fillStyle = `rgba(200, 200, 200, ${0.3 + Math.random() * 0.4})`
    ctx.fillRect(x, IMAGE_HEIGHT * 0.2, 30, IMAGE_HEIGHT * 0.6)
  }
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  count: number,
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  for (let i = 0; i < count; i++) {
    const x = offsetX + (i / count) * IMAGE_WIDTH * scale
    const y = offsetY + IMAGE_HEIGHT * 0.4 * scale
    ctx.beginPath()
    ctx.arc(x, y, 8 * scale, 0, Math.PI * 2)
    ctx.strokeStyle = '#FFE97D'
    ctx.lineWidth = 2 * scale
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 233, 125, 0.2)'
    ctx.fill()
    ctx.fillStyle = '#FFE97D'
    ctx.font = `${12 * scale}px sans-serif`
    ctx.fillText(`Ann ${i + 1}`, x + 10 * scale, y)
  }
}

type PerfWithMemory = Performance & { memory?: { usedJSHeapSize: number } }

export function CanvasBenchmark() {
  const offscreenRef = useRef<HTMLCanvasElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [progress, setProgress] = useState(0)

  const runBenchmark = async () => {
    const offscreen = offscreenRef.current!
    const display = displayRef.current!
    offscreen.width = IMAGE_WIDTH
    offscreen.height = IMAGE_HEIGHT

    setStatus('running')
    setProgress(0)

    // First paint timing
    const t0 = performance.now()
    generateTestImage(offscreen)
    const displayCtx = display.getContext('2d')!
    display.width = Math.min(window.innerWidth - 40, IMAGE_WIDTH)
    display.height = (display.width / IMAGE_WIDTH) * IMAGE_HEIGHT
    displayCtx.drawImage(offscreen, 0, 0, display.width, display.height)
    const firstPaintMs = performance.now() - t0

    const memBefore = (performance as PerfWithMemory).memory?.usedJSHeapSize ?? null

    // RAF benchmark: 500 frames of pan + zoom
    const frameTimes: number[] = []
    let frameIndex = 0
    let prevT = performance.now()

    await new Promise<void>((resolve) => {
      const tick = () => {
        if (frameIndex >= FRAME_COUNT) {
          resolve()
          return
        }
        const now = performance.now()
        frameTimes.push(now - prevT)
        prevT = now

        const p = frameIndex / FRAME_COUNT
        const scale = 1 + Math.sin(p * Math.PI) * 0.5
        const offsetX = -Math.sin(p * Math.PI * 2) * 200
        const offsetY = -Math.cos(p * Math.PI) * 100

        displayCtx.clearRect(0, 0, display.width, display.height)
        displayCtx.save()
        displayCtx.translate(offsetX, offsetY)
        displayCtx.scale(scale, scale)
        displayCtx.drawImage(offscreen, 0, 0, display.width / scale, display.height / scale)
        drawAnnotations(displayCtx, ANNOTATION_COUNT, 0, 0, scale * (display.width / IMAGE_WIDTH))
        displayCtx.restore()

        frameIndex++
        if (frameIndex % 50 === 0) setProgress(Math.round((frameIndex / FRAME_COUNT) * 100))
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    setProgress(100)

    const memAfter = (performance as PerfWithMemory).memory?.usedJSHeapSize ?? null
    const memoryMB =
      memBefore != null && memAfter != null ? (memAfter - memBefore) / (1024 * 1024) : null

    const minFrameMs = Math.min(...frameTimes)
    const maxFrameMs = Math.max(...frameTimes)
    const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    const fps = 1000 / avgFrameMs

    const passed =
      firstPaintMs < THRESHOLDS.firstPaintMs &&
      fps >= THRESHOLDS.minFps &&
      (memoryMB == null || memoryMB < THRESHOLDS.memoryMB)

    setResult({ firstPaintMs, minFrameMs, avgFrameMs, maxFrameMs, fps, memoryMB, passed })
    setStatus('done')
  }

  const fmt = (ms: number) => `${ms.toFixed(1)}ms`
  const icon = (ok: boolean) => (ok ? '✅' : '❌')

  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'monospace',
        background: '#111',
        color: '#eee',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ color: '#FFE97D', marginBottom: 8 }}>Canvas Benchmark — iPad Rendering Spike</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        2400×1200 panoramic, {ANNOTATION_COUNT} annotations, {FRAME_COUNT} RAF frames
      </p>

      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <strong>Thresholds:</strong>{' '}
        <span style={{ color: '#aaa' }}>
          first paint &lt;{THRESHOLDS.firstPaintMs}ms · ≥{THRESHOLDS.minFps}fps · &lt;
          {THRESHOLDS.memoryMB}MB
        </span>
      </div>

      {status === 'idle' && (
        <button
          onClick={runBenchmark}
          style={{
            background: '#FFE97D',
            color: '#111',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Run Benchmark
        </button>
      )}

      {status === 'running' && <div style={{ color: '#FFE97D' }}>Running... {progress}%</div>}

      {result && status === 'done' && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: result.passed ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)',
              border: `1px solid ${result.passed ? '#0f0' : '#f00'}`,
              marginBottom: 16,
            }}
          >
            <strong style={{ fontSize: 20 }}>
              {result.passed
                ? '✅ PASS — Canvas approach approved for Phase 2'
                : '❌ FAIL — Evaluate cornerstone.js or tiled WebGL'}
            </strong>
          </div>

          <table style={{ borderCollapse: 'collapse', fontSize: 14, width: '100%', maxWidth: 540 }}>
            <tbody>
              <tr>
                <td style={{ padding: '6px 12px', color: '#aaa' }}>First paint</td>
                <td style={{ padding: '6px 12px' }}>
                  {icon(result.firstPaintMs < THRESHOLDS.firstPaintMs)} {fmt(result.firstPaintMs)}{' '}
                  <span style={{ color: '#666' }}>(threshold: &lt;{THRESHOLDS.firstPaintMs}ms)</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 12px', color: '#aaa' }}>Avg FPS</td>
                <td style={{ padding: '6px 12px' }}>
                  {icon(result.fps >= THRESHOLDS.minFps)} {result.fps.toFixed(1)} fps{' '}
                  <span style={{ color: '#666' }}>(threshold: ≥{THRESHOLDS.minFps}fps)</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 12px', color: '#aaa' }}>Frame min/avg/max</td>
                <td style={{ padding: '6px 12px' }}>
                  {fmt(result.minFrameMs)} / {fmt(result.avgFrameMs)} / {fmt(result.maxFrameMs)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '6px 12px', color: '#aaa' }}>Memory delta</td>
                <td style={{ padding: '6px 12px' }}>
                  {result.memoryMB != null
                    ? `${icon(result.memoryMB < THRESHOLDS.memoryMB)} ${result.memoryMB.toFixed(1)}MB`
                    : '⚠️ N/A (non-Chrome — use Task Manager on iPad)'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <canvas ref={offscreenRef} style={{ display: 'none' }} />
      <div style={{ marginTop: 24 }}>
        <canvas
          ref={displayRef}
          style={{ border: '1px solid #333', borderRadius: 4, maxWidth: '100%', display: 'block' }}
        />
      </div>
    </div>
  )
}
