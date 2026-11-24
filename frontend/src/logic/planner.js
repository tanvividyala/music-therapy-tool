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

/** One-sentence explanation per track (FR-3). */
export function explain(song, stageName, start, goal) {
  const t = `${tempoWord(song.bpm)} (${Math.round(song.bpm)} BPM)`
  const kind = song.lyric_valence == null ? 'instrumental' : 'song'
  if (stageName === 'match') {
    return `This ${t} ${kind} sits close to how you feel right now (${distance(song, start).toFixed(2)} from your starting mood), so it meets you where you are.`
  }
  if (stageName === 'shift') {
    return `This ${t} ${kind} starts moving you toward your goal, ${distance(song, goal).toFixed(2)} away from where you want to end up.`
  }
  return `This ${t} ${kind} is close to your goal mood (${distance(song, goal).toFixed(2)} away), helping you settle there.`
}

/**
 * UT-3: pick and order songs so the playlist moves from start toward goal.
 * candidates: [{ valence, arousal, duration_min, ... }]. Returns a NEW list;
 * the candidate pool is not modified. Same method as planner.py:
 *   1. sort by distance to goal, farthest first (distance never increases)
 *   2. pick evenly spaced songs until total time is close to length
 *   3. trim/add songs so the total is within +/- tolerance (NFR-5)
 */
export function orderPlaylist(candidates, start, goal, length) {
  const pool = [...candidates].sort((a, b) => distance(b, goal) - distance(a, goal))
  const n = pool.length
  if (n === 0) return []

  const tol = LENGTH_TOLERANCE_MIN
  const avg = pool.reduce((s, x) => s + x.duration_min, 0) / n
  const k = Math.min(Math.max(2, Math.round(length / avg)), n)

  let chosen
  if (k === 1) chosen = [0]
  else chosen = [...new Set(Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1))))].sort((a, b) => a - b)

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
