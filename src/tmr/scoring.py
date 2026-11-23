"""Song scoring. Covers part of FR-3 (score candidate songs on calmness)."""


def _clamp(x, low, high):
    return max(low, min(high, x))


def calm_score(song):
    """Return how calming a song is, from -1 (not calming) to +1 (very calming).

    song is a dict with:
        "bpm": tempo in beats per minute
        "est_arousal" or "muse_arousal": energy on a -1..+1 scale
        "lyric_valence": lyric mood on -1..+1, or None for instrumentals

    FIRST-VERSION FORMULA (simple on purpose, easy to explain):
        arousal term = -arousal           (lower energy is calmer)
        tempo term   = +1 at 50 BPM, falling to -1 at 150 BPM or faster
        lyric term   = lyric_valence      (more positive lyrics are calmer)
    With lyrics:    0.4*arousal + 0.3*tempo + 0.3*lyric
    Instrumental:   0.5*arousal + 0.5*tempo  (no lyric score available)

    Genre is not used yet (TODO). The weights are guesses to be tuned.
    This function only reads the song. It never changes it.
    """
    arousal = song.get("est_arousal")
    if arousal is None:
        arousal = song["muse_arousal"]

    arousal_term = -arousal
    tempo_term = 1 - 2 * _clamp((song["bpm"] - 50) / 100, 0.0, 1.0)

    lyric = song.get("lyric_valence")
    if lyric is None:
        score = 0.5 * arousal_term + 0.5 * tempo_term
    else:
        score = 0.4 * arousal_term + 0.3 * tempo_term + 0.3 * lyric

    return _clamp(score, -1.0, 1.0)
