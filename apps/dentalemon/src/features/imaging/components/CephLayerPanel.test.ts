import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { CephLayerPanel, type LayerState } from './CephLayerPanel'

afterEach(cleanup)

function renderPanel(layers: Partial<LayerState> = {}) {
  const onChange = mock(() => {})
  const merged: LayerState = { landmarks: true, tracing: true, arcs: true, ...layers }
  render(React.createElement(CephLayerPanel, { layers: merged, onChange }))
  return { onChange }
}

describe('CephLayerPanel', () => {
  test('renders 3 buttons', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Landmarks' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Tracing' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Arcs' })).not.toBeNull()
  })

  test('each has correct aria-pressed initial state', () => {
    renderPanel({ landmarks: true, tracing: false, arcs: true })
    expect(screen.getByRole('button', { name: 'Landmarks' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Tracing' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Arcs' }).getAttribute('aria-pressed')).toBe('true')
  })

  test('clicking a button calls onChange with the key and toggled boolean', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPanel({ tracing: true })
    await user.click(screen.getByRole('button', { name: 'Tracing' }))
    expect(onChange).toHaveBeenCalledWith('tracing', false)
  })

  test('active button (true) has aria-pressed="true"', () => {
    renderPanel({ arcs: true })
    expect(screen.getByRole('button', { name: 'Arcs' }).getAttribute('aria-pressed')).toBe('true')
  })
})
