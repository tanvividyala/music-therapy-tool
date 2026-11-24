// FR-2: mood, stress (1-10), wellbeing items, goal, texture, length, genres.
import { useEffect, useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import { GOAL_TAGS, ROUTES, SESSION_LENGTHS, WELLBEING_ITEMS } from '../config.js'
import { describeMood, recommendGoal } from '../logic/questionnaire.js'

export default function Questionnaire({ onSubmit, loadTaste, busy }) {
  const [mood, setMood] = useState(null)
  const [stress, setStress] = useState(5)
  const [wellbeing, setWellbeing] = useState(WELLBEING_ITEMS.map(() => null))
  const [goal, setGoal] = useState(null)
  const [texture, setTexture] = useState({ lyrics: '', loudness: '', familiarity: '' })
  const [length, setLength] = useState(30)
  const [genres, setGenres] = useState('')
  const [artists, setArtists] = useState([])
  const [consent, setConsent] = useState(false)

  // Step 6: pre-fill from Spotify when logged in.
  useEffect(() => {
    if (!loadTaste) return
    loadTaste()
      .then((t) => {
        setGenres((g) => g || t.genres.join(', '))
        setArtists(t.artists)
      })
      .catch(() => {})
  }, [loadTaste])

  const rec = mood ? recommendGoal(mood) : null
  const wellbeingDone = wellbeing.every((w) => w !== null)
  const ready = mood && goal && ROUTES[goal] && wellbeingDone && !busy

  function submit(e) {
    e.preventDefault()
    if (!ready) return
    onSubmit({
      mood,
      stress,
      wellbeingFlags: wellbeing,
      goal,
      texture,
      length,
      genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      consent,
    })
  }

  const tex = (field, options) => (
    <span>
      {options.map(([val, label]) => (
        <label key={val} style={{ marginRight: 12 }}>
          <input
            type="radio"
            name={field}
            checked={texture[field] === val}
            onChange={() => setTexture({ ...texture, [field]: val })}
          />{' '}
          {label}
        </label>
      ))}
    </span>
  )

  return (
    <form onSubmit={submit}>
      <h2>How are you doing?</h2>
      <p className="muted">Takes about 2 minutes.</p>

      <fieldset>
        <legend>1. How are you feeling right now?</legend>
        <p className="muted">Click the spot on the grid that best matches your mood.</p>
        <MoodGrid value={mood} onChange={setMood} />
        {mood && <p>You feel: {describeMood(mood)}</p>}
      </fieldset>

      <fieldset>
        <legend>2. Stress and wellbeing</legend>
        <label>
          Stress level right now: <strong>{stress}</strong> / 10
          <br />
          <input type="range" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
        </label>
        {WELLBEING_ITEMS.map((item, i) => (
          <div key={item.id}>
            <p>{item.text}</p>
            {[[false, 'No'], [true, 'Yes']].map(([val, label]) => (
              <label key={label} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name={item.id}
                  checked={wellbeing[i] === val}
                  onChange={() => setWellbeing(wellbeing.map((w, j) => (j === i ? val : w)))}
                />{' '}
                {label}
              </label>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>3. Where do you want to end up?</legend>
        {rec && (
          <p>
            <strong>Suggestion:</strong> {rec.message}{' '}
            {goal !== rec.goal && <button type="button" onClick={() => setGoal(rec.goal)}>Use {rec.goal}</button>}
          </p>
        )}
        {GOAL_TAGS.map((g) => (
          <label key={g} style={{ marginRight: 12 }}>
            <input type="radio" name="goal" disabled={!ROUTES[g]} checked={goal === g} onChange={() => setGoal(g)} /> {g}
            {!ROUTES[g] && <span className="muted"> (coming soon)</span>}
          </label>
        ))}
        {goal && ROUTES[goal] && (
          <p className="muted">
            {goal}: towards {ROUTES[goal].endLabel.toLowerCase()}.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>4. Texture (optional)</legend>
        <div>{tex('lyrics', [['lyrics', 'Lyrics'], ['instrumental', 'Instrumental'], ['', 'No preference']])}</div>
        <div>{tex('loudness', [['soft', 'Soft'], ['loud', 'Loud'], ['', 'No preference']])}</div>
        <div>{tex('familiarity', [['familiar', 'Familiar'], ['new', 'New'], ['', 'No preference']])}</div>
      </fieldset>

      <fieldset>
        <legend>5. Session length</legend>
        {SESSION_LENGTHS.map((l) => (
          <label key={l} style={{ marginRight: 12 }}>
            <input type="radio" name="length" checked={length === l} onChange={() => setLength(l)} /> {l} min
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>6. Genres and artists</legend>
        <label>
          Genres (comma separated):{' '}
          <input value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="e.g. indie folk, classical" size={40} />
        </label>
        {artists.length > 0 && <p className="muted">Your top artists on Spotify: {artists.join(', ')}</p>}
      </fieldset>

      <fieldset>
        <legend>Pilot study (optional)</legend>
        <label>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to take
          part in the Muiso mood pilot. My before and after mood ratings are recorded on this device to compare
          sessions. This is a small feasibility pilot, not a clinical trial.
        </label>
      </fieldset>

      {!ready && !busy && (
        <p className="muted">
          Still needed: {[!mood && 'mood', !wellbeingDone && 'wellbeing answers', !goal && 'goal'].filter(Boolean).join(', ')}
        </p>
      )}
      <button type="submit" disabled={!ready}>{busy ? 'Building your playlist…' : 'Build my playlist'}</button>
    </form>
  )
}
