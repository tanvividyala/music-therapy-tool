// FR-3 (show playlist + explanations), FR-5 (save to Spotify).
import { useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'

export const fmtMin = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`

export default function Playlist({ result, goalName, blinded, loggedIn, onSave, onStart, onRestart }) {
  const { playlist, start, goal, elapsedMs } = result
  const [saveState, setSaveState] = useState({ status: 'idle' })
  const total = playlist.reduce((s, t) => s + t.duration_min, 0)

  async function save() {
    setSaveState({ status: 'saving' })
    try {
      const res = await onSave()
      setSaveState({ status: 'saved', ...res })
    } catch (e) {
      setSaveState({ status: 'error', message: e.message })
    }
  }

  return (
    <section>
      <h2>Your {goalName} playlist</h2>
      <p className="muted">
        {playlist.length} tracks, {fmtMin(total)} total. Generated in {(elapsedMs / 1000).toFixed(2)} s.
      </p>
      {!blinded && (
        <MoodGrid
          path={playlist.map((t) => [t.valence, t.arousal])}
          markers={[
            { label: 'you now', point: start, color: '#c33' },
            { label: 'goal', point: goal, color: '#26c' },
          ]}
        />
      )}
      <ol>
        {playlist.map((t) => (
          <li key={t.song_id} style={{ marginBottom: 8 }}>
            <strong>{t.title}</strong> by {t.artist} <span className="muted">({t.genre}, {Math.round(t.bpm)} BPM, {fmtMin(t.duration_min)})</span>
            <br />
            {!blinded && <em>[{t.stage}]</em>} {t.explanation}
          </li>
        ))}
      </ol>
      <button onClick={onStart}>Start guided session</button>{' '}
      <button onClick={save} disabled={!loggedIn || saveState.status === 'saving' || saveState.status === 'saved'}>
        {saveState.status === 'saving' ? 'Saving…' : 'Save to Spotify'}
      </button>{' '}
      <button onClick={onRestart}>Start over</button>
      {!loggedIn && <p className="muted">Log in with Spotify to save this playlist.</p>}
      {saveState.status === 'saved' && (
        <p>
          Saved to your Spotify library as a private playlist.{' '}
          <a href={saveState.url} target="_blank" rel="noreferrer">Open in Spotify</a>
          {saveState.missing?.length > 0 && <> ({saveState.missing.length} track(s) not found on Spotify: {saveState.missing.join(', ')})</>}
        </p>
      )}
      {saveState.status === 'error' && <p className="error">Could not save: {saveState.message}</p>}
    </section>
  )
}
