// TEMPORARY testing control: choose which mood estimate orders the playlist.
// Remove before the pilot so testers can't see or change it.
import { MOOD_MODELS } from '../logic/catalog.js'

const LABELS = { rules: 'Rules', learned: 'Learned' }

export default function ModelToggle({ value, onChange }) {
  return (
    <div className="model-toggle" role="radiogroup" aria-label="Mood model (testing)">
      <span className="model-toggle-title">Mood model</span>
      {MOOD_MODELS.map((m) => (
        <button
          type="button"
          key={m}
          role="radio"
          aria-checked={value === m}
          className={value === m ? 'active' : ''}
          onClick={() => onChange(m)}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  )
}
