import { useRef } from 'react'

export default function FilterBar({ filter, setFilter, sortBy, setSortBy, onRefresh, onExport, loading, count, total, error = false, view, setView, query = '', setQuery }) {
  const searchInput = useRef(null)
  const narrowed = query.trim() || filter !== 'all'
  return (
    <div className="filter-bar">
      <div className="search-field">
        <label htmlFor="asteroid-search">Search asteroids</label>
        <div className="search-controls">
          <input id="asteroid-search" ref={searchInput} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, NEO ID, or YYYY-MM-DD" aria-describedby="search-help" />
          {query && <button className="btn-retry" onClick={() => { setQuery(''); searchInput.current.focus() }}>Clear search</button>}
        </div>
        <p id="search-help">Search the current 7-day feed. Combine words, IDs, or dates to narrow results.</p>
      </div>
      <div className="filter-controls">
        {/* View toggle */}
        <div className="filter-group view-toggle" role="group" aria-label="View">
          <button
            className={`filter-btn${view === 'grid' ? ' active' : ''}`}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            title="Card grid view"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Grid
          </button>
          <button
            className={`filter-btn${view === '3d' ? ' active view-3d' : ''}`}
            aria-pressed={view === '3d'}
            onClick={() => setView('3d')}
            title="3D space view"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9"/>
              <ellipse cx="12" cy="12" rx="9" ry="4"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
            3D View
          </button>
        </div>

        <div className="filter-group" role="group" aria-label="Classification">
          {[['all','All'], ['hazardous','Hazardous'], ['safe','Safe']].map(([val, label]) => (
            <button
              key={val}
              className={`filter-btn${filter === val ? ' active' : ''}${val === 'hazardous' ? ' danger' : ''}${val === 'safe' ? ' safe' : ''}`}
              aria-pressed={filter === val}
              onClick={() => setFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Object positions in the 3D scene are derived from IDs and distance,
            so list ordering has no visual meaning outside the grid view. */}
        <select
          className="sort-select"
          aria-label="Sort asteroids"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          disabled={view === '3d'}
          title={view === '3d' ? 'Sorting applies to grid view' : undefined}
        >
          <option value="date">Sort: Date</option>
          <option value="distance">Sort: Distance</option>
          <option value="size">Sort: Size</option>
          <option value="speed">Sort: Speed</option>
        </select>

      </div>

      <div className="filter-actions">
        <span className="count-badge" role="status" aria-atomic="true">{loading ? 'Loading objects…' : error ? 'Objects unavailable' : narrowed && total !== undefined ? `${count} of ${total} objects` : `${count} objects`}</span>

        <button className="export-btn" onClick={onExport} disabled={loading || count === 0}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>
          </svg>
          Export CSV
        </button>

        <button className="refresh-btn" onClick={onRefresh} disabled={loading}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={loading ? 'spinning' : ''}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  )
}
