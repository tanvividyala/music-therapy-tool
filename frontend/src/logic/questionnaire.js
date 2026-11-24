// Mirrors src/tmr/questionnaire.py. FR-2 (questionnaire with crisis safeguard).
import { DISTRESS_STRESS_THRESHOLD, ROUTES } from '../config.js'

/**
 * UT-1: True when answers suggest severe distress (show crisis resources).
 * answers = { stress: 1-10, wellbeingFlags: boolean[] }
 * PLACEHOLDER RULE: stress >= threshold, or any wellbeing item flagged.
 * Only returns a boolean; never saves data or starts a playlist.
 */
export function isDistress(answers) {
  const flags = answers.wellbeingFlags || []
  return answers.stress >= DISTRESS_STRESS_THRESHOLD || flags.some(Boolean)
}

export function routePoints(goal) {
  const route = ROUTES[goal]
  if (!route) throw new Error(`No route defined for goal "${goal}"`)
  return [route.start, route.end]
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Spec section 2: after step 3, recommend the goal whose typical start mood is
 * closest to how the user feels now. The user can always override it. */
export function recommendGoal(mood) {
  let best = null
  for (const [goal, r] of Object.entries(ROUTES)) {
    const d = dist(mood, r.start)
    if (!best || d < best.d) best = { goal, d }
  }
  const r = ROUTES[best.goal]
  return { goal: best.goal, message: `Feeling ${r.startLabel.toLowerCase()}? Try ${best.goal}.` }
}

export function describeMood([v, a]) {
  const pleasant = v > 0.2 ? 'pleasant' : v < -0.2 ? 'unpleasant' : 'neutral'
  const energy = a > 0.2 ? 'high energy' : a < -0.2 ? 'low energy' : 'medium energy'
  return `${pleasant}, ${energy}`
}
