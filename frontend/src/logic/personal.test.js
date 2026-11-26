// FR-3: rule-based mood estimate (mirror of tests/test_mood.py) and playlists
// built from the user's own Spotify listening.
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../config.js'
import { generatePlaylist, withLyrics } from './api.js'
import { estimateMood, intensity } from './mood.js'
import { distance, explain, orderPlaylist } from './planner.js'

const QUIET_ACOUSTIC_MINOR = { energy: 0.15, valence: 0.2, acousticness: 0.9, loudness: -22, mode: 0 }
const LOUD_BRIGHT_MAJOR = { energy: 0.9, valence: 0.85, acousticness: 0.05, loudness: -4, mode: 1 }

describe('estimateMood mirrors src/tmr/mood.py', () => {
  it('stays in range, loud is more aroused, major is happier, missing features give null', () => {
    for (const s of [QUIET_ACOUSTIC_MINOR, LOUD_BRIGHT_MAJOR]) {
      const [v, a] = estimateMood(s)
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
      expect(Math.abs(a)).toBeLessThanOrEqual(1)
    }
    expect(estimateMood(LOUD_BRIGHT_MAJOR)[1]).toBeGreaterThan(estimateMood(QUIET_ACOUSTIC_MINOR)[1])
    expect(estimateMood(LOUD_BRIGHT_MAJOR)[0]).toBeGreaterThan(estimateMood({ ...LOUD_BRIGHT_MAJOR, mode: 0 })[0])
    expect(estimateMood({ ...LOUD_BRIGHT_MAJOR, lyric_valence: -0.8, lyric_arousal: 0 })[0]).toBeLessThan(estimateMood(LOUD_BRIGHT_MAJOR)[0])
    expect(estimateMood({ energy: 0.5 })).toBeNull()
  })

  it('matches the Python formula on a worked example', () => {
    // arousal = 0.6*(2*0.9-1) + 0.25*((-4+12.5)/9) - 0.15*(2*0.05-1)
    // valence = 0.75*(2*0.85-1) + 0.25*1
    const [v, a] = estimateMood(LOUD_BRIGHT_MAJOR)
    expect(a).toBeCloseTo(0.6 * 0.8 + 0.25 * (8.5 / 9) + 0.15 * 0.9, 6)
    expect(v).toBeCloseTo(0.75 * 0.7 + 0.25, 6)
  })
})

// A listening history spread over the whole mood grid, 3.5 min a track.
function history() {
  const songs = []
  let n = 0
  for (let v = -0.9; v <= 0.9; v += 0.3) {
    for (let a = -0.9; a <= 0.9; a += 0.3) {
      const source = n % 2 ? 'artist' : 'top'
      const mood = [Math.round(v * 100) / 100, Math.round(a * 100) / 100]
      songs.push({
        song_id: `spotify:t${n}`, spotify_id: `t${n}`, title: `Track ${n}`, artist: 'Someone', genre: 'indie pop',
        bpm: 80, duration_min: 3.5, lyric_valence: null, instrumental: false, mood: { rules: mood, learned: mood }, source,
      })
      n++
    }
  }
  return songs
}

const calm = (familiarity) => ({
  mood: ROUTES.Calm.start, goal: 'Calm', length: 30, genres: [],
  texture: { lyrics: '', loudness: '', familiarity },
})

