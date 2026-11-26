// The session drawn as colour (FR-3, FR-4): one band per track, as wide as
// the track is long, tinted with that track's mood colour. Read left to right
// it shows the iso path from the start mood to the goal.
import { moodColor } from '../aura.js'

export default function MoodRibbon({ playlist, current = null }) {
  return (
    <div className="ribbon" role="img" aria-label={`Mood path across ${playlist.length} tracks, from your starting mood to your goal`}>
      {playlist.map((t, i) => (
        <span
          key={t.song_id}
          className={`ribbon-band${i === current ? ' is-current' : ''}`}
          style={{ flexGrow: t.duration_min, background: moodColor([t.valence, t.arousal]) }}
        />
      ))}
    </div>
  )
}
