"""pilot.db: sessions and playlist items (see Data Models in the spec).

Questionnaire answers and mood ratings are sensitive. Store them only with
consent, and never link a session_id to an identity.
"""

import sqlite3

SESSIONS_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id    TEXT PRIMARY KEY,  -- random UUID, no link to any identity
    consent       BOOLEAN,
    crisis_shown  BOOLEAN,
    pre_valence   REAL,
    pre_arousal   REAL,
    pre_stress    INTEGER,
    goal          TEXT,
    condition     TEXT,              -- 'ordered' or 'shuffled'
    post_valence  REAL,              -- NULL until the debrief is answered
    post_arousal  REAL,
    post_stress   INTEGER
);
"""

PLAYLIST_ITEMS_SCHEMA = """
CREATE TABLE IF NOT EXISTS playlist_items (
    session_id   TEXT,
    position     INTEGER,
    song_id      INTEGER,
    explanation  TEXT,
    PRIMARY KEY (session_id, position),
    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
);
"""


def create_pilot(path="pilot.db"):
    """Create pilot.db with both tables and return the connection."""
    conn = sqlite3.connect(path)
    conn.execute(SESSIONS_SCHEMA)
    conn.execute(PLAYLIST_ITEMS_SCHEMA)
    conn.commit()
    return conn


def save_session(conn, session):
    """TODO: insert a session and its playlist items (FR-6)."""
    raise NotImplementedError("Not built yet")
