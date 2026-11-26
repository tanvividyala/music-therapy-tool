"""Lyric scores for any song, live (FR-3). Same method as notebooks/01_build_catalog.ipynb.

Turns a song's lyrics into lyric_valence / lyric_arousal (via an emotion
classifier) and theme flags. Lyric text only ever lives in local variables:
nothing here writes it to disk, logs it or returns it (spec section 5,
"Never store lyric text").

Network and model access are passed in (genius, classify) so the logic can be
tested without either.
"""

import re
from difflib import SequenceMatcher

MATCH_THRESHOLD = 0.80  # min title AND artist similarity to accept a Genius hit
MIN_LYRIC_WORDS = 20    # fewer words after cleaning -> treat as instrumental
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"

EMOTION_VA = {  # (valence, arousal) for each classifier label
    "joy": (0.8, 0.5),
    "surprise": (0.3, 0.7),
    "neutral": (0.0, 0.0),
    "sadness": (-0.7, -0.4),
    "fear": (-0.6, 0.6),
    "anger": (-0.6, 0.8),
    "disgust": (-0.7, 0.3),
}
EMOTIONS = list(EMOTION_VA)

FLAG_PATTERNS = {
    "self_harm": [r"\bkill(ing)? myself\b", r"\bsuicid\w*", r"\bcut(ting)? myself\b",
                  r"\bwant(ed)? to die\b", r"\bend it all\b", r"\bslit (my|your) wrists?\b"],
    "substance": [r"\bcocaine\b", r"\bheroin\b", r"\boverdos\w*", r"\bxanax\b",
                  r"\bmolly\b", r"\bpercocets?\b", r"\bget(ting)? high\b", r"\bdrunk\b"],
}


def norm(s):
    s = str(s).lower()
    s = re.sub(r"\(.*?\)|\[.*?\]", " ", s)          # (feat. X), [Remastered]
    s = re.sub(r"\b(feat|ft|featuring)\b.*", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return " ".join(s.split())


def similarity(a, b):
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def clean_lyrics(text):
    """Strip Genius page furniture (header, Embed, ads, [Chorus] tags)."""
    lines = text.splitlines()
    if lines and ("Contributor" in lines[0] or lines[0].rstrip().endswith("Lyrics")):
        lines = lines[1:]
    text = "\n".join(lines)
    text = re.sub(r"\d*Embed\s*$", "", text.strip())
    text = re.sub(r"You might also like", " ", text)
    text = re.sub(r"See .{0,60} LiveGet tickets as low as \$\d+", " ", text)
    text = re.sub(r"\[.*?\]", " ", text)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


def chunks(text, n_words=200):
    words = text.split()
    return [" ".join(words[i:i + n_words]) for i in range(0, len(words), n_words)] or [""]


def lyric_va(probs):
    """probs: {emotion: probability}. Returns (valence, arousal) in [-1, 1]."""
    v = sum(probs.get(e, 0.0) * EMOTION_VA[e][0] for e in EMOTIONS)
    a = sum(probs.get(e, 0.0) * EMOTION_VA[e][1] for e in EMOTIONS)
    return max(-1.0, min(1.0, v)), max(-1.0, min(1.0, a))


def theme_flags(text):
    t = text.lower()
    return ",".join(name for name, pats in FLAG_PATTERNS.items() if any(re.search(p, t) for p in pats))


def best_hit(genius, title, artist):
    """The Genius search hit whose title AND artist best match, or None."""
    hits = genius.search_songs(f"{title} {artist}").get("hits", [])
    best = None
    for h in hits[:10]:
        res = h["result"]
        ts = similarity(title, res.get("title", ""))
        ars = similarity(artist, (res.get("primary_artist") or {}).get("name", ""))
        if best is None or min(ts, ars) > best[0]:
            best = (min(ts, ars), res)
    return best


def score_song(genius, classify, title, artist, is_english=lambda text: True):
    """Score one song. Returns a dict with NO lyric text:
        status: not_found | rejected_match | instrumental | non_english | scored
        lyric_valence, lyric_arousal (only when scored), flags (str).
    classify(list_of_chunks) -> list of {emotion: probability}, one per chunk.
    """
    best = best_hit(genius, title, artist)
    if best is None:
        return {"status": "not_found"}
    score, res = best
    if score < MATCH_THRESHOLD:
        return {"status": "rejected_match"}
    if res.get("instrumental"):
        return {"status": "instrumental"}

    raw = genius.lyrics(song_url=res["url"], remove_section_headers=True)
    text = clean_lyrics(raw) if raw else ""
    if len(text.split()) < MIN_LYRIC_WORDS:
        return {"status": "instrumental"}
    if not is_english(text):
        return {"status": "non_english"}

    per_chunk = classify(chunks(text))
    probs = {e: sum(p.get(e, 0.0) for p in per_chunk) / len(per_chunk) for e in EMOTIONS}
    v, a = lyric_va(probs)
    return {"status": "scored", "lyric_valence": round(v, 3), "lyric_arousal": round(a, 3), "flags": theme_flags(text)}
