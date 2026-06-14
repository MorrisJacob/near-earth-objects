function fmtKm(km) {
  if (!km) return '—'
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)}M`
  if (km >= 1e3) return `${(km / 1e3).toFixed(0)}K`
  return km.toFixed(0)
}

function distancePercent(km) {
  // Cap the progress bar at 10 M km. Beyond that distance the visual difference
  // is imperceptible, and most NEOs in the feed are well under 10 M km.
  const MAX = 10_000_000
  return Math.min((km / MAX) * 100, 100)
}

function distClass(km) {
  if (km < 500_000) return 'close'
  if (km < 2_000_000) return 'medium'
  return ''
}

export default function AsteroidCard({ neo, index, onClick }) {
  const pct = distancePercent(neo.miss_distance_km)
  const dc = distClass(neo.miss_distance_km)

  const diamAvg = ((neo.est_diameter_min_km + neo.est_diameter_max_km) / 2)
  const diamStr = diamAvg < 1
    ? `${Math.round(diamAvg * 1000)} m`
    : `${diamAvg.toFixed(2)} km`

  const speedStr = neo.relative_velocity_kmh
    ? `${Math.round(neo.relative_velocity_kmh / 1000).toLocaleString()}K km/h`
    : '—'

  return (
    <div
      className={`asteroid-card${neo.is_potentially_hazardous ? ' hazardous' : ''}`}
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}  /* cap at 400 ms so late cards don't wait too long */
      onClick={onClick}
    >
      <div className="card-top-line" />

      <div className="card-header">
        <div className="asteroid-name">{neo.name}</div>
        <div className={`hazard-badge ${neo.is_potentially_hazardous ? 'danger' : 'safe'}`}>
          <div className="pulse-dot" />
          {neo.is_potentially_hazardous ? 'HAZARDOUS' : 'SAFE'}
        </div>
      </div>

      <div className="distance-section">
        <div className="distance-label">
          <span className="dlabel-text">Miss Distance</span>
          <div>
            <span className="dlabel-value">{fmtKm(neo.miss_distance_km)} km</span>
            <span className="dlabel-lunar"> / {neo.miss_distance_lunar?.toFixed(1)} LD</span>
          </div>
        </div>
        <div className="distance-bar-track">
          <div
            className={`distance-bar-fill ${dc}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="card-stats">
        <div className="card-stat">
          <div className="cs-label">Diameter</div>
          <div className="cs-value">{diamStr}</div>
        </div>
        <div className="card-stat">
          <div className="cs-label">Speed</div>
          <div className="cs-value" style={{fontSize: '11px'}}>{speedStr}</div>
        </div>
      </div>

      <div className="card-date">
        Close approach: <span>{neo.close_approach_date}</span>
        {neo.orbiting_body && <span style={{color:'var(--text-dim)'}}> &bull; {neo.orbiting_body}</span>}
      </div>
    </div>
  )
}
