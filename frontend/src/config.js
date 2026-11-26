// Mirrors src/tmr/config.py. Keep the two in sync until the frontend calls the
// Python backend directly.
// Mood points are [valence, arousal] on a -1..+1 scale.

// PLACEHOLDER distress rule (FR-2, UT-1). Swap here without code changes.
export const DISTRESS_STRESS_THRESHOLD = 9 // stress 1-10; this or higher triggers

export const WELLBEING_ITEMS = [
  { id: 'hopeless', text: 'Over the last two weeks, have you often felt down, depressed or hopeless?' },
  { id: 'cope', text: 'Right now, do you feel unable to cope or keep yourself safe?' },
  { id: 'sleep', text: 'Have you been unable to sleep or function day to day?' },
]

// NFR-5
export const SESSION_LENGTHS = [30, 45, 60]
export const LENGTH_TOLERANCE_MIN = 3

// Routes table (spec section 3). "Hype" is a goal tag with no route yet.
export const ROUTES = {
  Calm: { start: [-0.4, 0.6], end: [0.4, -0.4], startLabel: 'Anxious or stressed', endLabel: 'Relaxed and content', maxBpm: 120 },
  Focus: { start: [-0.1, 0.5], end: [0.2, 0.0], startLabel: 'Restless or scattered', endLabel: 'Steady and engaged', maxBpm: 130 },
  Sleep: { start: [-0.2, 0.3], end: [0.2, -0.8], startLabel: 'Wired or tired', endLabel: 'Drowsy and peaceful', maxBpm: 110 },
  Uplift: { start: [-0.5, -0.4], end: [0.6, 0.5], startLabel: 'Low or down', endLabel: 'Bright and upbeat', maxBpm: null },
  Release: { start: [-0.6, -0.2], end: [0.3, -0.1], startLabel: 'Heavy, sad or angry', endLabel: 'Lighter and relieved', maxBpm: null },
}
export const GOAL_TAGS = ['Calm', 'Focus', 'Sleep', 'Uplift', 'Release', 'Hype']

// NFR-2: only the scopes the features need.
//   playlist-modify-private  -> FR-5 save playlist (saved as private)
//   user-top-read            -> pre-fill genres and artists (questionnaire step 6)
export const SPOTIFY_SCOPES = ['playlist-modify-private', 'user-top-read']
export const SPOTIFY_CLIENT_ID = import.meta.env?.VITE_SPOTIFY_CLIENT_ID || ''

export const CRISIS_RESOURCES = [
  { name: '988 Suicide & Crisis Lifeline (US)', detail: 'Call or text 988, or chat at 988lifeline.org' },
  { name: 'Crisis Text Line', detail: 'Text HOME to 741741' },
  { name: 'Emergency services', detail: 'Call 911 (US) or your local emergency number if you are in immediate danger' },
  { name: 'Outside the US', detail: 'Find a local helpline at findahelpline.com' },
]

// Live lyric scores (src/tmr/lyrics_api.py). Set VITE_LYRICS_API_URL for a hosted
// copy; locally it defaults to the service's port on this machine.
const LOCAL = typeof window !== 'undefined' && ['127.0.0.1', 'localhost'].includes(window.location.hostname)
export const LYRICS_API_URL = import.meta.env?.VITE_LYRICS_API_URL || (LOCAL ? 'http://127.0.0.1:8787' : '')
