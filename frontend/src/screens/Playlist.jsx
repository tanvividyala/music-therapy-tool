// FR-3 (show playlist + explanations), FR-5 (save to Spotify).
import { useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import MoodRibbon from '../components/MoodRibbon.jsx'
import { moodColor, useAura } from '../aura.js'

// Names for the learned model the catalog notebook exported (catalog.json meta).
const LEARNED_NAMES = { ridge: 'ridge regression', grad_boost: 'gradient boosting' }

export const fmtMin = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`

export default function Playlist({ result, goalName, blinded, loggedIn, onSave, onStart, onRestart }) {
  const { playlist, start, goal, elapsedMs } = result
  const [saveState, setSaveState] = useState({ status: 'idle' })
  const total = playlist.reduce((s, t) => s + t.duration_min, 0)
  useAura(start, goal)

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
    <section className="playlist">
      <div className="playlist-head">
        <h2>Your {goalName} playlist</h2>
        <p className="muted num">
          {playlist.length} tracks, {fmtMin(total)} total. Generated in {(elapsedMs / 1000).toFixed(2)} s.
        </p>
        {/* TEMPORARY: which mood model and catalog produced this playlist. */}
        <p className="muted test-note">
          Mood model: <strong>{result.model === 'learned' ? `Learned (${LEARNED_NAMES[result.learnedModel] || result.learnedModel || 'fitted model'})` : 'Rules (literature-based)'}</strong>.{' '}
          {result.model === 'learned' && result.personalSize > 0 && 'Your Spotify songs always use the rules, since only they run in the browser. '}
          {result.catalogSource === 'catalog'
            ? `Catalog of ${result.catalogSize.toLocaleString()} MuSe songs.`
            : `Sample catalog (${result.catalogSize} hand-picked songs; catalog.json not found).`}{' '}
          {result.personalSize > 0 && `${result.fromYou} of ${playlist.length} tracks come from your Spotify listening (${result.personalSize} of your songs scored`}
          {result.personalSize > 0 && (result.search?.rounds ? `, ${result.search.rounds} extra search round${result.search.rounds === 1 ? '' : 's'}). ` : '). ')}
          {result.search?.filled > 0 && `${result.search.filled} filler track${result.search.filled === 1 ? '' : 's'} from outside your listening, because none of your songs reached that mood. `}
          {result.lyrics?.asked > 0 &&
            (result.lyrics.offline
              ? 'Lyrics service offline, so your songs use audio features only. '
              : `Lyrics scored live for ${result.lyrics.scored} of ${result.lyrics.asked} of your songs. `)}
          Toggle the model in the corner and start over to compare.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onStart}>Start guided session</button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={save}
            disabled={!loggedIn || saveState.status === 'saving' || saveState.status === 'saved'}
          >
            {saveState.status === 'saving' ? 'Saving…' : 'Save to Spotify'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onRestart}>Start over</button>
        </div>
        {!loggedIn && <p className="muted">Log in with Spotify to save this playlist.</p>}
        <div role="status">
          {saveState.status === 'saved' && (
            <p>
              Saved to your Spotify library as a private playlist.{' '}
              <a href={saveState.url} target="_blank" rel="noreferrer">Open in Spotify</a>
              {saveState.missing?.length > 0 && <> ({saveState.missing.length} track(s) not found on Spotify: {saveState.missing.join(', ')})</>}
            </p>
          )}
          {saveState.status === 'error' && <p className="error">Could not save: {saveState.message}</p>}
        </div>
      </div>

      {!blinded && (
        <div className="playlist-path">
          <MoodRibbon playlist={playlist} />
          <MoodGrid
            path={playlist.map((t) => [t.valence, t.arousal])}
            pathLabels={playlist.map((t, n) => ({ n: n + 1, title: t.title, artist: t.artist, stage: t.stage }))}
            markers={[
              { label: 'you now', point: start, color: 'var(--color-start)' },
              { label: 'goal', point: goal, color: 'var(--color-goal)' },
            ]}
          />
        </div>
      )}

      <ol className="tracks">
        {playlist.map((t, n) => (
          <li key={t.song_id} className="track">
            <span className={`track-art${t.image ? ' has-cover' : ''}`}>
              {t.image && (
                <a href={`https://open.spotify.com/track/${t.spotify_id}`} target="_blank" rel="noreferrer" aria-label={`Open ${t.title} in Spotify`}>
                  <img src={t.image} alt="" width="56" height="56" loading="lazy" />
                </a>
              )}
              <span
                className="track-no num"
                style={blinded ? undefined : { background: moodColor([t.valence, t.arousal]) }}
                aria-hidden="true"
              >
                {n + 1}
              </span>
            </span>
            <div className="track-main">
              <p className="track-title">
                <strong>{t.title}</strong> by {t.artist}
              </p>
              <p className="track-why">
                {!blinded && <span className={`stage-tag stage-${t.stage}`}>{t.stage}</span>} {t.explanation}
              </p>
            </div>
            <p className="track-meta muted num">
              {[t.genre, `${Math.round(t.bpm)} BPM`, fmtMin(t.duration_min)].filter(Boolean).join(', ')}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
