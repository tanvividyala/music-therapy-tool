// FR-1 (login, stays signed in) and FR-5 (save playlist).
// Uses the Authorization Code + PKCE flow, so no client secret lives in the
// browser. Tokens sit in localStorage so the user stays signed in across
// browser restarts until they log out.
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config.js'
import { intensity } from './logic/mood.js'

const TOKEN_KEY = 'muiso.spotify.token'
const VERIFIER_KEY = 'muiso.spotify.verifier'
const API = 'https://api.spotify.com/v1'

export const redirectUri = () => window.location.origin + import.meta.env.BASE_URL
export const spotifyConfigured = () => Boolean(SPOTIFY_CLIENT_ID)

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)))
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  localStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(' '), // NFR-2: minimal scopes only
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

async function tokenRequest(body) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...body }),
  })
  if (!res.ok) throw new Error(`Spotify token error ${res.status}`)
  const t = await res.json()
  const prev = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}')
  const token = {
    access_token: t.access_token,
    refresh_token: t.refresh_token || prev.refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  return token
}

/** Call once on page load. Finishes a login redirect if there is one. */
export async function handleRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return null
  window.history.replaceState({}, '', url.pathname)
  if (error) throw new Error(`Spotify login cancelled (${error})`)
  const verifier = localStorage.getItem(VERIFIER_KEY)
  localStorage.removeItem(VERIFIER_KEY)
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: verifier })
}

export function hasToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY))
}

async function accessToken() {
  const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
  if (!t) throw new Error('Not logged in')
  if (Date.now() < t.expires_at) return t.access_token
  return (await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token })).access_token
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  explorer = null
}

async function api(path, opts = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...opts,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...opts.headers },
  })
  if (!res.ok) {
    const err = new Error(`Spotify API ${res.status} on ${path}`)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json()
}

export const getMe = () => api('/me')

/** Questionnaire step 6: pre-fill genres and artists from the user's top artists. */
export async function topArtistsAndGenres() {
  const data = await api('/me/top/artists?limit=10&time_range=medium_term')
  const artists = data.items.map((a) => a.name)
  const counts = {}
  data.items.flatMap((a) => a.genres || []).forEach((g) => (counts[g] = (counts[g] || 0) + 1))
  const genres = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 8)
  return { artists, genres }
}

/** Find a Spotify track ID for a catalog song (catalog has no spotify_id yet). */
export async function resolveTrack(song) {
  if (song.spotify_id) return song.spotify_id
  const q = encodeURIComponent(`track:${song.title} artist:${song.artist}`)
  const data = await api(`/search?type=track&limit=1&q=${q}`)
  return data.tracks.items[0]?.id || null
}

/** FR-5: create a private playlist with the same tracks in the same order. */
export async function savePlaylist(name, description, trackIds) {
  const body = JSON.stringify({ name, description, public: false })
  let playlist
  try {
    playlist = await api('/me/playlists', { method: 'POST', body })
  } catch (e) {
    if (e.status !== 404 && e.status !== 405) throw e
    const me = await getMe()
    playlist = await api(`/users/${me.id}/playlists`, { method: 'POST', body })
  }
  const uris = trackIds.map((id) => `spotify:track:${id}`)
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = JSON.stringify({ uris: uris.slice(i, i + 100) })
    try {
      await api(`/playlists/${playlist.id}/items`, { method: 'POST', body: chunk })
    } catch (e) {
      if (e.status !== 404 && e.status !== 405) throw e
      await api(`/playlists/${playlist.id}/tracks`, { method: 'POST', body: chunk })
    }
  }
  return playlist
}

// ---------- Listening history (FR-3: songs the user knows, scored live) ----------

const RECCOBEATS = 'https://api.reccobeats.com/v1/audio-features'
const BPM_RANGE = [40, 220] // same sanity range as the catalog notebook

/** Album cover closest to 128px wide, for small thumbnails. */
function coverOf(track) {
  const imgs = track.album?.images || []
  if (!imgs.length) return null
  return [...imgs].sort((a, b) => Math.abs((a.width || 0) - 128) - Math.abs((b.width || 0) - 128))[0].url
}

/** FR-3 album art: Spotify ID and cover for a song (catalog songs carry spotify_id). */
export async function trackInfo(song) {
  if (song.spotify_id && song.image) return { id: song.spotify_id, image: song.image }
  if (song.spotify_id) {
    try {
      const t = await api(`/tracks/${song.spotify_id}`)
      return { id: t.id, image: coverOf(t) }
    } catch {
      // fall through to search
    }
  }
  const q = encodeURIComponent(`track:${song.title} artist:${song.artist}`)
  const data = await api(`/search?type=track&limit=1&q=${q}`)
  const t = data.tracks.items[0]
  return t ? { id: t.id, image: coverOf(t) } : { id: null, image: null }
}

