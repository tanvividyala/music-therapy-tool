"""Functional tests FT-1 to FT-3. Skipped until login and the pipeline exist."""

import pytest

NEEDS_SPOTIFY = "Needs a test Spotify account and the Spotify client (FR-1, FR-5)"


@pytest.mark.skip(reason=NEEDS_SPOTIFY + " and a populated catalog.db")
def test_ft1_questionnaire_to_playlist():
    """FR-1, FR-3, NFR-1, NFR-3, NFR-5: login, disclaimer, questionnaire, playlist."""


@pytest.mark.skip(reason="Needs the app screens (crisis resources shown, no playlist)")
def test_ft2_crisis_safeguard():
    """FR-2, NFR-3: stress 10 with flagged wellbeing answers shows 988, no playlist."""


@pytest.mark.skip(reason=NEEDS_SPOTIFY)
def test_ft3_save_to_spotify():
    """FR-5, FR-1, NFR-2: saved playlist has the same N tracks in the same order."""
