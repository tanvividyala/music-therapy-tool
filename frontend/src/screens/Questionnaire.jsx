// FR-2: mood, stress (1-10), wellbeing items, goal, texture, length, genres.
import { useEffect, useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import { GOAL_TAGS, ROUTES, SESSION_LENGTHS, WELLBEING_ITEMS } from '../config.js'
import { describeMood, recommendGoal } from '../logic/questionnaire.js'
import { RESTING, useAura } from '../aura.js'

// One choice rendered as a soft chip; the real radio stays in the label.
function Chip({ name, checked, onChange, disabled, children }) {
  return (
    <label className={`chip${disabled ? ' is-disabled' : ''}`}>
      <input type="radio" className="visually-hidden" name={name} checked={checked} onChange={onChange} disabled={disabled} />
      <span>{children}</span>
    </label>
  )
}

export default function Questionnaire({ onSubmit, loadTaste, busy }) {
  const [mood, setMood] = useState(null)
  const [stress, setStress] = useState(5)
  const [wellbeing, setWellbeing] = useState(WELLBEING_ITEMS.map(() => null))
  const [goal, setGoal] = useState(null)
  const [texture, setTexture] = useState({ lyrics: '', loudness: '', familiarity: '' })
  const [length, setLength] = useState(30)
  const [genres, setGenres] = useState('')
  const [artists, setArtists] = useState([])

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

  // The aura sits on the chosen mood, and leans toward the goal once one is picked.
  useAura(mood || RESTING, goal && ROUTES[goal] ? ROUTES[goal].end : mood || RESTING)

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
    })
  }

  const tex = (field, title, options) => (
    <div className="choice-row" role="radiogroup" aria-label={title}>
      <span className="choice-title">{title}</span>
      <div className="chips">
        {options.map(([val, label]) => (
          <Chip key={val} name={field} checked={texture[field] === val} onChange={() => setTexture({ ...texture, [field]: val })}>
            {label}
          </Chip>
        ))}
      </div>
    </div>
  )

  return (
    <form className="questionnaire" onSubmit={submit}>
      <div className="q-head">
        <h2>How are you doing?</h2>
        <p className="muted">Takes about 2 minutes.</p>
      </div>

      <fieldset className="step step-mood">
        <legend>1. How are you feeling right now?</legend>
        <p className="muted">Click the spot on the grid that best matches your mood.</p>
        <MoodGrid value={mood} onChange={setMood} />
        {mood && <p className="mood-read">You feel: {describeMood(mood)}</p>}
      </fieldset>

      <div className="q-steps">
        <fieldset className="step">
          <legend>2. Stress and wellbeing</legend>
          <label className="range">
            <span>
              Stress level right now: <strong className="num">{stress}</strong> / 10
            </span>
            <input type="range" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
          </label>
          {WELLBEING_ITEMS.map((item, i) => (
            <div key={item.id} className="choice-row" role="radiogroup" aria-label={item.text}>
              <p>{item.text}</p>
              <div className="chips">
                {[[false, 'No'], [true, 'Yes']].map(([val, label]) => (
                  <Chip
                    key={label}
                    name={item.id}
                    checked={wellbeing[i] === val}
                    onChange={() => setWellbeing(wellbeing.map((w, j) => (j === i ? val : w)))}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="step">
          <legend>3. Where do you want to end up?</legend>
          {rec && (
            <p className="suggestion">
              <strong>Suggestion:</strong> {rec.message}{' '}
              {goal !== rec.goal && (
                <button type="button" className="btn btn-quiet" onClick={() => setGoal(rec.goal)}>Use {rec.goal}</button>
              )}
            </p>
          )}
          <div className="chips">
            {GOAL_TAGS.map((g) => (
              <Chip key={g} name="goal" disabled={!ROUTES[g]} checked={goal === g} onChange={() => setGoal(g)}>
                {g}
                {!ROUTES[g] && <span className="chip-note"> (coming soon)</span>}
              </Chip>
            ))}
          </div>
          {goal && ROUTES[goal] && (
            <p className="muted">
              {goal}: towards {ROUTES[goal].endLabel.toLowerCase()}.
            </p>
          )}
        </fieldset>

        <fieldset className="step">
          <legend>4. Texture (optional)</legend>
          {tex('lyrics', 'Vocals', [['lyrics', 'Lyrics'], ['instrumental', 'Instrumental'], ['', 'No preference']])}
          {tex('loudness', 'Volume', [['soft', 'Soft'], ['loud', 'Loud'], ['', 'No preference']])}
          {tex('familiarity', 'Familiarity', [['familiar', 'Familiar'], ['new', 'New'], ['', 'No preference']])}
        </fieldset>

        <fieldset className="step">
          <legend>5. Session length</legend>
          <div className="chips">
            {SESSION_LENGTHS.map((l) => (
              <Chip key={l} name="length" checked={length === l} onChange={() => setLength(l)}>
                <span className="num">{l}</span> min
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="step">
          <legend>6. Genres and artists</legend>
          <label className="field">
            <span>Genres (comma separated)</span>
            <input
              className="input"
              name="genres"
              autoComplete="off"
              value={genres}
              onChange={(e) => setGenres(e.target.value)}
              placeholder="e.g. indie folk, classical"
            />
          </label>
          {artists.length > 0 && <p className="muted">Your top artists on Spotify: {artists.join(', ')}</p>}
        </fieldset>

        <div className="submit-bar">
          {!ready && !busy && (
            <p className="muted">
              Still needed: {[!mood && 'mood', !wellbeingDone && 'wellbeing answers', !goal && 'goal'].filter(Boolean).join(', ')}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {busy ? 'Building your playlist…' : 'Build my playlist'}
          </button>
        </div>
      </div>
    </form>
  )
}
