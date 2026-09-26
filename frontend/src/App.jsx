import { useState, useEffect, useMemo } from 'react'
import StarField from './components/StarField'
import AsteroidCard from './components/AsteroidCard'
import StatsBar from './components/StatsBar'
import FilterBar from './components/FilterBar'
import AsteroidModal from './components/AsteroidModal'
import SpaceView3D from './components/SpaceView3D'
import { downloadObjectsCsv } from './utils/csv'
import './App.css'

// In production VITE_API_BASE is set to the Railway backend URL via GitHub
// Actions secrets. Locally it falls back to the dev server on port 7777.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7777/api'

export default function App() {
  const [neos, setNeos] = useState([])        // full list from the API
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // asteroid open in the detail modal
  const [filter, setFilter] = useState('all')    // 'all' | 'hazardous' | 'safe'
  const [sortBy, setSortBy] = useState('date')   // 'date' | 'distance' | 'size' | 'speed'
  const [totalObjects, setTotalObjects] = useState(0) // raw count from the API (before client filter)
  const [view, setView] = useState('grid')       // 'grid' | '3d'

  const [query, setQuery] = useState('')

  useEffect(() => { fetchNEOs() }, [])                    // fetch once on mount

  async function fetchNEOs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/neo/feed`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setNeos(data.neos || [])
      setTotalObjects(data.total_objects || 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    // Work on a copy because Array.sort mutates its receiver and neos is React
    // state shared by the statistics and both view modes.
    let list = [...neos]
    if (filter === 'hazardous') list = list.filter(n => n.is_potentially_hazardous)
    if (filter === 'safe') list = list.filter(n => !n.is_potentially_hazardous)
    if (sortBy === 'date') list.sort((a, b) => a.close_approach_date.localeCompare(b.close_approach_date))
    if (sortBy === 'distance') list.sort((a, b) => a.miss_distance_km - b.miss_distance_km)
    if (sortBy === 'size') list.sort((a, b) => b.est_diameter_max_km - a.est_diameter_max_km)
    if (sortBy === 'speed') list.sort((a, b) => b.relative_velocity_kmh - a.relative_velocity_kmh)
    const search = query.trim().toLowerCase()
    return list.filter(n => n.name.toLowerCase().includes(search) || String(n.id).includes(search))
  }, [neos, filter, sortBy, query])

  // Summary statistics intentionally use the complete feed, not the filtered
  // list, so changing the grid controls does not change the dashboard totals.
  const hazardCount = neos.filter(n => n.is_potentially_hazardous).length
  const closestNEO = neos.length ? [...neos].sort((a, b) => a.miss_distance_km - b.miss_distance_km)[0] : null

  return (
    <div className="app">
      <a className="skip-link" href="#objects">Skip to asteroid explorer</a>
      <StarField />
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#overview">Overview</a>
        <a href="#objects">Asteroid explorer</a>
        <a href="#guide">Data guide</a>
      </nav>

      <header className="header" id="overview" tabIndex={-1}>
        <div className="header-glow" />
        <div className="header-content">
          <div className="logo-row">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="url(#g1)" strokeWidth="1.5"/>
                <ellipse cx="20" cy="20" rx="18" ry="6" stroke="url(#g2)" strokeWidth="1" strokeDasharray="3 3" transform="rotate(-20 20 20)"/>
                <circle cx="20" cy="20" r="4" fill="url(#g3)"/>
                <circle cx="8" cy="14" r="2" fill="#a78bfa"/>
                <defs>
                  <linearGradient id="g1" x1="2" y1="2" x2="38" y2="38"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#c084fc"/></linearGradient>
                  <linearGradient id="g2" x1="2" y1="2" x2="38" y2="38"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#818cf8"/></linearGradient>
                  <linearGradient id="g3" x1="16" y1="16" x2="24" y2="24"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#c084fc"/></linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="title">OUTER SPACE</h1>
              <p className="subtitle">Real-time asteroid tracking &bull; NASA NeoWS</p>
            </div>
          </div>
          <StatsBar total={totalObjects} hazardous={hazardCount} closest={closestNEO} loading={loading || Boolean(error)} />
        </div>
      </header>

      <main id="objects" tabIndex={-1} className={`main${view === '3d' ? ' main--3d' : ''}`}>
        <h2>Asteroid explorer</h2>
        <p className="section-intro">Explore upcoming approaches in the next 7 days. Select an asteroid to see its details and NASA record.</p>
        <FilterBar
          filter={filter} setFilter={setFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          onRefresh={fetchNEOs} loading={loading}
          count={error ? 0 : filtered.length}
          query={query} setQuery={setQuery}
          view={view} setView={setView}
          onExport={() => downloadObjectsCsv(filtered)}
        />

        {loading && (
          <div className="loading-state" role="status">
            <div className="orbit-loader">
              <div className="orbit-ring" />
              <div className="orbit-ring ring2" />
              <div className="orbit-planet" />
            </div>
            <p className="loading-text">Scanning near-Earth space&hellip;</p>
          </div>
        )}

        {error && (
          <div className="error-state" role="alert">
            <div className="error-icon">!</div>
            <p>Failed to load data: {error}</p>
            <button className="btn-retry" onClick={fetchNEOs}>Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === 'grid' && (
          <div className="neo-grid">
            {filtered.map((neo, i) => (
              <AsteroidCard key={neo.id} neo={neo} index={i} onClick={() => setSelected(neo)} />
            ))}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === '3d' && (
          <SpaceView3D neos={filtered} onSelect={setSelected} />
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state" role="status">
            <p>{neos.length ? 'No objects match your search and filter.' : 'No upcoming approaches are available in this feed.'}</p>
            {(query || filter !== 'all') && (
              <button className="btn-retry" onClick={() => { setQuery(''); setFilter('all') }}>Clear search and filters</button>
            )}
          </div>
        )}

        <section className="data-guide" id="guide" tabIndex={-1} aria-labelledby="guide-title">
          <h2 id="guide-title">Data guide</h2>
          <dl>
            <dt>Finding an asteroid</dt>
            <dd>Search by name or NEO ID, filter by classification, and sort the grid by date, distance, size, or speed. Export CSV downloads the current results. Grid view also provides keyboard access to every object's details.</dd>
            <dt>Miss distance and LD</dt>
            <dd>Miss distance is the predicted separation at close approach. One lunar distance (LD) is approximately 384,400 km, the average distance between Earth and the Moon.</dd>
            <dt>Potentially hazardous</dt>
            <dd>NASA classifies objects using their size and orbit. This label does not mean an impact is predicted. “Safe” identifies objects without that classification.</dd>
            <dt>About the views</dt>
            <dd>Summary totals cover the full feed; search and filters affect the results below. The 3D view is an illustration, with compressed distances and illustrative positions, not a precise orbital map.</dd>
          </dl>
          <a href="https://cneos.jpl.nasa.gov/about/neo_groups.html" target="_blank" rel="noreferrer">Learn about near-Earth objects at NASA JPL (opens in a new tab)</a>
          <a className="back-to-top" href="#overview">Back to overview ↑</a>
        </section>
      </main>

      {selected && <AsteroidModal neo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
