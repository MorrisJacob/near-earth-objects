import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import FilterBar from './FilterBar'

function setup(overrides = {}) {
  const props = {
    filter: 'all',
    setFilter: vi.fn(),
    sortBy: 'date',
    setSortBy: vi.fn(),
    onRefresh: vi.fn(),
    loading: false,
    count: 12,
    view: 'grid',
    setView: vi.fn(),
    ...overrides,
  }
  render(<FilterBar {...props} />)
  return props
}

describe('FilterBar', () => {
  it('renders all three filter buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hazardous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /safe/i })).toBeInTheDocument()
  })

  it('calls setFilter with "hazardous" when that button is clicked', async () => {
    const { setFilter } = setup()
    await userEvent.click(screen.getByRole('button', { name: /hazardous/i }))
    expect(setFilter).toHaveBeenCalledWith('hazardous')
  })

  it('calls setFilter with "safe" when that button is clicked', async () => {
    const { setFilter } = setup()
    await userEvent.click(screen.getByRole('button', { name: /safe/i }))
    expect(setFilter).toHaveBeenCalledWith('safe')
  })

  it('calls setFilter with "all" when All button is clicked', async () => {
    const { setFilter } = setup({ filter: 'hazardous' })
    await userEvent.click(screen.getByRole('button', { name: /^all$/i }))
    expect(setFilter).toHaveBeenCalledWith('all')
  })

  it('calls setSortBy when sort select changes', async () => {
    const { setSortBy } = setup()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'distance')
    expect(setSortBy).toHaveBeenCalledWith('distance')
  })

  it('shows all four sort options', () => {
    setup()
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /date/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /distance/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /size/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /speed/i })).toBeInTheDocument()
  })

  it('calls onRefresh when refresh button is clicked', async () => {
    const { onRefresh } = setup()
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('disables refresh button while loading', () => {
    setup({ loading: true })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
  })

  it('displays the object count badge', () => {
    setup({ count: 7 })
    expect(screen.getByText('7 objects')).toBeInTheDocument()
  })

  it('renders Grid and 3D View toggle buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3d view/i })).toBeInTheDocument()
  })

  it('calls setView with "3d" when 3D View button is clicked', async () => {
    const { setView } = setup({ view: 'grid' })
    await userEvent.click(screen.getByRole('button', { name: /3d view/i }))
    expect(setView).toHaveBeenCalledWith('3d')
  })

  it('calls setView with "grid" when Grid button is clicked', async () => {
    const { setView } = setup({ view: '3d' })
    await userEvent.click(screen.getByRole('button', { name: /grid/i }))
    expect(setView).toHaveBeenCalledWith('grid')
  })

  it('disables sort select when in 3D view', () => {
    setup({ view: '3d' })
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('enables sort select when in grid view', () => {
    setup({ view: 'grid' })
    expect(screen.getByRole('combobox')).not.toBeDisabled()
  })
})
