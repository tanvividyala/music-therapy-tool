// The one place the UI asks for a playlist. It runs the ported logic in the
// browser on the exported catalog (or the mock catalog as a fallback). Later,
// swap the body for a fetch() to a Python backend and keep the same return shape.
import { LENGTH_TOLERANCE_MIN, ROUTES } from '../config.js'
import { loadCatalog, withMoodModel } from './catalog.js'
import { orderPlaylist } from './planner.js'
import { calmScore, genreMatch } from './scoring.js'
import { estimateMood, intensity } from './mood.js'

// Distance from a song to the straight segment start -> goal in mood space.
function distToSegment(song, a, b) {
  const [px, py] = [song.valence, song.arousal]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2))
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy))
}

const RECENT_PENALTY = 0.5

const minutes = (songs) => songs.reduce((s, x) => s + x.duration_min, 0)

// Texture tag soft/loud: keep songs on that side of the middle, with a small
// overlap so mid-intensity songs can serve either choice.
function loudnessFilter(choice) {
  if (choice === 'soft') return (s) => intensity(s) <= 0.1
  if (choice === 'loud') return (s) => intensity(s) >= -0.1
  return null
}

/** Narrow the pool to songs near the path, widening until there is enough music. */
function corridor(pool, start, goal, length) {
  for (let w = 0.3; w <= 3; w += 0.15) {
    const near = pool.filter((s) => distToSegment(s, start, goal) <= w)
    if (minutes(near) >= length * 1.3) return near
  }
  return pool
}

// How close the pool must come to the start and goal moods before we trust it
// to carry the whole iso path on its own.
const REACH = 0.4

const nearest = (pool, point) => pool.reduce((m, s) => Math.min(m, Math.hypot(s.valence - point[0], s.arousal - point[1])), Infinity)

/** Personal songs in the order the user's familiarity answer asks for (texture step 4). */
function personalTiers(personal, familiarity) {
  const top = personal.filter((s) => s.source === 'top')
  const artist = personal.filter((s) => s.source === 'artist')
  const genre = personal.filter((s) => s.source === 'genre')
  if (familiarity === 'familiar') return [top, artist, genre]
  if (familiarity === 'new') return [genre, artist] // genre-first: new artists in genres they like
  return [personal]
}

// Looser reach accepted once the user's music has been searched as far as it goes.
const LOOSE_REACH = 0.6

const nearestSongs = (pool, point, n) =>
  [...pool].sort((x, y) => Math.hypot(x.valence - point[0], x.arousal - point[1]) - Math.hypot(y.valence - point[0], y.arousal - point[1])).slice(0, n)

/** Does a catalog song fit the user's taste: one of their artists, or one of their genres? */
function matchesTaste(song, taste) {
  if (!taste) return false
  const artist = (song.artist || '').toLowerCase()
  if (taste.artists?.some((a) => a && artist.includes(a.toLowerCase()))) return true
  return genreMatch(song, taste.genres || []) === 1
}

/**
 * Build the candidate pool from the user's own songs first (tiers in the order
 * their familiarity answer asks for). covered = their songs reach the start and
 * goal moods with enough music, so no more searching is needed.
 * Only when their music can't get close does the catalog fill the gap, taste-
 * matched first and a couple of songs per gap, marked gapFill so the
 * explanation can say so.
 */
function blendPool(tiers, catalogAll, start, goal, length, tol, taste) {
  const mine = new Set(tiers.flat().map((s) => s.spotify_id))
  const catalog = catalogAll.filter((s) => !mine.has(s.spotify_id))
  let pool = []
  for (const tier of tiers) {
    pool = [...pool, ...tier]
    if (minutes(pool) >= length + tol && nearest(pool, start) <= REACH && nearest(pool, goal) <= REACH) return { pool, covered: true, filled: 0 }
  }

  const tasteful = catalog.filter((s) => matchesTaste(s, taste))
  const fill = []
  for (const point of [start, goal]) {
    if (nearest(pool, point) <= LOOSE_REACH) continue // close enough: keep it all theirs
    const near = (list) => nearestSongs(list, point, 2).filter((s) => Math.hypot(s.valence - point[0], s.arousal - point[1]) <= REACH)
    const picks = near(tasteful).length ? near(tasteful) : near(catalog)
    fill.push(...picks)
  }
  // Not enough minutes even so: top up along the path, taste-matched first.
  for (const source of [tasteful, catalog]) {
    if (minutes(pool) + minutes(fill) >= length + tol) break
    const used = new Set(fill.map((s) => s.song_id))
    const along = source.filter((s) => !used.has(s.song_id)).sort((x, y) => distToSegment(x, start, goal) - distToSegment(y, start, goal))
    for (const s of along) {
      if (minutes(pool) + minutes(fill) >= length + tol) break
      fill.push(s)
    }
  }
  return { pool: [...pool, ...fill.map((s) => ({ ...s, gapFill: true }))], covered: false, filled: fill.length }
}

/**
 * FR-3 / NFR-1 / NFR-5. answers = { mood: [v, a], goal, length, texture, genres }
 * options.model = 'rules' | 'learned': which mood estimate to order songs by.
 * options.personal = songs from the user's Spotify listening (spotify.tasteExplorer).
 * options.rand = random source (e.g. Math.random) for variety between sessions; null = deterministic.
 * options.recent = song_ids from the user's recent sessions, picked less often.
 * Returns { playlist, start, goal, elapsedMs, model, catalogSource, catalogSize, personalSize }.
 */
