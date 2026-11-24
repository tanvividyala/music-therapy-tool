# Muiso: Therapeutic Music Recommender

Project spec for DSC 200 (Data Science Programming, Fall 2026), M2.

This file is the source of truth for implementation. Requirement IDs (FR-x, NFR-x) and test IDs (UT-x, FT-x) are referenced throughout, so keep them in code comments, commit messages and test names.

## 1. Background and Goal

Streaming recommendations are shaped by sponsorships and other commercial factors, ignore the listener's mental state, and rarely check whether a song's lyrics or tempo are calming. Muiso takes a user's mood, stress level and goal (such as winding down or focusing) from a short questionnaire and builds a Spotify playlist scored on calming lyrics, tempo (BPM) and genre.

Muiso follows the iso principle from music therapy: the playlist starts where the user is and gradually moves toward their goal, with an explanation for each song. It is meant for students and anyone who uses music to manage stress, anxiety or sleep. Music therapists can use it as a starting point for session playlists.

### In scope

- A mood questionnaire, with crisis resources shown instead of a playlist when answers suggest severe distress.
- Scoring songs on calming lyrics, BPM and genre, and ordering them from the user's current mood toward their goal, with an explanation for each song.
- Saving the playlist to the user's Spotify account, plus a small pilot comparing before-and-after mood ratings for ordered and shuffled playlists.

### Out of scope

- Diagnosing or treating mental health conditions. The tool is for everyday self-care.
- Playing or analyzing song audio, since licensing limits access. Playback happens in Spotify.
- Serving as a clinical trial. The mood comparison is a small pilot and is not sufficient as clinical evidence.

## 2. The Questionnaire

Should take no more than 5 minutes to fill out.

1. **Current mood.** "How are you feeling right now?" Pick a spot on a mood grid (valence and arousal) or choose stones.
2. **Stress and wellbeing.** Stress level from 1 to 10, plus 2 or 3 short wellbeing items. These feed the crisis check.
3. **Goal.** "Where do you want to end up?" Choose from goal tags: Calm, Focus, Sleep, Uplift, Release (cathartic), Hype.
4. **Texture tags (optional).** Lyrics or instrumental, soft or loud, familiar or new.
5. **Session length.** 30, 45 or 60 minutes.
6. **Genres and artists.** Pre-filled from Spotify.

After step 3, Muiso recommends a goal based on the answers, for example "Feeling heavy and restless? Try Release." The user can always override it.

## 3. Routes

Each goal defines a typical start mood, an end mood, and a path between them. Moods are (V, A) points where V is valence and A is arousal, both in [-1, 1].

| Goal | Typical start mood | End mood | Path |
|---|---|---|---|
| Calm | Anxious or stressed (V -0.4, A +0.6) | Relaxed and content (V +0.4, A -0.4) | Bring the energy down while mood rises a little |
| Focus | Restless or scattered (V -0.1, A +0.5) | Steady and engaged (V +0.2, A 0.0) | Settle to a mid-energy, low-distraction plateau, often instrumental |
| Sleep | Wired or tired (V -0.2, A +0.3) | Drowsy and peaceful (V +0.2, A -0.8) | Keep lowering tempo and energy until near-ambient |
| Uplift | Low or down (V -0.5, A -0.4) | Bright and upbeat (V +0.6, A +0.5) | Raise mood and energy together, steadily |
| Release | Heavy, sad or angry (V -0.6, A -0.2) | Lighter and relieved (V +0.3, A -0.1) | Stay sad while energy climbs to a loud peak, then settle with mood rising |

Note: "Hype" appears in the goal tags but has no route defined yet.

## 4. Requirements

Items marked `*` are the requirements to be graded.

### Functional requirements

**FR-1 Spotify login (High).** The system will let the user sign in with Spotify via OAuth and keep them signed in across sessions until they log out.
- Verify: after login and a browser restart, the user lands on the home page without re-authenticating.

**FR-2 Mood questionnaire with crisis safeguard (High)\*.** The system will present a questionnaire that records current mood, stress level (1-10), goal state and session length. If answers meet the distress threshold, it shall show crisis resources (e.g., 988) before generating a playlist.
- Verify: a test response above the threshold returns the crisis screen.

**FR-3 Playlist generation (High)\*.** The system will score candidate songs on lyric calmness, BPM and genre match, and order them so the first song matches the user's current mood and the last matches their goal (iso principle). Each song shall include a one-sentence explanation.
- Verify: for a test profile, mood scores change monotonically from start to goal, and every track has a non-empty explanation.

**FR-4 Guided session (Medium).** The system will play the playlist in the browser and show on-screen commentary and visuals for each song naming its session stage (match, shift, settle).
- Verify: each track change updates the stage label and commentary.

**FR-5 Save to Spotify (Medium)\*.** The system will save the generated playlist to the user's Spotify account on request.
- Verify: the playlist appears in the user's library with the same tracks in the same order.

