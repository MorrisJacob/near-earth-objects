import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./components/StarField', () => ({ default: () => null }))
vi.mock('./components/SpaceView3D', () => ({
  default: ({ neos }) => <div aria-label="3D results">{neos.map(n => n.name).join(', ')}</div>,
}))

const neos = [
  { id: '123', name: 'Alpha', is_potentially_hazardous: true, miss_distance_km: 1000, est_diameter_min_km: 0.1, est_diameter_max_km: 0.2, close_approach_date: '2026-09-26' },
  { id: '456', name: 'Beta', is_potentially_hazardous: false, miss_distance_km: 2000, est_diameter_min_km: 0.1, est_diameter_max_km: 0.2, close_approach_date: '2026-09-27' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ neos, total_objects: 2 }),
  }))
})
afterEach(() => vi.unstubAllGlobals())

it('provides navigation to existing sections and a skip link', async () => {
  render(<App />)
  await screen.findByRole('button', { name: 'View details for Alpha' })
  const links = within(screen.getByRole('navigation')).getAllByRole('link')
  for (const link of [...links, screen.getByRole('link', { name: /skip to/i })]) {
    expect(document.querySelector(link.getAttribute('href'))).toHaveAttribute('tabindex', '-1')
  }
})

it('combines name/ID search and classification, and recovers from no results in either view', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: 'View details for Alpha' })
  const search = screen.getByRole('searchbox', { name: 'Search asteroids' })
  await user.type(search, ' ALPHA ')
  expect(screen.getByRole('button', { name: 'View details for Alpha' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'View details for Beta' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Safe' }))
  expect(screen.getByText('No objects match your search and filter.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '3D View' }))
  expect(screen.getByText('No objects match your search and filter.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
  expect(search).toHaveValue('')
  expect(screen.getByLabelText('3D results')).toHaveTextContent('Alpha, Beta')
  await user.type(search, '456')
  expect(screen.getByLabelText('3D results')).toHaveTextContent('Beta')
  expect(screen.getByLabelText('3D results')).not.toHaveTextContent('Alpha')
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
})

it('opens details by keyboard, traps focus, and restores focus on close', async () => {
  const user = userEvent.setup()
  render(<App />)
  const card = await screen.findByRole('button', { name: 'View details for Alpha' })
  card.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('dialog', { name: 'Alpha' })).toBeInTheDocument()
  const close = screen.getByRole('button', { name: 'Close asteroid details' })
  expect(close).toHaveFocus()
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(close).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(card).toHaveFocus()
  await user.keyboard(' ')
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('shows a feed empty state without suggesting a filter caused it', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ neos: [], total_objects: 0 }) })
  render(<App />)
  expect(await screen.findByText('No upcoming approaches are available in this feed.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Clear search and filters' })).not.toBeInTheDocument()
})

it('offers retry after a failed request', async () => {
  fetch.mockRejectedValueOnce(new Error('Network unavailable'))
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'View details for Alpha' })).toBeInTheDocument()
})