export async function generatePlaylist(answers, { model = 'rules', personal = [], scoreLyrics = null, expand = null, taste = null, budgetMs = 35000, rand = null, recent = [] } = {}) {
  const t0 = performance.now()
  let lyrics = { asked: 0, scored: 0, offline: false }
  const vary = { rand, recent: new Set(recent) }
  let first = await buildPlaylist(answers, model, personal, taste, vary)

  // Keep searching the user's listening until their songs cover the path, or
  // there is nothing left to search, or the time budget (NFR-1) runs out.
  let rounds = 0
  while (!first.covered && expand && performance.now() - t0 < budgetMs) {
    const added = await expand()
    if (added == null) break
    rounds++
    if (!added.length) continue
    personal = [...personal, ...added]
    first = await buildPlaylist(answers, model, personal, taste, vary)
  }

  // FR-3 live lyrics: score the user's songs nearest the path, fold the scores
  // into their mood, drop self-harm themes, and rebuild once.
  if (scoreLyrics && personal.length) {
    const shortlist = first.candidates
      .filter((s) => s.source && !s.lyricsChecked)
      .sort((a, b) => distToSegment(a, first.start, first.goal) - distToSegment(b, first.start, first.goal))
      .slice(0, 40)
    if (shortlist.length) {
      const scores = await scoreLyrics(shortlist)
      lyrics = { asked: shortlist.length, scored: Object.values(scores).filter((x) => x.status === 'scored').length, offline: Object.keys(scores).length === 0 }
      if (!lyrics.offline) {
        personal = withLyrics(personal, scores)
        first = await buildPlaylist(answers, model, personal, taste, vary)
      }
    }
  }
  const { playlist, start, goal, catalog } = first
  return {
    playlist, start, goal, elapsedMs: performance.now() - t0,
    model, catalogSource: catalog.source, catalogSize: catalog.songs.length, learnedModel: catalog.meta?.learned_model || null,
    personalSize: personal.length, fromYou: playlist.filter((t) => t.source).length, lyrics,
    search: { rounds, covered: first.covered, filled: playlist.filter((t) => t.gapFill).length },
  }
}

/** Fold live lyric scores into personal songs (rule model) and drop self-harm themes. */
export function withLyrics(personal, scores) {
  return personal.flatMap((s) => {
    const r = scores[s.spotify_id]
    if (!r) return [s]
    if ((r.flags || '').includes('self_harm')) return []
    if (r.status === 'instrumental') return [{ ...s, instrumental: true, lyricsChecked: true }]
    if (r.status !== 'scored' || !s.features) return [{ ...s, lyricsChecked: true }]
    const mood = estimateMood({ ...s.features, lyric_valence: r.lyric_valence, lyric_arousal: r.lyric_arousal }) || s.mood.rules
    return [{
      ...s, lyric_valence: r.lyric_valence, lyric_arousal: r.lyric_arousal, flags: r.flags,
      instrumental: false, lyricsChecked: true, mood: { rules: mood, learned: mood },
    }]
  })
}

async function buildPlaylist(answers, model, personal, taste, { rand = null, recent = new Set() } = {}) {
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

  // Soft or loud texture tag: soft filter, same rule.
  const loudness = loudnessFilter(tex.loudness)
  if (loudness) {
    const f = pool.filter(loudness)
    if (minutes(corridor(f, start, goal, length)) >= length + LENGTH_TOLERANCE_MIN) pool = f
  }

  // Genre preference: soft filter, same rule.
  if (answers.genres?.length) {
    const f = pool.filter((s) => genreMatch(s, answers.genres))
    if (minutes(corridor(f, start, goal, length)) >= length + LENGTH_TOLERANCE_MIN) pool = f
  }

  // The user's own songs lead (FR-3: familiar music, their genres); the
  // catalog fills in. Same BPM hard filter and lyrics/instrumental choice.
  const mine = withMoodModel(personal, model).filter((s) => route.maxBpm == null || s.bpm <= route.maxBpm)
  const mineTextured = tex.lyrics === 'instrumental' || tex.lyrics === 'lyrics'
    ? mine.filter((s) => s.instrumental === (tex.lyrics === 'instrumental'))
    : mine
  const mineLyrics = mineTextured.length ? mineTextured : mine
  const mineLoud = loudness ? mineLyrics.filter(loudness) : mineLyrics
  const tiers = personalTiers(mineLoud.length ? mineLoud : mineLyrics, tex.familiarity).filter((t) => t.length)
  let covered = tiers.length === 0 // nothing personal to search further for
  if (tiers.length) ({ pool, covered } = blendPool(tiers, pool, start, goal, length, LENGTH_TOLERANCE_MIN, taste))

  const candidates = corridor(pool, start, goal, length).map((s) => ({ ...s, calm_score: calmScore(s) }))
  // FR-3 scoring: within each slice of the path, prefer the song whose calm
  // score suits the direction of travel (calmer when the goal is lower energy
  // than now, livelier when it is higher) and that matches the user's genres.
  const direction = Math.sign(start[1] - goal[1]) // +1 calming, -1 energising
  // Variety: songs from the user's last few sessions lose RECENT_PENALTY, more
  // than the pick margin, so they only come back when nothing else fits.
  const quality = (s) => direction * s.calm_score + 0.3 * genreMatch(s, answers.genres || []) - (recent.has(s.song_id) ? RECENT_PENALTY : 0)
  const playlist = orderPlaylist(candidates, start, goal, length, { quality, rand })
  return { playlist, candidates, start, goal, catalog, covered }
}
