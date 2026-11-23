"""UT-2: Calm score (FR-3)."""

import copy

from tmr.scoring import calm_score

SLOW = {"bpm": 60, "muse_arousal": -0.6, "lyric_valence": 0.3}
FAST = {"bpm": 160, "muse_arousal": 0.7, "lyric_valence": 0.1}
INSTRUMENTAL = {"bpm": 70, "muse_arousal": -0.4, "lyric_valence": None}


def test_ut2_scores_are_within_range():
    for song in (SLOW, FAST, INSTRUMENTAL):
        assert -1.0 <= calm_score(song) <= 1.0


def test_ut2_slow_song_scores_higher_than_fast_song():
    assert calm_score(SLOW) > calm_score(FAST)


def test_ut2_instrumental_scores_without_error():
    # lyric_valence is None; the score must still come from BPM and arousal.
    score = calm_score(INSTRUMENTAL)
    assert isinstance(score, float)


def test_ut2_song_records_are_unchanged():
    songs = [copy.deepcopy(s) for s in (SLOW, FAST, INSTRUMENTAL)]
    originals = copy.deepcopy(songs)
    for song in songs:
        calm_score(song)
    assert songs == originals
