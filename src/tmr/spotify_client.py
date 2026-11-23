"""Spotify access, kept in its own file so everything else works without it.

Covers FR-1 (Spotify login) and FR-5 (save to Spotify). Stubs for now.
Keys come from environment variables (see .env.example), never from code.
"""


class SpotifyClient:
    def login(self):
        """FR-1: sign in with Spotify OAuth and keep the user signed in."""
        raise NotImplementedError("FR-1 not built yet")

    def top_artists_and_genres(self):
        """Used to narrow the candidate song pool to what the user likes."""
        raise NotImplementedError("Not built yet")

    def save_playlist(self, name, tracks):
        """FR-5: save the generated playlist, same tracks, same order."""
        raise NotImplementedError("FR-5 not built yet")
