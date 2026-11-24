// FR-1 (login, stays signed in) and FR-5 (save playlist).
// Uses the Authorization Code + PKCE flow, so no client secret lives in the
// browser. Tokens sit in localStorage so the user stays signed in across
// browser restarts until they log out.
import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from './config.js'

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
