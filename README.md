# Muiso
Muiso takes a user's mood, stress level and goal (such as winding down or focusing) from a short questionnaire and builds a Spotify playlist scored on calming lyrics, tempo (BPM) and genre. Following the iso principle from music therapy (hence our name, Mu**iso**!), the playlist starts where the user is and gradually moves toward their goal, with an explanation for each song. It is meant for students and anyone who uses music to manage stress, anxiety or sleep, and music therapists can use it as a starting point for session playlists.

## Project structure

- `src/tmr/`: main code (tmr = Therapeutic Music Recommender)
  - `config.py`: settings, such as session lengths and mood routes for each goal
  - `questionnaire.py`: mood questionnaire logic and the distress check
  - `scoring.py`: scores how calming a song is (tempo, energy, lyrics)
  - `planner.py`: orders songs so the playlist moves from the listener's mood toward their goal
  - `catalog.py`: song database setup (data loading not built yet)
  - `pilot.py`: session and playlist database setup (saving not built yet)
  - `spotify_client.py`: Spotify login and playlist saving (stubs)
- `tests/`: unit tests for the code in `src/tmr/`
- `data/`: datasets (raw data is not stored in the repo)

## Running the tests
   pip install -r requirements.txt
    pytest
