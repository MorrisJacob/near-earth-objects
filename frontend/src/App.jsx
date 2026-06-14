import { useState, useEffect } from 'react'
import StarField from './components/StarField'
import AsteroidCard from './components/AsteroidCard'
import StatsBar from './components/StatsBar'
import FilterBar from './components/FilterBar'
import AsteroidModal from './components/AsteroidModal'
import SpaceView3D from './components/SpaceView3D'
import './App.css'

// In production VITE_API_BASE is set to the Railway backend URL via GitHub
// Actions secrets. Locally it falls back to the dev server on port 7777.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7777/api'

export default function App() {
  const [neos, setNeos] = useState([])        // full list from the API
  const [filtered, setFiltered] = useState([]) // list after filter + sort applied
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // asteroid open in the detail modal
  const [filter, setFilter] = useState('all')    // 'all' | 'hazardous' | 'safe'
  const [sortBy, setSortBy] = useState('date')   // 'date' | 'distance' | 'size' | 'speed'
  const [totalObjects, setTotalObjects] = useState(0) // raw count from the API (before client filter)
  const [view, setView] = useState('grid')       // 'grid' | '3d'

  useEffect(() => { fetchNEOs() }, [])                    // fetch once on mount
  useEffect(() => { applyFilters() }, [neos, filter, sortBy]) // re-filter whenever inputs change

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

  function applyFilters() {
    let list = [...neos]
    if (filter === 'hazardous') list = list.filter(n => n.is_potentially_hazardous)
    if (filter === 'safe') list = list.filter(n => !n.is_potentially_hazardous)
    if (sortBy === 'date') list.sort((a, b) => a.close_approach_date.localeCompare(b.close_approach_date))
    if (sortBy === 'distance') list.sort((a, b) => a.miss_distance_km - b.miss_distance_km)
    if (sortBy === 'size') list.sort((a, b) => b.est_diameter_max_km - a.est_diameter_max_km)
    if (sortBy === 'speed') list.sort((a, b) => b.relative_velocity_kmh - a.relative_velocity_kmh)
    setFiltered(list)
  }

  const hazardCount = neos.filter(n => n.is_potentially_hazardous).length
  const closestNEO = neos.length ? [...neos].sort((a, b) => a.miss_distance_km - b.miss_distance_km)[0] : null

  return (
    <div className="app">
      <StarField />

      <header className="header">
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
              <h1 className="title">NEAR EARTH OBJECTS</h1>
              <p className="subtitle">Real-time asteroid tracking &bull; NASA NeoWS</p>
            </div>
          </div>
          <StatsBar total={totalObjects} hazardous={hazardCount} closest={closestNEO} loading={loading} />
        </div>
      </header>

      <main className={`main${view === '3d' ? ' main--3d' : ''}`}>
        <FilterBar
          filter={filter} setFilter={setFilter}
          sortBy={sortBy} setSortBy={setSortBy}
          onRefresh={fetchNEOs} loading={loading}
          count={filtered.length}
          view={view} setView={setView}
        />

        {loading && (
          <div className="loading-state">
            <div className="orbit-loader">
              <div className="orbit-ring" />
              <div className="orbit-ring ring2" />
              <div className="orbit-planet" />
            </div>
            <p className="loading-text">Scanning near-Earth space&hellip;</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <div className="error-icon">!</div>
            <p>Failed to load data: {error}</p>
            <button className="btn-retry" onClick={fetchNEOs}>Retry</button>
          </div>
        )}

        {!loading && !error && view === 'grid' && (
          <div className="neo-grid">
            {filtered.map((neo, i) => (
              <AsteroidCard key={neo.id} neo={neo} index={i} onClick={() => setSelected(neo)} />
            ))}
            {filtered.length === 0 && <div className="empty-state"><p>No objects match the current filter.</p></div>}
          </div>
        )}

        {!loading && !error && view === '3d' && (
          <SpaceView3D neos={filtered} onSelect={setSelected} />
        )}
      </main>

      {selected && <AsteroidModal neo={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
