// Mirrors src/tmr/mood.py (rule-based mood estimate, FR-3). Keep the two in sync.
// Lets the browser score any track with ReccoBeats audio features, such as
// tracks from the user's Spotify listening history. Citations live in mood.py.
const clamp = (x, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x))
const unit = (x) => 2 * Number(x) - 1 // 0..1 feature -> -1..+1
// -21.5 dB -> -1 and -3.5 dB -> +1 (5th-95th percentile of ReccoBeats loudness).
const loudnessUnit = (db) => clamp((Number(db) + 12.5) / 9)

export const AROUSAL_WEIGHTS = { energy: 0.6, loudness: 0.25, acoustic: 0.15 }
export const VALENCE_WEIGHTS = { valence: 0.75, mode: 0.25 }
export const LYRIC_SHARE = { valence: 0.3, arousal: 0.15 }

/**
 * Returns [valence, arousal], each in [-1, 1], or null when audio features are
 * missing. song: { energy, valence, acousticness, loudness, mode } plus optional
 * lyric_valence / lyric_arousal. Never modifies the song.
 */
export function estimateMood(song) {
  const needed = ['energy', 'valence', 'acousticness', 'loudness', 'mode']
  if (needed.some((k) => song[k] == null)) return null

  let w = AROUSAL_WEIGHTS
  let arousal = w.energy * unit(song.energy) + w.loudness * loudnessUnit(song.loudness) - w.acoustic * unit(song.acousticness)

  w = VALENCE_WEIGHTS
  let valence = w.valence * unit(song.valence) + w.mode * (Number(song.mode) === 1 ? 1 : -1)

  const lv = song.lyric_valence
  const la = song.lyric_arousal
  if (lv != null && la != null) {
    valence = (1 - LYRIC_SHARE.valence) * valence + LYRIC_SHARE.valence * lv
    arousal = (1 - LYRIC_SHARE.arousal) * arousal + LYRIC_SHARE.arousal * la
  }
  return [clamp(valence), clamp(arousal)]
}

/**
 * How loud and intense a track feels, -1 (soft) .. +1 (loud), for the
 * questionnaire's soft/loud texture tag. Uses ReccoBeats loudness and energy
 * when present; otherwise falls back to the song's arousal estimate.
 */
export function intensity(song) {
  if (song.loudness != null && song.energy != null) return clamp(0.5 * loudnessUnit(song.loudness) + 0.5 * unit(song.energy))
  return song.intensity ?? song.arousal ?? song.est_arousal ?? 0
}
