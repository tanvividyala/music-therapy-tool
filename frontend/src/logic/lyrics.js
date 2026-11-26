// FR-3: live lyric scores from the local Python service (src/tmr/lyrics_api.py).
// The browser sends only Spotify ID, title and artist, and gets back scores,
// never lyric text. If the service isn't running, callers get {} and keep
// audio-only scores.
import { LYRICS_API_URL } from '../config.js'

export async function fetchLyricScores(songs, { timeoutMs = 45000 } = {}) {
  if (!LYRICS_API_URL || songs.length === 0) return {}
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${LYRICS_API_URL}/lyric-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks: songs.map(({ spotify_id, title, artist }) => ({ spotify_id, title, artist })) }),
      signal: ctrl.signal,
    })
    if (!res.ok) return {}
    return (await res.json()).scores || {}
  } catch {
    return {} // offline or slow: fall back to audio-only scores
  } finally {
    clearTimeout(timer)
  }
}
