import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AsteroidCard from './AsteroidCard'

const safeNEO = {
  id: '12345',
  name: '(2099 XX1)',
  is_potentially_hazardous: false,
  miss_distance_km: 3_000_000,
  miss_distance_lunar: 7.8,
  est_diameter_min_km: 0.08,
  est_diameter_max_km: 0.18,
  relative_velocity_kmh: 45_000,
  close_approach_date: '2099-06-15',
  orbiting_body: 'Earth',
}

const hazardousNEO = {
  ...safeNEO,
  id: '99999',
  name: '(2003 LN6)',
  is_potentially_hazardous: true,
  miss_distance_km: 420_000,
  miss_distance_lunar: 1.1,
}

describe('AsteroidCard', () => {
  it('renders the asteroid name', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('(2099 XX1)')).toBeInTheDocument()
  })

  it('shows SAFE badge for non-hazardous asteroid', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('SAFE')).toBeInTheDocument()
  })

  it('shows HAZARDOUS badge for hazardous asteroid', () => {
    render(<AsteroidCard neo={hazardousNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('HAZARDOUS')).toBeInTheDocument()
  })

  it('applies hazardous CSS class for dangerous asteroids', () => {
    const { container } = render(<AsteroidCard neo={hazardousNEO} index={0} onClick={vi.fn()} />)
    expect(container.querySelector('.asteroid-card')).toHaveClass('hazardous')
  })

  it('does not apply hazardous CSS class for safe asteroids', () => {
    const { container } = render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(container.querySelector('.asteroid-card')).not.toHaveClass('hazardous')
  })

  it('displays miss distance in km', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    // 3_000_000 → "3.00M" in fmtKm
    expect(screen.getByText(/3\.00M/)).toBeInTheDocument()
  })

  it('displays lunar distance', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText(/7\.8 LD/)).toBeInTheDocument()
  })

  it('shows diameter in meters for sub-km asteroids', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    // avg of 0.08 and 0.18 = 0.13 km → 130 m
    expect(screen.getByText('130 m')).toBeInTheDocument()
  })

  it('shows diameter in km for large asteroids', () => {
    const bigNEO = { ...safeNEO, est_diameter_min_km: 1.0, est_diameter_max_km: 3.0 }
    render(<AsteroidCard neo={bigNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('2.00 km')).toBeInTheDocument()
  })

  it('displays close approach date', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText('2099-06-15')).toBeInTheDocument()
  })

  it('displays orbiting body', () => {
    render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(screen.getByText(/Earth/)).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    render(<AsteroidCard neo={safeNEO} index={0} onClick={onClick} />)
    await userEvent.click(screen.getByText('(2099 XX1)'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders distance bar fill element', () => {
    const { container } = render(<AsteroidCard neo={safeNEO} index={0} onClick={vi.fn()} />)
    expect(container.querySelector('.distance-bar-fill')).toBeInTheDocument()
  })

  it('applies "close" class to bar for very close approaches', () => {
    const { container } = render(<AsteroidCard neo={hazardousNEO} index={0} onClick={vi.fn()} />)
    expect(container.querySelector('.distance-bar-fill')).toHaveClass('close')
  })
})