async function searchTracks(q, limit = 10, offset = 0) {
  try {
    const data = await api(`/search?type=track&limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}`)
    return data.tracks?.items || []
  } catch {
    return [] // one failed search should not sink the whole pool
  }
}

async function searchArtists(q, limit = 10) {
  try {
    const data = await api(`/search?type=artist&limit=${limit}&q=${encodeURIComponent(q)}`)
    return data.artists?.items || []
  } catch {
    return []
  }
}

/** ReccoBeats audio features by Spotify ID, 40 per request. Sends track IDs only. */
async function audioFeatures(ids) {
  const out = {}
  for (let i = 0; i < ids.length; i += 40) {
    try {
      const res = await fetch(`${RECCOBEATS}?ids=${ids.slice(i, i + 40).join(',')}`)
      if (!res.ok) continue
      for (const it of (await res.json()).content || []) {
        const sid = (it.href || '').split('/track/')[1]
        if (sid) out[sid] = it
      }
    } catch {
      // network hiccup: these tracks just go unscored
    }
  }
  return out
}

/** Run async jobs a few at a time so Spotify doesn't rate-limit the burst. */
async function limited(jobs, size = 6) {
  const out = []
  for (let i = 0; i < jobs.length; i += size) out.push(...(await Promise.all(jobs.slice(i, i + size).map((j) => j()))))
  return out
}

/** Genres weighted by how many of the user's top artists carry them, across time ranges. */
async function genreProfile() {
  const ranges = ['short_term', 'medium_term', 'long_term']
  const lists = await Promise.all(ranges.map((r) => api(`/me/top/artists?limit=50&time_range=${r}`).catch(() => ({ items: [] }))))
  const artists = new Map()
  const weight = {}
  const artistWeight = {}
  lists.forEach((l, ri) => (l.items || []).forEach((a, rank) => {
    artists.set(a.id, a)
    // Recent listening and higher-ranked artists count a little more.
    const w = (ri === 0 ? 1.5 : 1) * (1 - rank / 100)
    artistWeight[a.id] = (artistWeight[a.id] || 0) + w
    for (const g of a.genres || []) weight[g] = (weight[g] || 0) + w
  }))
  const genres = Object.keys(weight).sort((x, y) => weight[y] - weight[x])
  const ranked = [...artists.values()].sort((x, y) => artistWeight[y.id] - artistWeight[x.id])
  return { artists: ranked, genres }
}

/** An artist's own albums and singles, as tracks with their album attached. */
async function discography(artist, maxAlbums = 6) {
  try {
    const albums = (await api(`/artists/${artist.id}/albums?include_groups=album,single&limit=10`)).items || []
    const lists = await limited(albums.slice(0, maxAlbums).map((al) => () =>
      api(`/albums/${al.id}/tracks?limit=50`).then((r) => (r.items || []).map((t) => ({ ...t, album: al }))).catch(() => [])))
    return lists.flat()
  } catch {
    // Endpoint unavailable: dig deeper into search results instead.
    const pages = await limited([20, 30, 40].map((offset) => () => searchTracks(`artist:"${artist.name}"`, 10, offset)))
    return pages.flat().filter((t) => t.artists?.some((x) => x.id === artist.id))
  }
}

let explorer = null
let explorerKey = ''

/**
 * FR-3: finds songs from the user's own listening and taste, in rounds, so the
 * playlist builder can ask for more until the user's music covers the mood path.
 * Rounds: top tracks (3 time ranges) -> more by favourite artists -> their genres
 * -> favourite artists' discographies -> deeper genre pages -> more artists.
 * source: 'top' | 'artist' | 'genre'. Kept for the page visit (per genre list).
 * Uses only user-top-read (already granted), search and public catalog
 * endpoints (NFR-2). Sends only track IDs to ReccoBeats.
 *
 * explorer.start() runs the first rounds; explorer.more() runs the next round
 * and returns its new songs, or null when there is nothing left to search.
 */
