// Keep headings and object keys together so column order cannot drift between
// the header and data rows when fields are added.
const columns = [
  ['ID', 'id'],
  ['Name', 'name'],
  ['NASA URL', 'nasa_url'],
  ['Absolute Magnitude', 'absolute_magnitude'],
  ['Estimated Diameter Min (km)', 'est_diameter_min_km'],
  ['Estimated Diameter Max (km)', 'est_diameter_max_km'],
  ['Potentially Hazardous', 'is_potentially_hazardous'],
  ['Close Approach Date', 'close_approach_date'],
  ['Close Approach Time', 'close_approach_time'],
  ['Miss Distance (km)', 'miss_distance_km'],
  ['Miss Distance (lunar)', 'miss_distance_lunar'],
  ['Relative Velocity (km/h)', 'relative_velocity_kmh'],
  ['Orbiting Body', 'orbiting_body'],
]

function escapeCsvValue(value) {
  // Quoting every field handles commas and line breaks; doubled quotes are the
  // RFC 4180 escape sequence understood by spreadsheet applications.
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export function objectsToCsv(objects) {
  const rows = [columns.map(([heading]) => escapeCsvValue(heading))]
  for (const object of objects) {
    rows.push(columns.map(([, key]) => escapeCsvValue(object[key])))
  }
  return rows.map(row => row.join(',')).join('\r\n')
}

export function downloadObjectsCsv(objects) {
  // A UTF-8 BOM helps Excel detect the encoding instead of interpreting names
  // with non-ASCII characters using the system legacy code page.
  const blob = new Blob(['\uFEFF', objectsToCsv(objects)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `interstellar-objects-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Object URLs retain the Blob until revoked, so release it after the browser
  // has received the synthetic click.
  URL.revokeObjectURL(url)
}
