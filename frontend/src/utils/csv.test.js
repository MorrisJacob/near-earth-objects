import { describe, expect, it } from 'vitest'
import { objectsToCsv } from './csv'

describe('objectsToCsv', () => {
  it('exports object fields with a header row', () => {
    const csv = objectsToCsv([{
      id: '42',
      name: 'Comet Example',
      nasa_url: 'https://example.test/42',
      absolute_magnitude: 19.2,
      est_diameter_min_km: 0.1,
      est_diameter_max_km: 0.3,
      is_potentially_hazardous: false,
      close_approach_date: '2026-08-25',
      close_approach_time: '2026-Aug-25 12:00',
      miss_distance_km: 12345,
      miss_distance_lunar: 0.032,
      relative_velocity_kmh: 54321,
      orbiting_body: 'Earth',
    }])

    const [header, row] = csv.split('\r\n')
    expect(header).toContain('"ID","Name","NASA URL"')
    expect(row).toContain('"42","Comet Example","https://example.test/42"')
    expect(row).toContain('"false","2026-08-25"')
    expect(row).toContain('"54321","Earth"')
  })

  it('escapes quotes, commas, and line breaks according to CSV rules', () => {
    const csv = objectsToCsv([{ id: '1', name: 'A "quoted",\nobject' }])
    expect(csv).toContain('"A ""quoted"",\nobject"')
  })

  it('returns a header row for an empty list', () => {
    expect(objectsToCsv([]).split('\r\n')).toHaveLength(1)
  })
})
