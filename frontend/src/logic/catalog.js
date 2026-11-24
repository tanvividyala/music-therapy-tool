// Song catalog for the playlist builder.
// Loads public/catalog.json, exported by notebooks/01_build_catalog.ipynb (MuSe songs
// with ReccoBeats audio features and Genius lyric scores; no lyric text). Falls back
// to the hand-made MOCK_CATALOG if the file is missing (e.g. in unit tests).
//
// Each exported song carries BOTH mood estimates so the two can be compared in the app:
//   mood.rules   = [valence, arousal] from src/tmr/mood.py (literature-based rules)
//   mood.learned = [valence, arousal] from the gradient-boosting model (out-of-fold)
import { MOCK_CATALOG } from './mockCatalog.js'

export const MOOD_MODELS = ['rules', 'learned']

let cached = null

export async function loadCatalog() {
  if (cached) return cached
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    cached = { source: 'catalog', songs: data.songs, meta: data.meta || null }
  } catch {
    cached = { source: 'sample', songs: MOCK_CATALOG, meta: null }
  }
  return cached
}

/** Return songs with valence/arousal taken from the chosen mood model.
 * Songs without that estimate (e.g. the mock catalog) are left as they are.
 * Never modifies the input. */
export function withMoodModel(songs, model) {
  return songs.map((s) => {
    const m = s.mood?.[model]
    if (!m) return s
    const [valence, arousal] = m
    return { ...s, valence, arousal, est_arousal: arousal }
  })
}
