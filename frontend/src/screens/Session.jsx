// FR-4: guided session. Plays in the browser (Spotify embed when the track is
// resolved, otherwise a simulated timer) and shows stage label, commentary
// and a visual for each track. Every track change updates all three.
import { useEffect, useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import { fmtMin } from './Playlist.jsx'

const COMMENTARY = {
  match: (t) => `Meeting you where you are. "${t.title}" reflects how you feel right now. Let it sit with you; there's nothing to change yet.`,
  shift: (t) => `Starting to shift. "${t.title}" nudges the mood a little closer to where you want to be. Notice your breathing as it plays.`,
  settle: (t) => `Settling in. "${t.title}" is close to your goal. Let yourself stay here and enjoy it.`,
}
const STAGE_COLOR = { match: '#c33', shift: '#c80', settle: '#26c' }

export default function Session({ result, blinded, onEnd }) {
  const { playlist, start, goal } = result
  const [i, setI] = useState(0)
  const [elapsed, setElapsed] = useState(0) // seconds, simulated playback
  const [playing, setPlaying] = useState(false)
  const track = playlist[i]
  const durSec = track.duration_min * 60

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
    <section>
      <p className="muted">Track {i + 1} of {playlist.length}</p>
      {!blinded && (
        <h2 style={{ color: STAGE_COLOR[track.stage] }} data-testid="stage-label">
          Stage: {track.stage.toUpperCase()}
        </h2>
      )}
      <h3>{track.title} <span className="muted">by {track.artist}</span></h3>
      <p data-testid="commentary">{blinded ? `Now playing "${track.title}". Just listen and notice how you feel.` : COMMENTARY[track.stage](track)}</p>

      {track.spotify_id ? (
        <iframe
          key={track.spotify_id}
          title={`Spotify player: ${track.title}`}
          src={`https://open.spotify.com/embed/track/${track.spotify_id}?utm_source=generator`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <div>
          <p className="muted">Simulated playback (demo mode or track not found on Spotify).</p>
          <progress value={elapsed} max={durSec} style={{ width: '100%' }} />
          <div className="muted">{fmtMin(elapsed / 60)} / {fmtMin(track.duration_min)}</div>
          <button onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
        </div>
      )}

      {!blinded && (
        <MoodGrid
          path={playlist.map((t) => [t.valence, t.arousal])}
          current={[track.valence, track.arousal]}
          markers={[
            { label: 'start', point: start, color: '#c33' },
            { label: 'goal', point: goal, color: '#26c' },
          ]}
        />
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={() => go(i - 1)} disabled={i === 0}>Previous</button>{' '}
        <button onClick={() => go(i + 1)} disabled={i === playlist.length - 1}>Next</button>{' '}
        <button onClick={onEnd}>End session</button>
      </div>
      <p className="muted">{track.explanation}</p>
    </section>
  )
}
