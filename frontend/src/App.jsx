// Screen flow (NFR-4: login -> disclaimer -> questionnaire -> playlist -> session, 5 screens):
//   login (FR-1) -> disclaimer (NFR-3, first time only) -> questionnaire (FR-2)
//   -> crisis (FR-2) | playlist (FR-3, FR-5) -> session (FR-4) -> debrief (FR-6)
import { useCallback, useEffect, useState } from 'react'
import { generatePlaylist } from './logic/api.js'
import { explain, shuffled } from './logic/planner.js'
import { isDistress } from './logic/questionnaire.js'
import { estimateMood } from './logic/mood.js'
import { fetchLyricScores } from './logic/lyrics.js'
import * as spotify from './spotify.js'
import * as store from './storage.js'
import Questionnaire from './screens/Questionnaire.jsx'
import Playlist from './screens/Playlist.jsx'
import Session from './screens/Session.jsx'
import { Debrief, PilotResults } from './screens/Pilot.jsx'
import { Crisis, Disclaimer, Login } from './screens/Simple.jsx'
import ModelToggle from './components/ModelToggle.jsx'

const MODE_KEY = 'muiso.mode' // 'spotify' | 'demo'
const MODEL_KEY = 'muiso.moodModel' // TEMPORARY testing toggle: 'rules' | 'learned'

function readModel() {
  try {
    return localStorage.getItem(MODEL_KEY) === 'learned' ? 'learned' : 'rules'
  } catch {
    return 'rules'
  }
}

