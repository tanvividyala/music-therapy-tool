# Muiso
Muiso takes a user's mood, stress level and goal (such as winding down or focusing) from a short questionnaire and builds a Spotify playlist scored on calming lyrics, tempo (BPM) and genre. Following the iso principle from music therapy (hence our name, Mu**iso**!), the playlist starts where the user is and gradually moves toward their goal, with an explanation for each song. It is meant for students and anyone who uses music to manage stress, anxiety or sleep, and music therapists can use it as a starting point for session playlists.

Live app: https://tanvividyala.github.io/music-therapy-tool/

## Project structure

```
music-therapy-tool/
├── frontend/                  Web app (React + Vite), deployed to GitHub Pages
│   ├── index.html             Page shell, including the GetSongBPM credit link
│   ├── public/catalog.json    Song catalog exported by the notebook (no lyric text)
│   └── src/
│       ├── App.jsx            Screen flow: login → disclaimer → questionnaire → playlist → session → debrief
│       ├── screens/           One file per screen (questionnaire, playlist, guided session, pilot, crisis)
│       ├── components/        Mood grid, and the temporary Rules/Learned model toggle
│       ├── logic/             JavaScript ports of the Python logic: scoring, playlist ordering,
│       │                      distress check, and catalog loading
│       ├── spotify.js         Spotify login (PKCE) and saving playlists
│       ├── storage.js         Answers and mood ratings, kept per user on their device
│       └── config.js          Mirrors src/tmr/config.py (routes, distress rule, Spotify scopes)
├── notebooks/
│   └── 01_build_catalog.ipynb Data pipeline: MuSe → audio features (ReccoBeats) → lyrics (Genius)
│                              → lyric emotion scores → mood models → catalog.db and catalog.json
├── src/tmr/                   Python core (tmr = Therapeutic Music Recommender)
│   ├── config.py              Session lengths, mood routes, distress rule, per-goal BPM ranges
│   ├── questionnaire.py       Distress check for the crisis safeguard
│   ├── mood.py                Rule-based mood estimate (valence, arousal) for any song
│   ├── scoring.py             Calm score from arousal, tempo and lyrics
│   ├── planner.py             Orders songs from the listener's mood toward their goal
│   ├── catalog.py             catalog.db schema (songs table)
│   ├── pilot.py               pilot.db schema (sessions, playlist items)
│   └── spotify_client.py      Spotify client stubs (the working version is in frontend/)
├── tests/                     Unit tests (UT-1 to UT-3, mood rules, database schemas)
├── data/                      Datasets and API caches (gitignored; not stored in the repo)
├── models/                    Saved learned mood model (built by the notebook; not committed)
├── model_explanation.md       How songs are scored for mood, with the research behind it
├── claude.md                  Project spec: requirements, routes, data models and test cases
├── requirements.txt           Python dependencies
└── .env.example               Template for API keys (copy to .env, which is gitignored)
```

## Running it

**Tests**
```
pip install -r requirements.txt
pytest
cd frontend && npm install && npm test
```

**Web app (local)**
```
cd frontend
npm run dev
```

**Data pipeline**: copy `.env.example` to `.env`, add your keys, put the MuSe CSV in `data/`, then run `notebooks/01_build_catalog.ipynb`. See the notebook's first cell for details.

## Contributors

DSC 200 (Data Science Programming), Fall 2026.

| Name | Role in the M2 spec |
|---|---|
| Dyuthi Vijay | Data models, system architecture diagrams |
| Tanvi Vidyala | Introduction, requirements, design |
| Mena Song-Lew | Data models, system architecture diagrams |
| Noreen Ibrar | Code, test cases |

