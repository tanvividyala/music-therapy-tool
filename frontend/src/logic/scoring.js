// Mirrors src/tmr/scoring.py. Part of FR-3 (score candidate songs).
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

/**
 * UT-2: how calming a song is, -1..+1. Never modifies the song.
 * With lyrics:  0.4*(-arousal) + 0.3*tempo + 0.3*lyric_valence
 * Instrumental: 0.5*(-arousal) + 0.5*tempo
 * tempo = +1 at 50 BPM, falling to -1 at 150 BPM or faster.
 */
export function calmScore(song) {
  const arousal = song.est_arousal ?? song.muse_arousal
  const arousalTerm = -arousal
  const tempoTerm = 1 - 2 * clamp((song.bpm - 50) / 100, 0, 1)
  const lyric = song.lyric_valence
  const score = lyric == null
    ? 0.5 * arousalTerm + 0.5 * tempoTerm
    : 0.4 * arousalTerm + 0.3 * tempoTerm + 0.3 * lyric
  return clamp(score, -1, 1)
}

/** Genre match 0..1: 1 if the song's genre is one the user picked. Genre is a
 * single TEXT field in the schema, so this is a simple substring match for now. */
export function genreMatch(song, genres) {
  if (!genres || genres.length === 0) return 0
  const g = (song.genre || '').toLowerCase()
  return genres.some((x) => g.includes(x.toLowerCase()) || x.toLowerCase().includes(g)) ? 1 : 0
}
