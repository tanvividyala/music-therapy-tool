// NFR-2: questionnaire answers and mood ratings are stored only in this
// browser, keyed to the signed-in user's account, and never sent to Spotify or
// any third party. Will move to pilot.db (sessions, playlist_items) once the
// backend exists; the record shapes below follow that schema.

const key = (userId, name) => `muiso.user.${userId}.${name}`

function read(userId, name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key(userId, name))) ?? fallback
  } catch {
    return fallback
  }
}
function write(userId, name, value) {
  localStorage.setItem(key(userId, name), JSON.stringify(value))
}

// NFR-3 disclaimer acknowledgement
export const hasAcknowledged = (u) => read(u, 'disclaimerAck', false)
export const acknowledge = (u) => write(u, 'disclaimerAck', true)

// sessions table: { session_id, consent, crisis_shown, pre_valence, pre_arousal,
//   pre_stress, goal, condition, post_valence, post_arousal, post_stress,
//   debrief_skipped, created_at, items: [{ position, song_id, explanation }] }
export const getSessions = (u) => read(u, 'sessions', [])

export function saveSession(u, session) {
  const all = getSessions(u).filter((s) => s.session_id !== session.session_id)
  write(u, 'sessions', [...all, session])
}

export function updateSession(u, sessionId, patch) {
  write(u, 'sessions', getSessions(u).map((s) => (s.session_id === sessionId ? { ...s, ...patch } : s)))
}

/** FR-6: blinded, random condition order. First pilot session gets a random
 * condition; the second gets the other one. The user is never told which. */
export function nextCondition(u) {
  const done = getSessions(u).filter((s) => s.consent && s.condition && !s.crisis_shown)
  if (done.length === 0) return Math.random() < 0.5 ? 'ordered' : 'shuffled'
  const used = new Set(done.map((s) => s.condition))
  if (!used.has('ordered')) return 'ordered'
  if (!used.has('shuffled')) return 'shuffled'
  return 'ordered' // pilot complete; later sessions are normal ordered sessions
}

export function clearUserData(u) {
  Object.keys(localStorage).filter((k) => k.startsWith(`muiso.user.${u}.`)).forEach((k) => localStorage.removeItem(k))
}
