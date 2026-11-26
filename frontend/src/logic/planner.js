// Mirrors src/tmr/planner.py. Part of FR-3 (iso-principle ordering).
import { LENGTH_TOLERANCE_MIN } from '../config.js'

export const distance = (song, point) => Math.hypot(song.valence - point[0], song.arousal - point[1])

/** FR-4 session stage for a position: match, shift or settle. */
export function stage(index, total) {
  const third = total / 3
  if (index < third) return 'match'
  if (index < 2 * third) return 'shift'
  return 'settle'
}

function tempoWord(bpm) {
  if (bpm < 75) return 'slow'
  if (bpm < 110) return 'mid-tempo'
  return 'fast'
}

/**
 * The audible reasons behind a song's mood point, strongest first. Uses the
 * same inputs as the mood model: ReccoBeats energy, acousticness, loudness,
 * key mode and valence when we have them (the user's Spotify songs), otherwise
 * the song's mood estimate (catalog songs).
 */
export function traits(song) {
  const f = song.features
  const out = []
  if (f) {
    if (f.energy != null && f.energy < 0.35) out.push('low-energy')
    else if (f.energy != null && f.energy > 0.7) out.push('high-energy')
    if (f.acousticness != null && f.acousticness > 0.6) out.push('acoustic')
    if (f.loudness != null && f.loudness < -14) out.push('quiet')
    else if (f.loudness != null && f.loudness > -6) out.push('loud')
    if (f.valence != null && f.valence < 0.3) out.push('dark-sounding')
    else if (f.valence != null && f.valence > 0.7) out.push('bright-sounding')
    if (f.mode != null) out.push(Number(f.mode) === 1 ? 'major-key' : 'minor-key')
  } else {
    if (song.arousal < -0.3) out.push('low-energy')
    else if (song.arousal > 0.3) out.push('high-energy')
    if (song.valence < -0.3) out.push('dark-sounding')
    else if (song.valence > 0.3) out.push('bright-sounding')
  }
  return out.slice(0, 3)
}

function lyricPhrase(song) {
  if (song.lyric_valence == null) return ''
  if (song.lyric_valence < -0.3) return ' with sad lyrics'
  if (song.lyric_valence > 0.3) return ' with hopeful lyrics'
  return ' with neutral lyrics'
}

// Why a song from the user's own listening was picked (frontend only; the
// Python planner has no listening history yet).
function sourcePhrase(song) {
  if (song.gapFill) return ' from outside your listening (none of your songs reached this mood)'
  if (song.source === 'top') return ' from your top tracks'
  if (song.source === 'artist') return ' by one of your top artists'
  if (song.source === 'genre' && song.genre) return ` from ${song.genre}, a genre you listen to`
  return ''
}

/**
 * One-sentence explanation per track (FR-3), naming what actually places the
 * song: tempo, the audio traits behind its mood, its lyrics and where it came
 * from, then what it does at this stage of the session.
 */
export function explain(song, stageName, start, goal) {
  const instrumental = song.instrumental ?? song.lyric_valence == null
  const desc = [`${tempoWord(song.bpm)} (${Math.round(song.bpm)} BPM)`, ...traits(song)].join(', ')
  const what = `A ${desc} ${instrumental ? 'instrumental' : 'song'}${instrumental ? '' : lyricPhrase(song)}${sourcePhrase(song)}`
  if (stageName === 'match') {
    return `${what} that sits close to how you feel right now (${distance(song, start).toFixed(2)} from your starting mood), so it meets you where you are.`
  }
  if (stageName === 'shift') {
    return `${what} that starts moving you toward your goal, ${distance(song, goal).toFixed(2)} away from where you want to end up.`
  }
  return `${what} that is close to your goal mood (${distance(song, goal).toFixed(2)} away), helping you settle there.`
}

/**
 * UT-3: pick and order songs so the playlist moves from start toward goal.
 * candidates: [{ valence, arousal, duration_min, ... }]. Returns a NEW list;
 * the candidate pool is not modified. Same method as planner.py:
 *   1. sort by distance to goal, farthest first (distance never increases)
 *   2. pick evenly spaced songs until total time is close to length
 *   3. trim/add songs so the total is within +/- tolerance (NFR-5)
 */
export function orderPlaylist(candidates, start, goal, length, { quality = null } = {}) {
  const pool = [...candidates].sort((a, b) => distance(b, goal) - distance(a, goal))
  const n = pool.length
  if (n === 0) return []

  const tol = LENGTH_TOLERANCE_MIN
  const avg = pool.reduce((s, x) => s + x.duration_min, 0) / n
  const k = Math.min(Math.max(2, Math.round(length / avg)), n)

  let chosen
  if (k === 1) chosen = [0]
  else chosen = [...new Set(Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1))))].sort((a, b) => a - b)

  // FR-3 scoring: with a quality score (calm score and genre match, see api.js),
  // each middle pick takes the best song from its own slice of the path instead
  // of the exact evenly spaced one. The ends stay fixed (UT-3: first closest to
  // the start, last closest to the goal) and slices never overlap, so distance
  // to the goal still never increases.
  if (quality && chosen.length > 2) {
    const bounds = chosen.map((c, i) => (i === 0 ? 0 : Math.ceil((chosen[i - 1] + c) / 2)))
    chosen = chosen.map((c, i) => {
      if (i === 0 || i === chosen.length - 1) return c
      const lo = Math.max(bounds[i], chosen[0] + 1)
      const hi = Math.min(i + 1 < chosen.length ? bounds[i + 1] - 1 : n - 2, chosen[chosen.length - 1] - 1)
      let best = c
      for (let j = lo; j <= hi; j++) if (quality(pool[j]) > quality(pool[best])) best = j
      return best
    })
  }

  const total = (idx) => idx.reduce((s, i) => s + pool[i].duration_min, 0)

  // Too long: drop the middle-most song (keeps both ends of the path).
  while (total(chosen) > length + tol && chosen.length > 2) chosen.splice(Math.floor(chosen.length / 2), 1)

  // Too short: add the first unused song that still fits.
  if (total(chosen) < length - tol) {
    for (let i = 0; i < n; i++) {
      if (chosen.includes(i)) continue
      if (total(chosen) + pool[i].duration_min <= length + tol) {
        chosen.push(i)
        chosen.sort((a, b) => a - b)
      }
      if (total(chosen) >= length - tol) break
    }
  }

  const picked = chosen.map((i) => pool[i])
  return picked.map((song, idx) => {
    const s = stage(idx, picked.length)
    return { ...song, stage: s, explanation: explain(song, s, start, goal) }
  })
}

/** FR-6 pilot "shuffled" condition: same tracks, random order. */
export function shuffled(playlist, rand = Math.random) {
  const out = [...playlist]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.map((song, idx) => ({ ...song, stage: stage(idx, out.length) }))
}
