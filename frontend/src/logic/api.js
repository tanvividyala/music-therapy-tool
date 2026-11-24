// The one place the UI asks for a playlist. It runs the ported logic in the
// browser on the exported catalog (or the mock catalog as a fallback). Later,
// swap the body for a fetch() to a Python backend and keep the same return shape.
import { LENGTH_TOLERANCE_MIN, ROUTES } from '../config.js'
import { loadCatalog, withMoodModel } from './catalog.js'
import { orderPlaylist } from './planner.js'
import { calmScore, genreMatch } from './scoring.js'

// Distance from a song to the straight segment start -> goal in mood space.
function distToSegment(song, a, b) {
  const [px, py] = [song.valence, song.arousal]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2))
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy))
}

const minutes = (songs) => songs.reduce((s, x) => s + x.duration_min, 0)

/** Narrow the pool to songs near the path, widening until there is enough music. */
function corridor(pool, start, goal, length) {
  for (let w = 0.3; w <= 3; w += 0.15) {
    const near = pool.filter((s) => distToSegment(s, start, goal) <= w)
    if (minutes(near) >= length * 1.3) return near
  }
  return pool
}

/**
 * FR-3 / NFR-1 / NFR-5. answers = { mood: [v, a], goal, length, texture, genres }
 * options.model = 'rules' | 'learned': which mood estimate to order songs by.
 * Returns { playlist, start, goal, elapsedMs, model, catalogSource, catalogSize }.
 */
export async function generatePlaylist(answers, { model = 'rules' } = {}) {
  const t0 = performance.now()
  const route = ROUTES[answers.goal]
  const start = answers.mood // iso principle: start where the user actually is
  const goal = route.end
  const length = answers.length

  const catalog = await loadCatalog()
  const songs = withMoodModel(catalog.songs, model)

  // BPM is a hard filter (spec section 5).
  let pool = songs.filter((s) => route.maxBpm == null || s.bpm <= route.maxBpm)

  // Optional texture tag: lyrics vs instrumental. Only applied if enough music remains.
  const tex = answers.texture || {}
  if (tex.lyrics === 'instrumental' || tex.lyrics === 'lyrics') {
    const want = tex.lyrics === 'instrumental'
    const f = pool.filter((s) => (s.lyric_valence == null) === want)
    if (minutes(corridor(f, start, goal, length)) >= length + LENGTH_TOLERANCE_MIN) pool = f
  }

  // Genre preference: soft filter, same rule.
  if (answers.genres?.length) {
    const f = pool.filter((s) => genreMatch(s, answers.genres))
    if (minutes(corridor(f, start, goal, length)) >= length + LENGTH_TOLERANCE_MIN) pool = f
  }

  const candidates = corridor(pool, start, goal, length).map((s) => ({ ...s, calm_score: calmScore(s) }))
  const playlist = orderPlaylist(candidates, start, goal, length)
  return {
    playlist, start, goal, elapsedMs: performance.now() - t0,
    model, catalogSource: catalog.source, catalogSize: catalog.songs.length,
  }
}
