import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatsBar from './StatsBar'

const closestNEO = {
  name: '(2099 XX1)',
  miss_distance_km: 1_420_000,
}

describe('StatsBar', () => {
  it('shows dashes while loading', () => {
    render(<StatsBar total={0} hazardous={0} closest={null} loading={true} />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })

  it('renders total object count', () => {
    render(<StatsBar total={39} hazardous={3} closest={closestNEO} loading={false} />)
    expect(screen.getByText('39')).toBeInTheDocument()
  })

  it('renders hazardous count', () => {
    render(<StatsBar total={39} hazardous={3} closest={closestNEO} loading={false} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders safe count (total minus hazardous)', () => {
    render(<StatsBar total={39} hazardous={3} closest={closestNEO} loading={false} />)
    expect(screen.getByText('36')).toBeInTheDocument()
  })

  it('formats closest distance in millions of km', () => {
    render(<StatsBar total={10} hazardous={1} closest={closestNEO} loading={false} />)
    expect(screen.getByText('1.42M km')).toBeInTheDocument()
  })

  it('formats sub-million distances without suffix', () => {
    const near = { name: '(Close One)', miss_distance_km: 500_000 }
    render(<StatsBar total={1} hazardous={0} closest={near} loading={false} />)
    expect(screen.getByText('500,000 km')).toBeInTheDocument()
  })

  it('shows hazardous percentage', () => {
    render(<StatsBar total={10} hazardous={2} closest={closestNEO} loading={false} />)
    expect(screen.getByText('20% of tracked')).toBeInTheDocument()
  })

  it('shows closest asteroid name (stripped of parentheses)', () => {
    render(<StatsBar total={5} hazardous={1} closest={closestNEO} loading={false} />)
    expect(screen.getByText('2099 XX1')).toBeInTheDocument()
  })
})
