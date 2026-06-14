import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AsteroidModal from './AsteroidModal'

const neo = {
  id: '54321',
  name: '(2003 LN6)',
  nasa_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=54321',
  absolute_magnitude: 22.1,
  est_diameter_min_km: 0.05,
  est_diameter_max_km: 0.11,
  is_potentially_hazardous: true,
  close_approach_date: '2099-07-04',
  miss_distance_km: 1_420_000,
  miss_distance_lunar: 3.69,
  relative_velocity_kmh: 72_000,
  orbiting_body: 'Earth',
}

describe('AsteroidModal', () => {
  it('renders the asteroid name', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText('(2003 LN6)')).toBeInTheDocument()
  })

  it('renders the NEO ID', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText(/NEO ID: 54321/)).toBeInTheDocument()
  })

  it('shows hazardous badge for dangerous asteroid', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText('Potentially Hazardous')).toBeInTheDocument()
  })

  it('shows safe badge for non-hazardous asteroid', () => {
    const safeNeo = { ...neo, is_potentially_hazardous: false }
    render(<AsteroidModal neo={safeNeo} onClose={vi.fn()} />)
    expect(screen.getByText('Safe Approach')).toBeInTheDocument()
  })

  it('shows orbiting body badge', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText('Orbiting: Earth')).toBeInTheDocument()
  })

  it('renders close approach date', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText('2099-07-04')).toBeInTheDocument()
  })

  it('renders lunar distance', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText(/3\.69/)).toBeInTheDocument()
  })

  it('renders absolute magnitude', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText(/22\.10/)).toBeInTheDocument()
  })

  it('renders a link to NASA JPL', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: /nasa jpl/i })
    expect(link).toHaveAttribute('href', neo.nasa_url)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<AsteroidModal neo={neo} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn()
    render(<AsteroidModal neo={neo} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders the orbit SVG visualization', () => {
    const { container } = render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(container.querySelector('svg.orbit-svg')).toBeInTheDocument()
  })

  it('renders section titles for physical properties and approach data', () => {
    render(<AsteroidModal neo={neo} onClose={vi.fn()} />)
    expect(screen.getByText('Physical Properties')).toBeInTheDocument()
    expect(screen.getByText('Close Approach Data')).toBeInTheDocument()
  })
})