export function tasteExplorer(estimateMood, chosenGenres = []) {
  const key = chosenGenres.map((g) => g.toLowerCase()).join('|')
  if (explorer && explorerKey === key) return explorer
  explorerKey = key

  const found = new Set() // spotify ids already looked at
  const perArtist = {}
  const state = { songs: [], taste: { artists: [], genres: [] }, rounds: 0 }
  let profile = null
  let genres = []
  let started = null

  // Score a batch of new tracks and add the ones with usable audio features.
  async function score(items) {
    const fresh = []
    for (const { track, source, genre, cap } of items) {
      if (!track?.id || found.has(track.id)) continue
      const lead = track.artists?.[0]?.id
      if ((perArtist[lead] || 0) >= cap) continue
      perArtist[lead] = (perArtist[lead] || 0) + 1
      found.add(track.id)
      fresh.push({ track, source, genre })
    }
    const features = await audioFeatures(fresh.map((x) => x.track.id))
    const artistGenre = Object.fromEntries((profile?.artists || []).map((a) => [a.id, a.genres?.[0] || '']))
    const songs = []
    for (const { track, source, genre } of fresh) {
      const f = features[track.id]
      if (!f) continue
      const mood = estimateMood(f)
      if (!mood || f.tempo == null || f.tempo < BPM_RANGE[0] || f.tempo > BPM_RANGE[1]) continue
      songs.push({
        song_id: `spotify:${track.id}`,
        spotify_id: track.id,
        title: track.name,
        artist: (track.artists || []).map((a) => a.name).join(', '),
        genre: genre || artistGenre[track.artists?.[0]?.id] || '',
        bpm: f.tempo,
        duration_min: track.duration_ms / 60000,
        lyric_valence: null,
        instrumental: f.instrumentalness != null && f.instrumentalness > 0.5,
        intensity: intensity(f), // soft/loud texture tag
        // Kept so lyric scores can be folded in later (rule model, FR-3).
        features: { energy: f.energy, valence: f.valence, acousticness: f.acousticness, loudness: f.loudness, mode: f.mode },
        // Only the rule model runs in the browser, so both slots hold it.
        mood: { rules: mood, learned: mood },
        image: coverOf(track),
        source,
      })
    }
    state.songs.push(...songs)
    state.rounds++
    return songs
  }

  const byArtist = (list, offsets, cap) => limited(list.flatMap((a) => offsets.map((offset) => () =>
    searchTracks(`artist:"${a.name}"`, 10, offset).then((ts) => ts.filter((t) => t.artists?.some((x) => x.id === a.id))))))
    .then((lists) => lists.flat().map((track) => ({ track, source: 'artist', genre: '', cap })))

  const byGenre = (offsets) => limited(genres.flatMap((g) => offsets.map((offset) => () =>
    searchTracks(`genre:"${g}"`, 10, offset).then((ts) => ts.map((track) => ({ track, source: 'genre', genre: g, cap: 3 }))))))
    .then((lists) => lists.flat())

  const rounds = [
    // 2. More by favourite artists.
    async () => score(await byArtist(profile.artists.slice(0, 15), [0, 10], 4)),
    // 3. Their genres, including artists in those genres they don't already play.
    async () => {
      const favourite = new Set(profile.artists.map((a) => a.id))
      const tracks = await byGenre([0, 10, 20])
      const newArtists = (await limited(genres.map((g) => () => searchArtists(`genre:"${g}"`).then((as) =>
        as.filter((a) => !favourite.has(a.id)).slice(0, 3).map((a) => [a, g]))))).flat()
      const theirs = await limited(newArtists.map(([a, g]) => () => searchTracks(`artist:"${a.name}"`).then((ts) =>
        ts.filter((t) => t.artists?.some((x) => x.id === a.id)).map((track) => ({ track, source: 'genre', genre: g, cap: 3 })))))
      return score([...tracks, ...theirs.flat()])
    },
    // 4. Favourite artists' discographies (albums and singles).
    async () => {
      const lists = await limited(profile.artists.slice(0, 10).map((a) => () => discography(a)), 3)
      return score(lists.flat().map((track) => ({ track, source: 'artist', genre: '', cap: 12 })))
    },
    // 5. Deeper genre pages.
    async () => score(await byGenre([30, 40, 50])),
    // 6. Further down the favourite-artist list.
    async () => score(await byArtist(profile.artists.slice(15, 40), [0], 3)),
  ]
  let next = 0

  state.start = () => {
    started ||= (async () => {
      const [tops, p] = await Promise.all([
        Promise.all(['short_term', 'medium_term', 'long_term'].map((r) =>
          api(`/me/top/tracks?limit=50&time_range=${r}`).catch(() => ({ items: [] })))),
        genreProfile(),
      ])
      profile = p
      // The user's own words win; Spotify's profile fills up to six genres.
      genres = [...new Set([...chosenGenres.map((g) => g.toLowerCase()), ...p.genres])].slice(0, 6)
      state.taste = { artists: p.artists.map((a) => a.name), genres }
      // 1. Their top tracks.
      await score(tops.flatMap((t) => t.items || []).map((track) => ({ track, source: 'top', genre: '', cap: Infinity })))
      await state.more() // and more by their favourite artists
      return state
    })()
    return started
  }

  state.more = async () => {
    if (next >= rounds.length) return null
    return rounds[next++]()
  }

  explorer = state
  return state
}

export function clearListeningPool() {
  explorer = null
}
