"""catalog.db: the songs table (see Data Models in the spec).

Raw columns come from MuSe, the BPM sources and the lyric scorer. Derived
columns (flags, est_valence, est_arousal, calm_score) are computed by us.
Never store lyric text, only derived scores.
"""

import sqlite3

SONGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    song_id        INTEGER PRIMARY KEY,
    spotify_id     TEXT,
    title          TEXT,
    genre          TEXT,
    artist         TEXT,
    muse_dominance REAL,
    muse_valence   REAL,
    muse_arousal   REAL,
    bpm            REAL,
    bpm_source     TEXT,
    lyric_valence  REAL,  -- NULL for instrumentals
    lyric_arousal  REAL,  -- NULL for instrumentals
    flags          TEXT,  -- comma-separated themes, empty if none
    est_valence    REAL,
    est_arousal    REAL,
    calm_score     REAL
);
"""


def create_catalog(path="catalog.db"):
    """Create catalog.db with the songs table and return the connection."""
    conn = sqlite3.connect(path)
    conn.execute(SONGS_SCHEMA)
    conn.commit()
    return conn


def load_songs(conn):
    """TODO: join MuSe, BPM and lyric scores on spotify_id, then insert rows."""
    raise NotImplementedError("Data pipeline not built yet")