describe('FR-3 playlists from the user\'s listening', () => {
  it('builds the whole playlist from the user\'s songs when they cover the path', async () => {
    const res = await generatePlaylist(calm(''), { personal: history() })
    expect(res.fromYou).toBe(res.playlist.length)
    const total = res.playlist.reduce((s, t) => s + t.duration_min, 0)
    expect(Math.abs(total - 30)).toBeLessThanOrEqual(3)
  })

  it('familiar leads with top tracks; new never uses them', async () => {
    const fam = await generatePlaylist(calm('familiar'), { personal: history() })
    expect(fam.playlist.filter((t) => t.source === 'top').length).toBeGreaterThan(0)
    const fresh = await generatePlaylist(calm('new'), { personal: history() })
    expect(fresh.playlist.some((t) => t.source === 'top')).toBe(false)
  })

  it('falls back to the catalog with no listening history', async () => {
    const res = await generatePlaylist(calm(''), { personal: [] })
    expect(res.playlist.length).toBeGreaterThan(0)
    expect(res.fromYou).toBe(0)
  })

  it('soft picks quieter songs than loud (texture tag)', async () => {
    const tagged = history().map((s) => ({ ...s, intensity: s.mood.rules[1] }))
    const run = (loudness) => generatePlaylist({ ...calm(''), texture: { lyrics: '', loudness, familiarity: '' } }, { personal: tagged })
    const avg = (p) => p.reduce((s, t) => s + intensity(t), 0) / p.length
    const soft = await run('soft')
    const loud = await run('loud')
    expect(avg(soft.playlist)).toBeLessThan(avg(loud.playlist))
    expect(soft.playlist.every((t) => intensity(t) <= 0.1)).toBe(true)
  })

  it('live lyric scores reshape mood and drop self-harm themes', () => {
    const song = { spotify_id: 'a', source: 'top', features: LOUD_BRIGHT_MAJOR, mood: { rules: estimateMood(LOUD_BRIGHT_MAJOR) } }
    const [sad] = withLyrics([song], { a: { status: 'scored', lyric_valence: -0.8, lyric_arousal: 0, flags: '' } })
    expect(sad.mood.rules[0]).toBeLessThan(song.mood.rules[0])
    expect(sad.lyric_valence).toBe(-0.8)
    expect(withLyrics([song], { a: { status: 'scored', lyric_valence: 0, lyric_arousal: 0, flags: 'self_harm' } })).toEqual([])
  })

  it('asks for lyric scores and keeps working when the service is offline', async () => {
    let asked = 0
    const res = await generatePlaylist(calm(''), { personal: history(), scoreLyrics: async (songs) => { asked = songs.length; return {} } })
    expect(asked).toBeGreaterThan(0)
    expect(asked).toBeLessThanOrEqual(40)
    expect(res.lyrics.offline).toBe(true)
    expect(res.playlist.length).toBeGreaterThan(0)
  })

  it('keeps searching the user\'s listening until it reaches the goal mood', async () => {
    const all = history()
    const tense = all.filter((s) => s.mood.rules[1] > 0.2) // can't reach a calm ending
    const calmOnes = all.filter((s) => s.mood.rules[1] <= 0.2)
    let calls = 0
    const expand = async () => (++calls === 1 ? [] : calls === 2 ? calmOnes : null)
    const res = await generatePlaylist(calm(''), { personal: tense, expand })
    expect(calls).toBe(2) // an empty round, then the round that covered the path
    expect(res.search.covered).toBe(true)
    expect(res.search.filled).toBe(0)
    expect(res.fromYou).toBe(res.playlist.length)
  })

  it('fills only small, taste-matched gaps when the user\'s music runs out', async () => {
    const tense = history().filter((s) => s.mood.rules[1] > 0.2)
    const res = await generatePlaylist(calm(''), { personal: tense, expand: async () => null, taste: { artists: [], genres: ['indie pop'] } })
    expect(res.search.covered).toBe(false)
    expect(res.search.filled).toBeGreaterThan(0)
    expect(res.search.filled).toBeLessThan(res.fromYou) // mostly still theirs
    for (const t of res.playlist.filter((x) => x.gapFill)) expect(t.explanation).toMatch(/outside your listening/)
  })

  it('calm score steers the picks but keeps UT-3 (ends fixed, distance never increases)', () => {
    const start = [-0.4, 0.6], goal = [0.4, -0.4]
    const pool = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39
      return { song_id: i, valence: start[0] + t * 0.8, arousal: start[1] - t, duration_min: 3, bpm: 80, calm_score: i % 2 ? 0.9 : -0.9 }
    })
    const plain = orderPlaylist(pool, start, goal, 30)
    const ranked = orderPlaylist(pool, start, goal, 30, { quality: (s) => s.calm_score })
    expect(ranked[0].song_id).toBe(plain[0].song_id)
    expect(ranked.at(-1).song_id).toBe(plain.at(-1).song_id)
    for (let i = 1; i < ranked.length; i++) expect(distance(ranked[i], goal)).toBeLessThanOrEqual(distance(ranked[i - 1], goal))
    const calmShare = (p) => p.slice(1, -1).filter((s) => s.calm_score > 0).length
    expect(calmShare(ranked)).toBeGreaterThan(calmShare(plain))
  })

  it('random picks vary between runs but keep UT-3 (FR-3, NFR-5)', () => {
    const start = [-0.4, 0.6], goal = [0.4, -0.4]
    const pool = Array.from({ length: 80 }, (_, i) => {
      const t = i / 79
      return { song_id: i, valence: start[0] + t * 0.8 + ((i % 3) - 1) * 0.02, arousal: start[1] - t, duration_min: 3, bpm: 80, calm_score: 0 }
    })
    // Small seeded generator so the test is repeatable.
    const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const runs = [1, 2, 3, 4, 5].map((seed) => orderPlaylist(pool, start, goal, 30, { quality: (s) => s.calm_score, rand: seeded(seed) }))
    const closest = (p) => Math.min(...pool.map((c) => distance(c, p)))
    for (const pl of runs) {
      expect(distance(pl[0], start)).toBeLessThanOrEqual(closest(start) + 0.1)
      expect(distance(pl.at(-1), goal)).toBeLessThanOrEqual(closest(goal) + 0.1)
      for (let i = 1; i < pl.length; i++) expect(distance(pl[i], goal)).toBeLessThanOrEqual(distance(pl[i - 1], goal))
      const total = pl.reduce((s, t) => s + t.duration_min, 0)
      expect(total).toBeGreaterThanOrEqual(27)
      expect(total).toBeLessThanOrEqual(33)
    }
    const keys = new Set(runs.map((pl) => pl.map((s) => s.song_id).join(',')))
    expect(keys.size).toBeGreaterThan(1)
  })

  it('songs from recent sessions are held back when others fit', async () => {
    const once = await generatePlaylist(calm(''), { personal: history() })
    const ids = once.playlist.slice(1, -1).map((t) => t.song_id)
    const again = await generatePlaylist(calm(''), { personal: history(), recent: ids, rand: () => 0.5 })
    const repeats = again.playlist.slice(1, -1).filter((t) => ids.includes(t.song_id)).length
    expect(repeats).toBeLessThan(ids.length)
  })

  it('explanations name the audio traits and lyrics behind the mood', () => {
    const quietSad = { bpm: 68, valence: -0.5, arousal: -0.5, lyric_valence: -0.6, instrumental: false, source: 'top',
      features: { energy: 0.2, acousticness: 0.8, loudness: -16, valence: 0.2, mode: 0 } }
    const text = explain(quietSad, 'match', [-0.5, -0.5], [0.4, -0.4])
    expect(text).toMatch(/slow \(68 BPM\), low-energy, acoustic, quiet song with sad lyrics from your top tracks/)
    const catalogSong = { bpm: 120, valence: 0.5, arousal: 0.6, lyric_valence: null }
    expect(explain(catalogSong, 'settle', [0, 0], [0.5, 0.5])).toMatch(/high-energy, bright-sounding instrumental/)
  })

  it('explanations say why a personal song was picked', () => {
    const s = { bpm: 70, valence: 0, arousal: 0, source: 'top', instrumental: false }
    expect(explain(s, 'match', [0, 0], [0.4, -0.4])).toMatch(/from your top tracks/)
  })
})
