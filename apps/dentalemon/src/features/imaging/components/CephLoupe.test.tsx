import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { CephLoupe } from './CephLoupe'

afterEach(cleanup)

function renderLoupe(props: Partial<React.ComponentProps<typeof CephLoupe>> = {}) {
  const merged = {
    sourceCanvas: null,
    pointer: { x: 100, y: 100 },
    selectedCode: 'S' as const,
    ...props,
  }
  return render(React.createElement(CephLoupe, merged))
}

describe('CephLoupe — fixed-corner magnifier inset', () => {
  test('renders nothing when no landmark is selected', () => {
    const { container } = renderLoupe({ selectedCode: null })
    expect(container.querySelector('[data-testid="ceph-loupe"]')).toBeNull()
  })

  test('renders nothing when the pointer is not over the image', () => {
    const { container } = renderLoupe({ pointer: null })
    expect(container.querySelector('[data-testid="ceph-loupe"]')).toBeNull()
  })

  test('renders the loupe inset when a landmark is selected and pointer is present', () => {
    const { container } = renderLoupe({ selectedCode: 'A', pointer: { x: 50, y: 60 } })
    const loupe = container.querySelector('[data-testid="ceph-loupe"]')
    expect(loupe).not.toBeNull()
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).not.toBeNull()
    // default 160px inset
    expect(canvas.width).toBe(160)
    expect(canvas.height).toBe(160)
  })

  test('shows a 4× zoom badge for a normal landmark', () => {
    const { container } = renderLoupe({ selectedCode: 'N' })
    expect(container.textContent).toContain('4×')
  })

  test('shows a 6× zoom badge for the U1 apex (hardest point)', () => {
    const { container } = renderLoupe({ selectedCode: 'U1A' })
    expect(container.textContent).toContain('6×')
  })

  test('is positioned top-right, away from the right-hand panel', () => {
    const { container } = renderLoupe({ selectedCode: 'S' })
    const loupe = container.querySelector('[data-testid="ceph-loupe"]') as HTMLElement
    expect(loupe.className).toContain('top-')
    expect(loupe.className).toContain('right-')
  })
})
