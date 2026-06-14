import { useEffect } from 'react'

function fmt(n, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export default function AsteroidModal({ neo, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const diamAvg = (neo.est_diameter_min_km + neo.est_diameter_max_km) / 2
  const diamStr = diamAvg < 1
    ? `${Math.round(diamAvg * 1000)} m`
    : `${diamAvg.toFixed(3)} km`

  // orbitR is the ellipse semi-axis in the SVG orbit diagram. We scale it to
  // the lunar distance so nearby objects look close and distant ones look far,
  // but clamp to [50, 140] px so the asteroid always stays within the 300×200
  // SVG viewport whether the approach is sub-lunar or hundreds of LDs away.
  const lunarDist = neo.miss_distance_lunar || 10
  const orbitR = Math.min(Math.max(lunarDist * 3, 50), 140)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <div className="modal-id">NEO ID: {neo.id}</div>
          <div className="modal-name">{neo.name}</div>
          <div className="modal-badges">
            <div className={`hazard-badge ${neo.is_potentially_hazardous ? 'danger' : 'safe'}`}>
              <div className="pulse-dot" />
              {neo.is_potentially_hazardous ? 'Potentially Hazardous' : 'Safe Approach'}
            </div>
            {neo.orbiting_body && (
              <div className="hazard-badge safe">
                Orbiting: {neo.orbiting_body}
              </div>
            )}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Orbital Visualization</div>
          <div className="modal-orbit-visual">
            <svg width="300" height="200" viewBox="0 0 300 200" className="orbit-svg">
              {/* Earth */}
              <defs>
                <radialGradient id="earthGrad" cx="40%" cy="35%">
                  <stop offset="0%" stopColor="#60a5fa"/>
                  <stop offset="60%" stopColor="#1d4ed8"/>
                  <stop offset="100%" stopColor="#0f2460"/>
                </radialGradient>
                <radialGradient id="astGrad" cx="35%" cy="35%">
                  <stop offset="0%" stopColor="#94a3b8"/>
                  <stop offset="100%" stopColor="#334155"/>
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Orbit rings */}
              <ellipse cx="150" cy="100" rx={orbitR} ry={orbitR * 0.4}
                stroke="rgba(100,140,255,0.15)" strokeWidth="1" fill="none" strokeDasharray="4 4"/>

              {/* Moon orbit */}
              <ellipse cx="150" cy="100" rx="25" ry="10"
                stroke="rgba(200,200,200,0.1)" strokeWidth="0.5" fill="none"/>

              {/* Earth */}
              <circle cx="150" cy="100" r="14" fill="url(#earthGrad)" filter="url(#glow)"/>

              {/* Moon */}
              <circle cx="175" cy="98" r="4" fill="#94a3b8" opacity="0.7"/>

              {/* Asteroid */}
              {/* Asteroid size uses log scale so multi-km bodies don't dwarf the diagram */}
              <circle
                cx={150 + orbitR}
                cy={100 - orbitR * 0.08}
                r={Math.min(Math.max(Math.log(diamAvg * 1000 + 1) * 2, 3), 10)}
                fill="url(#astGrad)"
                filter="url(#glow)"
              />

              {/* Distance line */}
              <line
                x1="150" y1="100"
                x2={150 + orbitR}
                y2={100 - orbitR * 0.08}
                stroke="rgba(100,140,255,0.2)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Labels */}
              <text x="150" y="120" textAnchor="middle" fill="#6b7a96" fontSize="8" fontFamily="monospace">EARTH</text>
              <text x={150 + orbitR + 4} y={100 - orbitR * 0.08 - 8} fill="#c4b5fd" fontSize="7" fontFamily="monospace">
                {neo.miss_distance_lunar?.toFixed(1)} LD
              </text>
            </svg>
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Physical Properties</div>
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <div className="ms-label">Est. Diameter</div>
              <div className="ms-value">{diamStr}</div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Abs. Magnitude</div>
              <div className="ms-value">{neo.absolute_magnitude?.toFixed(2)}<span className="ms-unit">H</span></div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Min Diameter</div>
              <div className="ms-value">{(neo.est_diameter_min_km * 1000).toFixed(0)}<span className="ms-unit">m</span></div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Max Diameter</div>
              <div className="ms-value">{(neo.est_diameter_max_km * 1000).toFixed(0)}<span className="ms-unit">m</span></div>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Close Approach Data</div>
          <div className="modal-stats-grid">
            <div className="modal-stat">
              <div className="ms-label">Date</div>
              <div className="ms-value" style={{fontSize:'14px'}}>{neo.close_approach_date}</div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Velocity</div>
              <div className="ms-value" style={{fontSize:'14px'}}>{fmt(neo.relative_velocity_kmh / 1000, 1)}<span className="ms-unit">K km/h</span></div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Miss Distance</div>
              <div className="ms-value" style={{fontSize:'13px'}}>{fmt(neo.miss_distance_km / 1000, 0)}<span className="ms-unit">K km</span></div>
            </div>
            <div className="modal-stat">
              <div className="ms-label">Lunar Distance</div>
              <div className="ms-value">{neo.miss_distance_lunar?.toFixed(2)}<span className="ms-unit">LD</span></div>
            </div>
          </div>
        </div>

        {neo.nasa_url && (
          <a href={neo.nasa_url} target="_blank" rel="noreferrer" className="nasa-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            View on NASA JPL
          </a>
        )}
      </div>
    </div>
  )
}
