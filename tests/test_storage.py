"""Extra check: the database tables match the Data Models section."""

from tmr.catalog import create_catalog
from tmr.pilot import create_pilot


def columns(conn, table):
    return [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]


def test_catalog_songs_table_columns():
    conn = create_catalog(":memory:")
    cols = columns(conn, "songs")
    for name in ("song_id", "spotify_id", "muse_valence", "bpm", "lyric_valence",
                 "flags", "est_valence", "est_arousal", "calm_score"):
        assert name in cols


def test_pilot_tables_exist_with_real_valued_moods():
    conn = create_pilot(":memory:")
    session_cols = {row[1]: row[2] for row in conn.execute("PRAGMA table_info(sessions)")}
    assert session_cols["pre_valence"] == "REAL"
    assert session_cols["post_valence"] == "REAL"
    assert "position" in columns(conn, "playlist_items")
