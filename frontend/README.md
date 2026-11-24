# Muiso frontend

Plain React (Vite) app, deployed to https://tanvividyala.github.io/music-therapy-tool/

## Run locally

    cd frontend
    npm install
    npm run dev        # http://127.0.0.1:5173/music-therapy-tool/
    npm test           # UT-1..UT-3 mirrors + UI smoke tests (FT-1, FT-2 flow)

## Deploy

    npm run deploy     # tests, builds, pushes dist/ to the gh-pages branch

Then in GitHub: Settings → Pages → Source: "Deploy from a branch", branch `gh-pages`, folder `/`.

## Spotify login (FR-1, FR-5)

Uses the PKCE flow, so only the public Client ID is needed (no secret in the browser).

1. In the Spotify developer dashboard, add both redirect URIs:
   - `http://127.0.0.1:5173/music-therapy-tool/`
   - `https://tanvividyala.github.io/music-therapy-tool/`
2. Copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID`.
3. Rebuild / redeploy. Without a Client ID the site still works in demo mode.

Scopes requested (NFR-2): `playlist-modify-private`, `user-top-read`.
Spotify apps in development mode only allow users you add under "User Management".

## Where things live

- `src/config.js`: distress rule, routes, lengths, scopes (mirrors `src/tmr/config.py`)
- `src/logic/`: ports of `questionnaire.py`, `scoring.py`, `planner.py`; `api.js` is the
  single entry point the UI calls, so it can be swapped for a backend `fetch()` later
- `src/logic/mockCatalog.js`: PLACEHOLDER catalog (real songs, hand-estimated moods) until `catalog.db` is ready
- `src/storage.js`: per-user answers and pilot sessions in localStorage (shape follows `pilot.db`)
- `src/screens/`: one file per screen
