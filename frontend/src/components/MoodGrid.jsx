// Valence (x) / arousal (y) grid, both -1..+1. Clickable when onChange is set.
// Also used as the session visual: draws the playlist path and current track.
// The field is painted with the same mood colours the aura uses (aura.js).
import { useId, useState } from 'react'
import { moodColor } from '../aura.js'

const SIZE = 260
const toPx = (v) => ((v + 1) / 2) * SIZE
const toPy = (a) => ((1 - a) / 2) * SIZE
const round = (x) => Math.round(x * 100) / 100
const clamp = (x) => Math.max(-1, Math.min(1, x))

// A coarse grid of mood colours, blurred into one soft field.
const CELLS = 11
const STEP = SIZE / CELLS
const FIELD = Array.from({ length: CELLS * CELLS }, (_, k) => {
  const col = k % CELLS
  const row = Math.floor(k / CELLS)
  const v = ((col + 0.5) / CELLS) * 2 - 1
  const a = 1 - ((row + 0.5) / CELLS) * 2
  return { x: col * STEP, y: row * STEP, fill: moodColor([v, a]) }
})

export default function MoodGrid({ value, onChange, path = [], pathLabels = null, current = null, markers = [] }) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState(null) // index of the path stop being pointed at
  const interactive = Boolean(onChange)

  function handleClick(e) {
    if (!onChange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const v = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const a = 1 - ((e.clientY - rect.top) / rect.height) * 2
    onChange([round(clamp(v)), round(clamp(a))])
  }

  // Arrow keys move the point by a tenth of the grid.
  function handleKey(e) {
    if (!onChange) return
    const moves = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }
    const d = moves[e.key]
    if (!d) return
    e.preventDefault()
    const [v, a] = value || [0, 0]
    onChange([round(clamp(v + d[0])), round(clamp(a + d[1]))])
  }

  return (
    <div className={`moodgrid${interactive ? ' is-interactive' : ''}`}>
      <div className="axis-label axis-top">high energy</div>
      <div className="moodgrid-row">
        <span className="axis-label axis-side">unpleasant</span>
        <div className="moodgrid-plot">
        <svg
          className="moodgrid-svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          onClick={handleClick}
          onKeyDown={handleKey}
          tabIndex={interactive ? 0 : undefined}
          role={interactive ? 'button' : 'img'}
          aria-label="Mood grid: left to right is unpleasant to pleasant, bottom to top is low to high energy"
        >
          <defs>
            <filter id={`soft-${id}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <clipPath id={`clip-${id}`}>
              <rect width={SIZE} height={SIZE} rx="22" />
            </clipPath>
          </defs>
          <g clipPath={`url(#clip-${id})`}>
            <g filter={`url(#soft-${id})`}>
              {FIELD.map((c) => (
                <rect key={`${c.x}-${c.y}`} x={c.x - 1} y={c.y - 1} width={STEP + 2} height={STEP + 2} fill={c.fill} />
              ))}
            </g>
            <line className="moodgrid-axis" x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} />
            <line className="moodgrid-axis" x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} />
          </g>
          <text className="moodgrid-corner" x={14} y={24}>tense</text>
          <text className="moodgrid-corner" x={SIZE - 14} y={24} textAnchor="end">excited</text>
          <text className="moodgrid-corner" x={14} y={SIZE - 14}>sad</text>
          <text className="moodgrid-corner" x={SIZE - 14} y={SIZE - 14} textAnchor="end">relaxed</text>
          {path.length > 1 && (
            <polyline className="moodgrid-path" points={path.map((p) => `${toPx(p[0])},${toPy(p[1])}`).join(' ')} />
          )}
          {path.map((p, i) => {
            const label = pathLabels?.[i]
            if (!label) return <circle key={i} className="moodgrid-dot" cx={toPx(p[0])} cy={toPy(p[1])} r={2.5} />
            // Hover or focus a stop to see which song it is.
            return (
              <g
                key={i}
                className={`moodgrid-stop${hover === i ? ' is-active' : ''}`}
                tabIndex={0}
                role="img"
                aria-label={`Track ${label.n}: ${label.title} by ${label.artist}, ${label.stage} stage`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((h) => (h === i ? null : h))}
              >
                <circle className="moodgrid-hit" cx={toPx(p[0])} cy={toPy(p[1])} r={9} />
                <circle className="moodgrid-dot" cx={toPx(p[0])} cy={toPy(p[1])} r={hover === i ? 5 : 3.5} />
              </g>
            )
          })}
          {markers.map((m) => (
            <g key={m.label} className="moodgrid-marker" style={{ color: m.color }}>
              <circle cx={toPx(m.point[0])} cy={toPy(m.point[1])} r={7} />
              <text x={toPx(m.point[0]) + (m.point[0] > 0.5 ? -12 : 12)} y={toPy(m.point[1]) + 4} textAnchor={m.point[0] > 0.5 ? 'end' : 'start'}>
                {m.label}
              </text>
            </g>
          ))}
          {current && <circle className="moodgrid-current" cx={toPx(current[0])} cy={toPy(current[1])} r={8} />}
          {value && <circle className="moodgrid-value" cx={toPx(value[0])} cy={toPy(value[1])} r={9} />}
        </svg>
        {hover != null && pathLabels?.[hover] && <StopLabel point={path[hover]} label={pathLabels[hover]} />}
        </div>
        <span className="axis-label axis-side">pleasant</span>
      </div>
      <div className="axis-label axis-bottom">low energy</div>
      {value && <div className="muted num">valence {value[0]}, arousal {value[1]}</div>}
    </div>
  )
}

// The card beside a hovered stop. Positioned in percent of the plot so it
// follows the grid at any size; flips sides near the edges so it stays inside.
function StopLabel({ point, label }) {
  const x = toPx(point[0]) / SIZE
  const y = toPy(point[1]) / SIZE
  const side = x < 0.3 ? 'from-left' : x > 0.7 ? 'from-right' : 'centred'
  const below = y < 0.3
  return (
    <div
      className={`stop-label ${side}${below ? ' below' : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      aria-hidden="true"
    >
      <span className="stop-label-title">
        <span className="num">{label.n}.</span> {label.title}
      </span>
      <span className="stop-label-artist">{label.artist}</span>
      <span className={`stop-label-stage stage-${label.stage}`}>{label.stage}</span>
    </div>
  )
}
