import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StarField from './StarField'

// Canvas is not implemented in jsdom — provide a minimal stub
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
  }))
  // Do NOT invoke the callback — StarField's draw() loop would recurse infinitely
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

describe('StarField', () => {
  it('renders a canvas element', () => {
    const { container } = render(<StarField />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('positions the canvas fixed and behind content', () => {
    const { container } = render(<StarField />)
    const canvas = container.querySelector('canvas')
    expect(canvas.style.position).toBe('fixed')
    expect(canvas.style.zIndex).toBe('0')
    expect(canvas.style.pointerEvents).toBe('none')
  })
})