**FR-6 Mood pilot (Low).** After each session, the system will offer an optional debrief using the intake's mood and stress items. Pilot testers will complete one ordered and one shuffled session on different days, in random, blinded order. The system will compare each tester's mood change across the two sessions and log skipped debriefs. Distress-level answers will trigger crisis resources. This is a small feasibility pilot, not clinical evidence.
- Verify: a test user's two sessions each show a mood change and the difference between them. Skipped debriefs are counted, and an above-threshold answer shows the crisis screen.

### Non-functional requirements

**NFR-1 Performance (High)\*.** The system will generate a playlist within 60 seconds of questionnaire submission for 95% of requests.

**NFR-2 Privacy (High)\*.** Questionnaire answers and mood ratings will be stored only linked to the user's account, readable only by that user, and never shared with third parties. Only the Spotify scopes the features need shall be requested.

**NFR-3 Safety disclaimers (High)\*.** Before the first questionnaire, the system will show a disclaimer that it is not a clinical or diagnostic tool, along with where to get professional help. The user must acknowledge it before continuing.

**NFR-4 Usability (Medium).** A first-time user will be able to go from login to a playing session in 5 or fewer screens and under 3 minutes, without instructions.

**NFR-5 Session length (Medium).** Generated playlists will match the user's chosen length (30-60 min) within +/-3 minutes.

## 5. Data Models

### Description

- **MuSe** is a dataset for checking mood scores. It has 3 dimensions: valence (pleasantness), arousal (intensity of emotion) and dominance (how much control or power the emotion conveys). Spotify IDs are the join key.
- **Genius API** supplies lyrics.
- **GetSongBPM** combined with **ReccoBeats** supplies BPM for a larger reference set.
- **Pilot data** comes from user questionnaire answers and records each playlist session and the pre and post mood ratings. It includes user session configurations.

Sidenote: the model is still being trained on the dataset available so far. The plan is to use API calls instead of storing everything.

### Storage

Storage is for training and should stay small in cost.

- Raw inputs (MuSe CSV, API responses, fetched lyrics) are cached in `data/raw/`. This directory is gitignored.
- Store only derived scores, flags and dimensions. **Never store lyric text.**
- Cleaned joins are written as Parquet in `data/interim/`, then loaded into `catalog.db`.

SQL databases:

- `catalog.db`: `songs`
- `pilot.db`: `sessions`, `playlist_items`

In the schema below, "raw" columns come straight from sources. "Derived" columns are computed: `flags`, `est_valence`, `est_arousal`, `calm_score`.

### Schema

**songs** (`catalog.db`)

| Column | Type | Kind | Description |
|---|---|---|---|
| song_id | INT | raw | Internal ID |
| spotify_id | TEXT | raw | Join key across MuSe and Spotify |
| title, genre, artist | TEXT | raw | Song metadata |
| muse_dominance, muse_valence, muse_arousal | REAL [-1,1] | raw | Normalized MuSe values |
| bpm, bpm_source | REAL, TEXT | raw | Tempo and which API supplied it |
| lyric_valence, lyric_arousal | REAL [-1,1], nullable | derived | From emotion classifier. NULL for instrumentals |
| flags | TEXT | derived | Comma-separated themes, e.g. `self_harm` or `substance`. Empty if none |
| est_valence, est_arousal, calm_score | REAL [-1,1] | derived | Combined estimates, used for ranking |

**sessions** (`pilot.db`)

| Column | Type | Description |
|---|---|---|
| session_id | TEXT (UUID), PK | Random ID with no link to any identity |
| consent, crisis_shown | BOOLEAN | Consent given. Whether the safety screen was triggered |
| pre_valence, pre_arousal, pre_stress, goal | INTEGER / TEXT | Questionnaire answers (goal is TEXT) |
| condition | TEXT | `ordered` or `shuffled` |
| post_valence, post_arousal, post_stress | INT, nullable | Ratings after listening |

**playlist_items** (`pilot.db`)

| Column | Type | Description |
|---|---|---|
| session_id | TEXT, FK to sessions | Part of composite PK |
| position | INT | Part of composite PK. Each (session_id, position) row is unique |
| song_id | INT | Song shown at this position |
| explanation | TEXT | Reason the song was chosen |

### Assumptions and constraints

- Not every song in MuSe has lyrics on Genius. The usable dataset will be much smaller than 90k because the target is English-language songs and because of the Genius coverage gap. The actual count will be reported.
- MuSe labels come from Last.fm tags, so they skew toward popular Western English-language music. They describe how listeners tag a song, not how the song actually affects them.
- Instrumental songs have no lyric scores, so their estimates use BPM and MuSe arousal.
- BPM must be used as a single input so the score does not double count it. It is also a hard filter.

## 6. System Architecture

Three diagrams are planned. The images live in the original spec PDF and are not reproduced here. Descriptions follow.

