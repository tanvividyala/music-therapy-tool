// Small screens: Login (FR-1), Disclaimer (NFR-3), Crisis (FR-2).
import { useState } from 'react'
import { CRISIS_RESOURCES, SPOTIFY_SCOPES } from '../config.js'
import { spotifyConfigured } from '../spotify.js'
import { RESTING, RESTING_GOAL, useAura } from '../aura.js'
import MoodGrid from '../components/MoodGrid.jsx'

// Spotify's icon (brand mark), drawn in the button's text colour.
function SpotifyIcon() {
  return (
    <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
      />
    </svg>
  )
}

export function Login({ onSpotify, onDemo, error }) {
  useAura(RESTING, RESTING_GOAL)
  return (
    <section className="login">
      <div className="login-copy">
        <h1 className="login-mark">Muiso</h1>
        <p className="lead">Therapeutic music playlists that start where you are and move you toward where you want to be.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onSpotify} disabled={!spotifyConfigured()}>
            <SpotifyIcon />
            Log in with Spotify
          </button>
          <button type="button" className="btn btn-secondary" onClick={onDemo}>
            Continue in demo mode (no Spotify)
          </button>
        </div>
        {!spotifyConfigured() && (
          <p className="muted">Spotify login is not configured for this build (no VITE_SPOTIFY_CLIENT_ID).</p>
        )}
        <p className="muted">
          Muiso asks Spotify only for: {SPOTIFY_SCOPES.join(', ')} (saving playlists you ask for, and reading your top
          artists to suggest genres).
        </p>
      </div>
      <div className="login-field">
        <MoodGrid />
      </div>
    </section>
  )
}

export function Disclaimer({ onAccept }) {
  const [checked, setChecked] = useState(false)
  useAura(RESTING, RESTING_GOAL)
  return (
    <section className="sheet">
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
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I understand that
        Muiso is not a clinical or diagnostic tool.
      </label>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!checked} onClick={onAccept}>Continue</button>
      </div>
    </section>
  )
}

export function CrisisList() {
  return (
    <ul className="crisis-list">
      {CRISIS_RESOURCES.map((r) => (
        <li key={r.name}>
          <strong>{r.name}</strong>: {r.detail}
        </li>
      ))}
    </ul>
  )
}

export function Crisis({ onBack }) {
  useAura(null) // no glow here: plain and easy to read
  return (
    <section role="alert" className="sheet crisis">
      <h2>You don’t have to go through this alone</h2>
      <p>
        Your answers suggest you may be going through a really hard time right now. Instead of a playlist, here are
        people who can help, any time of day:
      </p>
      <CrisisList />
      <p>If you are in immediate danger, call 911 or your local emergency number now.</p>
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>Return to questionnaire</button>
      </div>
    </section>
  )
}
