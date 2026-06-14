export default function StatsBar({ total, hazardous, closest, loading }) {
  function fmtDist(km) {
    if (!km) return '—'
    if (km > 1e6) return `${(km / 1e6).toFixed(2)}M km`
    return `${Math.round(km).toLocaleString()} km`
  }

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-label">Total Objects</div>
        <div className="stat-value">{loading ? '—' : total}</div>
        <div className="stat-sub">Next 7 days</div>
      </div>

      <div className="stat-card danger">
        <div className="stat-label">Potentially Hazardous</div>
        <div className="stat-value danger">{loading ? '—' : hazardous}</div>
        <div className="stat-sub">{loading || !total ? '' : `${Math.round(hazardous/total*100)}% of tracked`}</div>
      </div>

      <div className="stat-card purple">
        <div className="stat-label">Safe Approaches</div>
        <div className="stat-value purple">{loading ? '—' : total - hazardous}</div>
        <div className="stat-sub">Non-hazardous</div>
      </div>

      <div className="stat-card cyan">
        <div className="stat-label">Closest Approach</div>
        <div className="stat-value cyan" style={{fontSize: closest ? '18px' : '28px'}}>
          {loading ? '—' : closest ? fmtDist(closest.miss_distance_km) : '—'}
        </div>
        <div className="stat-sub" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {closest ? closest.name.replace(/[()]/g,'') : ''}
        </div>
      </div>
    </div>
  )
}
