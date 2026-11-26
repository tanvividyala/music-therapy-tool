// The aura: a soft colour field behind each screen, tied to a mood point
// (valence, arousal in [-1, 1]). It shows the iso principle on screen: the
// glow starts at the colour of where the user is and settles toward the
// colour of their goal (FR-3, FR-4).
import { useEffect } from 'react'

// Pastel corner colours of the mood grid, as OKLCH [L, C, hue].
// Tense (unpleasant, high energy) is warm apricot, excited is pale lemon,
// sad is dusk blue, relaxed is mint. The middle blends to a quiet sage.
const CORNERS = {
  tense: [0.87, 0.085, 55],
  excited: [0.9, 0.09, 105],
  sad: [0.85, 0.05, 255],
  relaxed: [0.88, 0.075, 165],
}
const CENTRE = [0.9, 0.03, 160]

const toLab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t)

// Bilinear blend of the four corners in OKLab, pulled toward the centre for
// mild moods so the middle of the grid reads calm rather than muddy.
export function moodColor([v, a]) {
  const x = (v + 1) / 2
  const y = (a + 1) / 2
  const top = mix(toLab(CORNERS.tense), toLab(CORNERS.excited), x)
  const bottom = mix(toLab(CORNERS.sad), toLab(CORNERS.relaxed), x)
  const corner = mix(bottom, top, y)
  const strength = Math.min(1, Math.hypot(v, a))
  const [L, A, B] = mix(toLab(CENTRE), corner, 0.35 + 0.65 * strength)
  const C = Math.hypot(A, B)
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(1)})`
}

// Point the single page aura (#aura in App) at a mood and a goal.
// from = null turns it off (the crisis screen stays plain).
export function useAura(from, to) {
  const key = from ? [...from, ...(to || from)].join(',') : 'off'
  useEffect(() => {
    const el = document.getElementById('aura')
    if (!el) return
    if (key === 'off') {
      el.dataset.state = 'off'
      return
    }
    const [fv, fa, tv, ta] = key.split(',').map(Number)
    el.style.setProperty('--aura-from', moodColor([fv, fa]))
    el.style.setProperty('--aura-to', moodColor([tv, ta]))
    el.dataset.state = 'on'
  }, [key])
}

// Calm default before the user has said anything: sage into mint.
export const RESTING = [0.1, -0.1]
export const RESTING_GOAL = [0.4, -0.4]