1. **User Flow Diagram.** Shows how the listener, Spotify and the recommender interact.
2. **Activity Diagram.** Shows how user interaction determines backend flow: the chronological order of user decisions, and how branches join on yes or no choices. It maps to most of the requirements, so each step can be checked against the end goal.
3. **Component Diagram.** Shows which parts of the recommender talk to Spotify and which touch sensitive health-related data, plus how files and components interact.

## 7. Test Cases

### Unit tests

**UT-1 Distress detection** (traces to FR-2)
- Preconditions: the distress rule is set in config. Placeholder rule for now: stress of 9 or higher, or any wellbeing item flagged. This will be replaced once the real rule is decided.
- Steps: call `is_distress(answer)`, which returns True when answers suggest extreme distress. Inputs are the stress level (1-10) and a few short wellbeing answers. If True, the app shows crisis resources instead of the playlist.
- Expected: the function returns three answers for three test inputs: (a) True, (b) False, (c) True.
- Postconditions: the function only returns a boolean. It does not save data or trigger playlist creation.

**UT-2 Calm score** (traces to FR-3)
- Preconditions: three song records exist: a slow song (60 BPM, arousal -0.6), a fast song (160 BPM, arousal +0.7), and an instrumental (`lyric_valence = NULL`).
- Steps: call `calm_score(song)` on each.
- Expected: all scores fall within [-1, 1]. The slow song scores higher than the fast song. The instrumental returns a score from BPM and MuSe arousal with no error.
- Postconditions: song records are unchanged.

**UT-3 Iso ordering** (traces to FR-3)
- Preconditions: route is Calm. Start = (valence -0.4, arousal +0.6). Goal = (valence +0.4, arousal -0.4). Both points are fixed values passed in directly. 20 candidate songs, each with valence and arousal in [-1, 1] and a duration, totaling more than 30 minutes.
- Steps: call `order_playlist(candidates, start, goal, length=30)`, where `length` is the session length in minutes.
- Expected: first track is closest to the start point. Last track is closest to the goal point. Distance to the goal never increases between tracks. Total duration is within 27 to 33 minutes (+/-3 min, per NFR-5). Every track has a non-empty explanation.
- Postconditions: ordered list is returned. The candidate pool is unmodified.

### Functional tests

**FT-1 Questionnaire to playlist** (traces to FR-1, FR-3, NFR-1, NFR-3, NFR-5)
- Preconditions: test Spotify account exists. `catalog.db` is populated. User is logged out. Pilot consent is given.
- Steps:
  1. Log in with Spotify.
  2. Acknowledge the disclaimer.
  3. Submit: mood grid point (valence -0.4, arousal +0.6), stress = 6, goal = Calm, length = 30 min.
- Expected: playlist appears within 60 seconds. It runs 27 to 33 minutes. It moves from the starting mood (-0.4, +0.6) toward the Calm end mood (+0.4, -0.4). Every track has an explanation.
- Postconditions: session and playlist items are stored in `pilot.db`, with positions in order.

**FT-2 Crisis safeguard** (traces to FR-2, NFR-3)
- Preconditions: user is logged in and has acknowledged the disclaimer.
- Steps: submit the questionnaire with stress = 10 and wellbeing answers that flag distress.
- Expected: crisis resources screen shows, including 988. No playlist is shown.
- Postconditions: no Spotify playlist is created. No playlist items are stored. The session row may record `crisis_shown = TRUE`. User can return to the questionnaire.

**FT-3 Save to Spotify** (traces to FR-5, FR-1, NFR-2)
- Preconditions: a generated playlist of N tracks is displayed. User's Spotify session is active.
- Steps:
  1. Close and reopen the browser.
  2. Confirm the user is still logged in.
  3. Click "Save to Spotify".
- Expected: a new playlist appears in the user's Spotify library with the same N tracks in the same order.
- Postconditions: app holds only the Spotify permissions it needs. The playlist opens in Spotify.

## 8. Notes for Implementation

- Priority order follows the requirement priorities: High items (FR-1, FR-2, FR-3, NFR-1, NFR-2, NFR-3) first, then Medium (FR-4, FR-5, NFR-4, NFR-5), then Low (FR-6).
- The graded requirements are FR-2, FR-3, FR-5, NFR-1, NFR-2 and NFR-3. Code and tests should cover these first.
- The code does not need to be complete or fully working for the check-in. The grader looks for reasonable progress. Passing UT-1, UT-2 and UT-3 is the most achievable early target.
- Keep the distress rule in config so the placeholder can be swapped without code changes.
- Never write lyric text to disk outside the gitignored `data/raw/` cache, and never into the databases.
- Request only the Spotify OAuth scopes the features need (NFR-2).

### Open questions in the spec

- Final distress rule for `is_distress` (currently a placeholder).
- Route definition for the Hype goal.
- Exact blend of lyric, MuSe and BPM signals in `est_valence`, `est_arousal` and `calm_score`.
- How genre match is scored, since the schema stores genre as a single TEXT field.
- Column types for `pre_valence` and `pre_arousal` in `sessions`. Mood grid values are in [-1, 1], so INTEGER likely needs to be REAL.
