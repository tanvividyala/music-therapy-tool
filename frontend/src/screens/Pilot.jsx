// FR-6: optional post-session debrief and pilot comparison.
import { useState } from 'react'
import MoodGrid from '../components/MoodGrid.jsx'
import { WELLBEING_ITEMS } from '../config.js'
import { RESTING, RESTING_GOAL, useAura } from '../aura.js'

export function Debrief({ onSubmit, onSkip }) {
  const [mood, setMood] = useState(null)
  const [stress, setStress] = useState(5)
  const [wellbeing, setWellbeing] = useState(WELLBEING_ITEMS.map(() => false))
  useAura(mood || RESTING, mood || RESTING)
  return (
    <section className="debrief">
      <div className="debrief-grid">
        <h2>Quick debrief (optional)</h2>
        <p>How are you feeling now that the session is over?</p>
        <MoodGrid value={mood} onChange={setMood} />
      </div>
      <div className="debrief-form">
      <label className="range">
        <span>
          Stress level now: <strong className="num">{stress}</strong> / 10
        </span>
        <input type="range" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
      </label>
      {WELLBEING_ITEMS.map((item, i) => (
        <div key={item.id}>
          <label className="check">
            <input
              type="checkbox"
              checked={wellbeing[i]}
              onChange={(e) => setWellbeing(wellbeing.map((w, j) => (j === i ? e.target.checked : w)))}
            />{' '}
            {item.text}
          </label>
        </div>
      ))}
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!mood} onClick={() => onSubmit({ mood, stress, wellbeingFlags: wellbeing })}>Submit</button>
        <button type="button" className="btn btn-quiet" onClick={onSkip}>Skip</button>
      </div>
      </div>
    </section>
  )
}

const r2 = (x) => (x == null ? '–' : (Math.round(x * 100) / 100).toString())
const signed = (x) => (x == null ? '–' : `${x > 0 ? '+' : ''}${r2(x)}`)

export function moodChange(s) {
  if (s.post_valence == null) return null
  return {
    valence: s.post_valence - s.pre_valence,
    arousal: s.post_arousal - s.pre_arousal,
    stress: s.post_stress - s.pre_stress,
  }
}

export function PilotResults({ sessions, onBack }) {
  const pilot = sessions.filter((s) => s.consent && !s.crisis_shown)
  const skipped = pilot.filter((s) => s.debrief_skipped).length
  const latest = (cond) => [...pilot].reverse().find((s) => s.condition === cond && moodChange(s))
  const o = latest('ordered')
  const sh = latest('shuffled')
  useAura(RESTING, RESTING_GOAL)
  const diff = o && sh ? Object.fromEntries(Object.keys(moodChange(o)).map((k) => [k, moodChange(o)[k] - moodChange(sh)[k]])) : null

  return (
    <section className="pilot">
      <h2>Mood pilot</h2>
      <p className="muted">
        Small feasibility pilot, not clinical evidence. Complete one session on one day and another on a different day;
        Muiso assigns ordered or shuffled at random without telling you which.
      </p>
      <p className="num">Pilot sessions: {pilot.length}. Skipped debriefs: {skipped}.</p>
      {pilot.length > 0 && (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>Goal</th><th>Condition</th><th>Pre (V, A, stress)</th><th>Post (V, A, stress)</th><th>Change (V, A, stress)</th>
            </tr>
          </thead>
          <tbody>
            {pilot.map((s) => {
              const c = moodChange(s)
              return (
                <tr key={s.session_id}>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>{s.goal}</td>
                  <td>{s.condition}</td>
                  <td className="num">{r2(s.pre_valence)}, {r2(s.pre_arousal)}, {s.pre_stress}</td>
                  <td className="num">{s.debrief_skipped ? 'skipped' : `${r2(s.post_valence)}, ${r2(s.post_arousal)}, ${s.post_stress ?? '–'}`}</td>
                  <td className="num">{c ? `${signed(c.valence)}, ${signed(c.arousal)}, ${signed(c.stress)}` : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}
      <h3>Ordered vs shuffled</h3>
      {diff ? (
        <p>
          Ordered minus shuffled mood change: valence {signed(diff.valence)}, arousal {signed(diff.arousal)}, stress{' '}
          {signed(diff.stress)}.
        </p>
      ) : (
        <p className="muted">Needs one completed debrief in each condition.</p>
      )}
      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
    </section>
  )
}