export default function App() {
  const [user, setUser] = useState(null) // { id, name, spotify: bool }
  const [screen, setScreen] = useState('loading')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [session, setSession] = useState(null)
  const [busy, setBusy] = useState(false)
  const [moodModel, setMoodModel] = useState(readModel)

  function chooseModel(m) {
    setMoodModel(m)
    try {
      localStorage.setItem(MODEL_KEY, m)
    } catch {
      // storage unavailable (private mode): the toggle still works for this visit
    }
  }

  const enter = useCallback((u) => {
    setUser(u)
    setScreen(store.hasAcknowledged(u.id) ? 'questionnaire' : 'disclaimer')
  }, [])

  // FR-1: on load, finish a login redirect or restore the saved login.
  useEffect(() => {
    ;(async () => {
      try {
        const fresh = await spotify.handleRedirect()
        if (fresh) localStorage.setItem(MODE_KEY, 'spotify')
        const mode = localStorage.getItem(MODE_KEY)
        if (mode === 'spotify' && spotify.hasToken()) {
          const me = await spotify.getMe()
          return enter({ id: me.id, name: me.display_name || me.id, spotify: true })
        }
        if (mode === 'demo') return enter({ id: 'demo', name: 'Demo user', spotify: false })
      } catch (e) {
        setError(e.message)
        spotify.logout()
        localStorage.removeItem(MODE_KEY)
      }
      setScreen('login')
    })()
  }, [enter])

  function logout() {
    spotify.logout()
    localStorage.removeItem(MODE_KEY)
    setUser(null)
    setResult(null)
    setScreen('login')
  }

  function deleteData() {
    if (!window.confirm('Delete all your Muiso answers and mood ratings from this device?')) return
    store.clearUserData(user.id)
    logout()
  }

  async function submitQuestionnaire(answers) {
    const base = {
      session_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      consent: answers.consent,
      pre_valence: answers.mood[0],
      pre_arousal: answers.mood[1],
      pre_stress: answers.stress,
      goal: answers.goal,
      post_valence: null,
      post_arousal: null,
      post_stress: null,
    }

    // FR-2 / FT-2: crisis screen instead of a playlist; no playlist items stored.
    if (isDistress(answers)) {
      store.saveSession(user.id, { ...base, crisis_shown: true, condition: null, items: [] })
      setScreen('crisis')
      return
    }

    setBusy(true)
    try {
      const condition = answers.consent ? store.nextCondition(user.id) : 'ordered'
      // FR-3: the user's own listening leads when they are signed in to Spotify,
      // searched in rounds until it covers the mood path.
      const taste = user.spotify ? await spotify.tasteExplorer(estimateMood, answers.genres).start().catch(() => null) : null
      // Variety: random picks among near-equal songs, and songs from the last
      // three sessions are held back unless nothing else fits.
      const recent = store.getSessions(user.id).slice(-3).flatMap((s) => (s.items || []).map((it) => it.song_id))
      const res = await generatePlaylist(answers, {
        rand: Math.random,
        recent,
        model: moodModel,
        personal: taste ? [...taste.songs] : [],
        expand: taste ? () => taste.more().catch(() => null) : null,
        taste: taste?.taste,
        scoreLyrics: fetchLyricScores,
      })
      if (condition === 'shuffled') {
        res.playlist = shuffled(res.playlist).map((t) => ({ ...t, explanation: explain(t, t.stage, res.start, res.goal) }))
      }
      const s = {
        ...base,
        crisis_shown: false,
        condition,
        mood_model: res.model, // TEMPORARY: which estimate ordered this playlist
        items: res.playlist.map((t, position) => ({ position, song_id: t.song_id, explanation: t.explanation })),
      }
      store.saveSession(user.id, s)
      setSession(s)
      setResult({ ...res, goalName: answers.goal })
      setScreen('playlist')
      if (user.spotify) resolveTracks(res.playlist)
    } finally {
      setBusy(false)
    }
  }

  // Look up Spotify IDs and album covers in the background so playback,
  // saving and the track list can use them.
  async function resolveTracks(playlist) {
    const info = await Promise.all(playlist.map((t) => spotify.trackInfo(t).catch(() => ({ id: null, image: null }))))
    setResult((r) => r && {
      ...r,
      playlist: r.playlist.map((t, i) => ({ ...t, spotify_id: info[i].id || t.spotify_id || null, image: info[i].image || t.image || null })),
    })
  }

  async function save() {
    const tracks = result.playlist
    const ids = await Promise.all(tracks.map((t) => t.spotify_id || spotify.resolveTrack(t).catch(() => null)))
    const found = ids.filter(Boolean)
    if (found.length === 0) throw new Error('None of the tracks were found on Spotify')
    const date = new Date().toLocaleDateString()
    const pl = await spotify.savePlaylist(
      `Muiso: ${result.goalName} (${date})`,
      `Made by Muiso. Moves from how you felt toward ${result.goalName.toLowerCase()}.`,
      found,
    )
    return {
      url: pl.external_urls?.spotify,
      missing: tracks.filter((_, i) => !ids[i]).map((t) => t.title),
    }
  }

  function submitDebrief(d) {
    store.updateSession(user.id, session.session_id, {
      post_valence: d.mood[0],
      post_arousal: d.mood[1],
      post_stress: d.stress,
      debrief_skipped: false,
    })
    // FR-6: distress-level debrief answers also trigger crisis resources.
    setScreen(isDistress(d) ? 'crisis' : 'pilot')
  }

  function skipDebrief() {
    store.updateSession(user.id, session.session_id, { debrief_skipped: true })
    setScreen('pilot')
  }

  const blinded = session?.consent // pilot testers don't see stage cues that reveal the condition

  return (
    <main className={`app screen-${screen}`}>
      {/* The aura: two still blooms coloured by mood (aura.js, useAura). */}
      <div id="aura" className="aura" aria-hidden="true" data-state="off" />
      <ModelToggle value={moodModel} onChange={chooseModel} />
      {user && (
        <header className="topbar">
          <span className="wordmark">Muiso</span>
          <nav className="topbar-nav" aria-label="Account">
            <span className="topbar-user">Signed in as {user.name}{!user.spotify && ' (demo)'}</span>
            <button type="button" className="link" onClick={() => setScreen('questionnaire')}>New session</button>
            <button type="button" className="link" onClick={() => setScreen('pilot')}>Pilot results</button>
            <button type="button" className="link" onClick={deleteData}>Delete my data</button>
            <button type="button" className="link" onClick={logout}>Log out</button>
          </nav>
        </header>
      )}
      {screen === 'loading' && <p className="loading" role="status">Loading…</p>}
      {screen === 'login' && (
        <Login
          error={error}
          onSpotify={() => spotify.login()}
          onDemo={() => {
            localStorage.setItem(MODE_KEY, 'demo')
            enter({ id: 'demo', name: 'Demo user', spotify: false })
          }}
        />
      )}
      {screen === 'disclaimer' && (
        <Disclaimer
          onAccept={() => {
            store.acknowledge(user.id)
            setScreen('questionnaire')
          }}
        />
      )}
      {screen === 'questionnaire' && (
        <Questionnaire onSubmit={submitQuestionnaire} busy={busy} loadTaste={user.spotify ? spotify.topArtistsAndGenres : null} />
      )}
      {screen === 'crisis' && <Crisis onBack={() => setScreen('questionnaire')} />}
      {screen === 'playlist' && result && (
        <Playlist
          result={result}
          goalName={result.goalName}
          blinded={blinded}
          loggedIn={user.spotify}
          onSave={save}
          onStart={() => setScreen('session')}
          onRestart={() => setScreen('questionnaire')}
        />
      )}
      {screen === 'session' && result && (
        <Session result={result} blinded={blinded} onEnd={() => setScreen('debrief')} />
      )}
      {screen === 'debrief' && <Debrief onSubmit={submitDebrief} onSkip={skipDebrief} />}
      {screen === 'pilot' && <PilotResults sessions={store.getSessions(user.id)} onBack={() => setScreen('questionnaire')} />}
    </main>
  )
}
