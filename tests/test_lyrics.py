"""Live lyric scores (FR-3): same method as the notebook, and no lyric text out (spec section 5)."""

from tmr.lyrics import clean_lyrics, lyric_va, score_song, similarity, theme_flags

SAD = "I am alone and crying tonight " * 10   # 60 words, made up (not real lyrics)


class FakeGenius:
    def __init__(self, hits, text=SAD):
        self.hits, self.text = hits, text

    def search_songs(self, q):
        return {"hits": [{"result": h} for h in self.hits]}

    def lyrics(self, song_url, remove_section_headers=True):
        return self.text


HIT = {"title": "Quiet Song", "primary_artist": {"name": "Some Band"}, "url": "https://genius.com/x"}


def sad_classifier(chunks):
    return [{"sadness": 0.9, "neutral": 0.1} for _ in chunks]


def test_lyric_va_maps_emotions_to_mood():
    v, a = lyric_va({"joy": 1.0})
    assert v > 0 and a > 0
    v, a = lyric_va({"sadness": 1.0})
    assert v < 0 and a < 0


def test_clean_lyrics_strips_genius_furniture():
    raw = "12 ContributorsSong Lyrics\n[Chorus]\nhello there\nYou might also like\nworld 3Embed"
    assert clean_lyrics(raw) == "hello there\nworld"


def test_similarity_ignores_features_and_case():
    assert similarity("Song (feat. X)", "song") == 1.0


def test_theme_flags():
    assert theme_flags("I want to die") == "self_harm"
    assert theme_flags("sunny day") == ""


def test_scored_song_returns_scores_and_no_text():
    out = score_song(FakeGenius([HIT]), sad_classifier, "Quiet Song", "Some Band")
    assert out["status"] == "scored"
    assert out["lyric_valence"] < 0
    assert "alone" not in repr(out)   # no lyric text leaves the function


def test_poor_match_is_rejected():
    out = score_song(FakeGenius([{**HIT, "title": "Totally Different"}]), sad_classifier, "Quiet Song", "Some Band")
    assert out == {"status": "rejected_match"}


def test_short_lyrics_count_as_instrumental():
    out = score_song(FakeGenius([HIT], text="la la"), sad_classifier, "Quiet Song", "Some Band")
    assert out == {"status": "instrumental"}


def test_non_english_is_skipped():
    out = score_song(FakeGenius([HIT]), sad_classifier, "Quiet Song", "Some Band", is_english=lambda t: False)
    assert out == {"status": "non_english"}


def test_not_found():
    assert score_song(FakeGenius([]), sad_classifier, "x", "y") == {"status": "not_found"}
