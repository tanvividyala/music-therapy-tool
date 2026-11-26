// FR-4: guided session. Plays in the browser (Spotify embed when the track is
// resolved, otherwise a simulated timer) and shows stage label, commentary
// and a visual for each track. Every track change updates all three.
// The aura drifts to each track's mood colour; blinded pilot sessions keep it
// still so the colour cannot reveal ordered vs shuffled.
import { useEffect, useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import MoodRibbon from '../components/MoodRibbon.jsx'
import { useAura } from '../aura.js'
import { fmtMin } from './Playlist.jsx'

const COMMENTARY = {
  match: (t) => `Meeting you where you are. “${t.title}” reflects how you feel right now. Let it sit with you; there’s nothing to change yet.`,
  shift: (t) => `Starting to shift. “${t.title}” nudges the mood a little closer to where you want to be. Notice your breathing as it plays.`,
  settle: (t) => `Settling in. “${t.title}” is close to your goal. Let yourself stay here and enjoy it.`,
}

export default function Session({ result, blinded, onEnd }) {
  const { playlist, start, goal } = result
  const [i, setI] = useState(0)
  const [elapsed, setElapsed] = useState(0) // seconds, simulated playback
  const [playing, setPlaying] = useState(false)
  const track = playlist[i]
  const durSec = track.duration_min * 60
  useAura(blinded ? start : [track.valence, track.arousal], goal)

  const go = (n) => {
    setI(n)
    setElapsed(0)
  }
  useEffect(() => {
    if (!playing || track.spotify_id) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [playing, track.spotify_id])
  useEffect(() => {
    if (elapsed >= durSec && i < playlist.length - 1) go(i + 1)
  }, [elapsed, durSec, i, playlist.length])

  return (
    <section className="session">
      {!blinded && <MoodRibbon playlist={playlist} current={i} />}
      <div className="session-body">
        <div className="session-now">
          <p className="muted num">Track {i + 1} of {playlist.length}</p>
          {!blinded && (
            <h2 className={`stage-word stage-${track.stage}`} data-testid="stage-label">
              <span className="visually-hidden">Stage: </span>
              {track.stage.toUpperCase()}
            </h2>
          )}
          <div className="session-title">
            {track.image && (
              <a href={`https://open.spotify.com/track/${track.spotify_id}`} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} in Spotify`}>
                <img className="session-cover" src={track.image} alt="" width="88" height="88" />
              </a>
            )}
            <h3 className="session-track">
              {track.title} <span className="muted">by {track.artist}</span>
            </h3>
          </div>
          <p className="commentary" data-testid="commentary">
            {blinded ? `Now playing “${track.title}”. Just listen and notice how you feel.` : COMMENTARY[track.stage](track)}
          </p>

          {track.spotify_id ? (
            <iframe
              key={track.spotify_id}
              className="player"
              title={`Spotify player: ${track.title}`}
              src={`https://open.spotify.com/embed/track/${track.spotify_id}?utm_source=generator`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          ) : (
            <div className="sim-player">
              <p className="muted">Simulated playback (demo mode or track not found on Spotify).</p>
              <div className="sim-row">
                <button type="button" className="btn btn-secondary" onClick={() => setPlaying(!playing)}>
                  {playing ? 'Pause' : 'Play'}
                </button>
                <progress value={elapsed} max={durSec} aria-label="Track progress" />
                <span className="muted num">{fmtMin(elapsed / 60)} / {fmtMin(track.duration_min)}</span>
              </div>
            </div>
          )}

          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => go(i - 1)} disabled={i === 0}>Previous</button>
            <button type="button" className="btn btn-secondary" onClick={() => go(i + 1)} disabled={i === playlist.length - 1}>Next</button>
            <button type="button" className="btn btn-quiet" onClick={onEnd}>End session</button>
          </div>
          <p className="muted">{track.explanation}</p>
        </div>

        {!blinded && (
          <div className="session-grid">
            <MoodGrid
              path={playlist.map((t) => [t.valence, t.arousal])}
              pathLabels={playlist.map((t, n) => ({ n: n + 1, title: t.title, artist: t.artist, stage: t.stage }))}
              current={[track.valence, track.arousal]}
              markers={[
                { label: 'start', point: start, color: 'var(--color-start)' },
                { label: 'goal', point: goal, color: 'var(--color-goal)' },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  )
}
