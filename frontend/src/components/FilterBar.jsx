export default function FilterBar({ filter, setFilter, sortBy, setSortBy, onRefresh, loading, count, view, setView }) {
  return (
    <div className="filter-bar">
      {/* View toggle */}
      <div className="filter-group view-toggle">
        <button
          className={`filter-btn${view === 'grid' ? ' active' : ''}`}
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

      <div className="filter-group">
        {[['all','All'], ['hazardous','Hazardous'], ['safe','Safe']].map(([val, label]) => (
          <button
            key={val}
            className={`filter-btn${filter === val ? ' active' : ''}${val === 'hazardous' ? ' danger' : ''}`}
            onClick={() => setFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      <select
        className="sort-select"
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

      <span className="count-badge">{count} objects</span>

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
  )
}
