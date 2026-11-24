// Valence (x) / arousal (y) grid, both -1..+1. Clickable when onChange is set.
// Also used as the session visual: draws the playlist path and current track.
const SIZE = 260
const toPx = (v) => ((v + 1) / 2) * SIZE
const toPy = (a) => ((1 - a) / 2) * SIZE
const round = (x) => Math.round(x * 100) / 100

export default function MoodGrid({ value, onChange, path = [], current = null, markers = [] }) {
  function handleClick(e) {
    if (!onChange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const v = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const a = 1 - ((e.clientY - rect.top) / rect.height) * 2
    onChange([round(Math.max(-1, Math.min(1, v))), round(Math.max(-1, Math.min(1, a)))])
  }

  return (
    <div className="moodgrid">
      <div className="axis-label">high energy</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="axis-label">unpleasant</span>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onClick={handleClick}
          style={{ border: '1px solid #888', cursor: onChange ? 'crosshair' : 'default', maxWidth: '100%' }}
          role={onChange ? 'button' : 'img'}
          aria-label="Mood grid: left to right is unpleasant to pleasant, bottom to top is low to high energy"
        >
          <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="#ccc" />
          <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="#ccc" />
          <text x={4} y={14} fontSize="11" fill="#999">tense</text>
          <text x={SIZE - 40} y={14} fontSize="11" fill="#999">excited</text>
          <text x={4} y={SIZE - 6} fontSize="11" fill="#999">sad</text>
          <text x={SIZE - 40} y={SIZE - 6} fontSize="11" fill="#999">relaxed</text>
          {path.length > 1 && (
            <polyline
              points={path.map((p) => `${toPx(p[0])},${toPy(p[1])}`).join(' ')}
              fill="none"
              stroke="#999"
              strokeDasharray="3 3"
            />
          )}
          {path.map((p, i) => (
            <circle key={i} cx={toPx(p[0])} cy={toPy(p[1])} r={3} fill="#999" />
          ))}
          {markers.map((m) => (
            <g key={m.label}>
              <circle cx={toPx(m.point[0])} cy={toPy(m.point[1])} r={6} fill="none" stroke={m.color} strokeWidth={2} />
              <text x={toPx(m.point[0]) + 8} y={toPy(m.point[1]) + 4} fontSize="11" fill={m.color}>{m.label}</text>
            </g>
          ))}
          {current && <circle cx={toPx(current[0])} cy={toPy(current[1])} r={7} fill="#2a7" />}
          {value && <circle cx={toPx(value[0])} cy={toPy(value[1])} r={7} fill="#c33" />}
        </svg>
        <span className="axis-label">pleasant</span>
      </div>
      <div className="axis-label">low energy</div>
      {value && <div className="muted">valence {value[0]}, arousal {value[1]}</div>}
    </div>
  )
}
