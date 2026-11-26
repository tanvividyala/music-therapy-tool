"""Live lyric scores for the web app (FR-3, NFR-1, NFR-2).

Run from the repo root, next to the Vite dev server:

    PYTHONPATH=src python3 -m tmr.lyrics_api

POST /lyric-scores  {"tracks": [{"spotify_id", "title", "artist"}, ...]}  (max 40)
 -> {"scores": {spotify_id: {"status", "lyric_valence"?, "lyric_arousal"?, "flags"?}}}
GET  /health        -> {"ok": true, "genius": bool}

Lyric text is fetched from Genius, scored in memory and dropped: it is never
written to disk, logged or sent back (spec section 5). Only the derived scores
are cached, in data/raw/live_lyric_scores.json (gitignored), so repeat
requests are instant. The Genius token stays on this server, never in the browser.
"""

import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from dotenv import load_dotenv

from tmr.lyrics import EMOTION_MODEL, score_song

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

PORT = int(os.environ.get("MUISO_LYRICS_PORT", "8787"))
ALLOWED_ORIGINS = set(filter(None, os.environ.get(
    "MUISO_ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,https://tanvividyala.github.io",
).split(",")))
MAX_TRACKS = 40
WORKERS = 6
CACHE_PATH = ROOT / "data" / "raw" / "live_lyric_scores.json"

_cache_lock = threading.Lock()
_model_lock = threading.Lock()
_cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
_genius = None
_classifier = None
_is_english = None


def _setup():
    """Load Genius, the emotion classifier and language detection once."""
    global _genius, _classifier, _is_english
    token = os.environ.get("GENIUS_ACCESS_TOKEN")
    if not token:
        raise SystemExit("GENIUS_ACCESS_TOKEN is not set in .env")
    os.environ.setdefault("USE_TF", "0")
    from langdetect import DetectorFactory, detect
    from lyricsgenius import Genius
    from transformers import pipeline

    DetectorFactory.seed = 0
    _genius = Genius(token, timeout=10, retries=1, sleep_time=0.2)
    _genius.verbose = False
    _classifier = pipeline("text-classification", model=EMOTION_MODEL, top_k=None, truncation=True)

    def is_english(text):
        try:
            return detect(text) == "en"
        except Exception:
            return False

    _is_english = is_english


def _classify(chunk_list):
    with _model_lock:  # the pipeline is not thread-safe
        outs = _classifier(chunk_list)
    return [{d["label"]: d["score"] for d in out} for out in outs]


def _score_one(track):
    sid = track["spotify_id"]
    with _cache_lock:
        if sid in _cache:
            return sid, _cache[sid]
    try:
        result = score_song(_genius, _classify, track["title"], track["artist"], _is_english)
    except Exception:
        return sid, {"status": "error"}  # not cached: worth retrying later
    with _cache_lock:
        _cache[sid] = result
    return sid, result


def _save_cache():
    with _cache_lock:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(_cache))


def score_tracks(tracks):
    tracks = [t for t in tracks if t.get("spotify_id") and t.get("title") and t.get("artist")][:MAX_TRACKS]
    with ThreadPoolExecutor(WORKERS) as pool:
        scores = dict(pool.map(_score_one, tracks))
    _save_cache()
    return scores


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "genius": _genius is not None})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/lyric-scores":
            return self._json(404, {"error": "not found"})
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 200_000)
            body = json.loads(self.rfile.read(length) or b"{}")
            tracks = body.get("tracks", [])
            if not isinstance(tracks, list):
                raise ValueError
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "expected {\"tracks\": [...]}"})
        self._json(200, {"scores": score_tracks(tracks)})

    def log_message(self, fmt, *args):
        # Request line only (method, path, status). Never bodies.
        print(f"{self.address_string()} {fmt % args}")


def main():
    print("Loading Genius client and emotion model (first run downloads ~330 MB)…")
    _setup()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Muiso lyric scores on http://127.0.0.1:{PORT}  (allowed: {', '.join(sorted(ALLOWED_ORIGINS))})")
    server.serve_forever()


if __name__ == "__main__":
    main()
