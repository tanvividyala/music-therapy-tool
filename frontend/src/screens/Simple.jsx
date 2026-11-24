// Small screens: Login (FR-1), Disclaimer (NFR-3), Crisis (FR-2).
import { useState } from 'react'
import { CRISIS_RESOURCES, SPOTIFY_SCOPES } from '../config.js'
import { spotifyConfigured } from '../spotify.js'

export function Login({ onSpotify, onDemo, error }) {
  return (
    <section>
      <h1>Muiso</h1>
      <p>Therapeutic music playlists that start where you are and move you toward where you want to be.</p>
      {error && <p className="error">{error}</p>}
      <button onClick={onSpotify} disabled={!spotifyConfigured()}>Log in with Spotify</button>
      {!spotifyConfigured() && (
        <p className="muted">Spotify login is not configured for this build (no VITE_SPOTIFY_CLIENT_ID).</p>
      )}
      <p className="muted">
        Muiso asks Spotify only for: {SPOTIFY_SCOPES.join(', ')} (saving playlists you ask for, and reading your top
        artists to suggest genres).
      </p>
      <hr />
      <button onClick={onDemo}>Continue in demo mode (no Spotify)</button>
    </section>
  )
}

export function Disclaimer({ onAccept }) {
  const [checked, setChecked] = useState(false)
  return (
    <section>
      <h2>Before you start</h2>
      <p>
        <strong>Muiso is not a clinical or diagnostic tool.</strong> It suggests music for everyday self-care. It does
        not diagnose or treat any mental health condition and is not a substitute for professional care.
      </p>
      <p>If you are struggling, please reach out to a professional:</p>
      <CrisisList />
      <p>
        Your questionnaire answers and mood ratings are stored only on this device, linked to your account, and are
        never shared with Spotify or any third party.
      </p>
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I understand that
        Muiso is not a clinical or diagnostic tool.
      </label>
      <div>
        <button disabled={!checked} onClick={onAccept}>Continue</button>
      </div>
    </section>
  )
}

export function CrisisList() {
  return (
    <ul>
      {CRISIS_RESOURCES.map((r) => (
        <li key={r.name}>
          <strong>{r.name}</strong>: {r.detail}
        </li>
      ))}
    </ul>
  )
}

export function Crisis({ onBack }) {
  return (
    <section role="alert">
      <h2>You don't have to go through this alone</h2>
      <p>
        Your answers suggest you may be going through a really hard time right now. Instead of a playlist, here are
        people who can help, any time of day:
      </p>
      <CrisisList />
      <p>If you are in immediate danger, call 911 or your local emergency number now.</p>
      <button onClick={onBack}>Return to questionnaire</button>
    </section>
  )
}
