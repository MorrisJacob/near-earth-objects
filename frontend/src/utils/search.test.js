import { describe, expect, it } from 'vitest'
import { matchesSearch } from './search'

const neo = { name: '433 Eros (1898 DQ)', id: 2000433, close_approach_date: '2026-10-12' }

describe('matchesSearch', () => {
  it.each(['', '   ', ' EROS ', '(1898 DQ)', 'dq   1898', '2000433', '2026-10-12', 'eros 2026-10-12', '433 DQ'])('matches %j', query => {
    expect(matchesSearch(neo, query)).toBe(true)
  })

  it.each(['unknown', 'eros 2026-10-13', 'eros 999999'])('requires every term to match for %j', query => {
    expect(matchesSearch(neo, query)).toBe(false)
  })

  it('handles missing optional fields without matching their string representations', () => {
    expect(matchesSearch({ id: '123' }, '123')).toBe(true)
    expect(matchesSearch({ id: '123' }, 'undefined')).toBe(false)
  })
})
