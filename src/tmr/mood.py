"""Rule-based mood estimate (est_valence, est_arousal) for any song. Covers part of FR-3.

Deterministic on purpose: every song's mood can be traced back to a few inputs
that exist for any track with a Spotify ID (ReccoBeats audio features) plus
optional lyric scores. It doesn't need MuSe, so it also works on songs from a
user's listening history.

The weights are design choices. The *directions* come from the literature:

Arousal (how energetic):
  - Spotify-style "energy" tracks listener arousal ratings strongly
    (Validating Spotify's Valence, Energy and Danceability features, PsyArXiv
    preprint, doi 10.31234/osf.io/8gfzw; also arXiv 2302.13321).
  - Louder music is heard as more intense (Gabrielsson & Lindstrom 2010,
    Handbook of Music and Emotion, pp. 367-400).
  - Acoustic, quieter music is typical of sleep/relaxation playlists
    (Scarratt et al. 2023, PLOS ONE 18:e0278813).
  - Tempo also drives arousal (Husain, Thompson & Schellenberg 2002, Music
    Perception 20(2); Bernardi, Porta & Sleight 2006, Heart 92(4)), but BPM is
    deliberately NOT used here: the spec says BPM must be a single input, and it
    already enters through calm_score() and the per-goal BPM filter. Note that
    "energy" partly reflects tempo already.

Valence (how pleasant):
  - Spotify-style "valence" tracks listener valence ratings moderately
    (same PsyArXiv preprint).
  - Major mode is heard as happier and minor as sadder, mostly independent of
    arousal (Husain et al. 2002; Gagnon & Peretz 2003, Cognition and Emotion 17).
  - Lyrics carry valence that audio features miss, so lyric scores get a share
    when a song has them.
"""


def _clamp(x, low=-1.0, high=1.0):
    return max(low, min(high, x))


def _unit(x):
    """Map a 0..1 audio feature to -1..+1."""
    return 2.0 * float(x) - 1.0


def _loudness_unit(db):
    """Map loudness in dB to -1..+1. -21.5 dB -> -1 and -3.5 dB -> +1, which is
    about the 5th-95th percentile range of ReccoBeats loudness in our sample."""
    return _clamp((float(db) + 12.5) / 9.0)


# Weights within each group sum to 1, so outputs stay in [-1, 1].
AROUSAL_WEIGHTS = {"energy": 0.6, "loudness": 0.25, "acoustic": 0.15}
VALENCE_WEIGHTS = {"valence": 0.75, "mode": 0.25}
LYRIC_SHARE = {"valence": 0.3, "arousal": 0.15}  # how much lyrics count, when present


def estimate_mood(song):
    """Return (est_valence, est_arousal), each in [-1, 1].

    song is a dict with ReccoBeats audio features:
        "energy", "valence", "acousticness" (0..1), "loudness" (dB),
        "mode" (1 = major, 0 = minor)
    and optional lyric scores "lyric_valence", "lyric_arousal" (-1..1 or None).
    Returns (None, None) if the audio features are missing.
    This function only reads the song. It never changes it.
    """
    needed = ("energy", "valence", "acousticness", "loudness", "mode")
    if any(song.get(k) is None for k in needed):
        return None, None

    w = AROUSAL_WEIGHTS
    arousal = (w["energy"] * _unit(song["energy"])
               + w["loudness"] * _loudness_unit(song["loudness"])
               - w["acoustic"] * _unit(song["acousticness"]))

    w = VALENCE_WEIGHTS
    valence = (w["valence"] * _unit(song["valence"])
               + w["mode"] * (1.0 if int(song["mode"]) == 1 else -1.0))

    lv, la = song.get("lyric_valence"), song.get("lyric_arousal")
    if lv is not None and la is not None:
        valence = (1 - LYRIC_SHARE["valence"]) * valence + LYRIC_SHARE["valence"] * lv
        arousal = (1 - LYRIC_SHARE["arousal"]) * arousal + LYRIC_SHARE["arousal"] * la

    return _clamp(valence), _clamp(arousal)
