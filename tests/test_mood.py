"""Rule-based mood estimate (FR-3): directions match the cited literature."""

import copy

from tmr.mood import estimate_mood

QUIET_ACOUSTIC_MINOR = {"energy": 0.15, "valence": 0.2, "acousticness": 0.9, "loudness": -22, "mode": 0}
LOUD_BRIGHT_MAJOR = {"energy": 0.9, "valence": 0.85, "acousticness": 0.05, "loudness": -4, "mode": 1}


def test_outputs_are_within_range():
    for song in (QUIET_ACOUSTIC_MINOR, LOUD_BRIGHT_MAJOR,
                 {"energy": 1, "valence": 1, "acousticness": 0, "loudness": 5, "mode": 1},
                 {"energy": 0, "valence": 0, "acousticness": 1, "loudness": -60, "mode": 0}):
        v, a = estimate_mood(song)
        assert -1 <= v <= 1 and -1 <= a <= 1


def test_loud_energetic_song_has_higher_arousal():
    assert estimate_mood(LOUD_BRIGHT_MAJOR)[1] > estimate_mood(QUIET_ACOUSTIC_MINOR)[1]


def test_major_mode_raises_valence_with_everything_else_equal():
    minor = dict(LOUD_BRIGHT_MAJOR, mode=0)
    assert estimate_mood(LOUD_BRIGHT_MAJOR)[0] > estimate_mood(minor)[0]


def test_sad_lyrics_lower_valence():
    sad = dict(LOUD_BRIGHT_MAJOR, lyric_valence=-0.8, lyric_arousal=0.0)
    assert estimate_mood(sad)[0] < estimate_mood(LOUD_BRIGHT_MAJOR)[0]


def test_instrumental_without_lyric_scores_works():
    v, a = estimate_mood(dict(QUIET_ACOUSTIC_MINOR, lyric_valence=None, lyric_arousal=None))
    assert isinstance(v, float) and isinstance(a, float)


def test_missing_audio_features_returns_none():
    assert estimate_mood({"energy": 0.5}) == (None, None)


def test_song_is_unchanged():
    song = copy.deepcopy(LOUD_BRIGHT_MAJOR)
    estimate_mood(song)
    assert song == LOUD_BRIGHT_MAJOR
