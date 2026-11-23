"""Playlist planner. Covers part of FR-3 (order songs by the iso principle)."""

import math

from tmr import config


def _distance(song, point):
    return math.hypot(song["valence"] - point[0], song["arousal"] - point[1])


def _stage(index, total):
    """Name the session stage for a position: match, shift or settle (FR-4)."""
    third = total / 3
    if index < third:
        return "match"
    if index < 2 * third:
        return "shift"
    return "settle"


def order_playlist(candidates, start, goal, length):
    """Pick and order songs so the playlist moves from start toward goal.

    candidates: list of dicts with "valence", "arousal" (-1..+1) and
                "duration_min" (minutes). Extra keys are kept.
    start, goal: (valence, arousal) points.
    length: session length in minutes.

    Returns a NEW list of song dicts in playlist order, each with an added
    "explanation". The candidates list and its dicts are not modified.

    FIRST-VERSION METHOD:
      1. Sort all candidates by distance to the goal, farthest first, so the
         distance to the goal never increases down the list.
      2. Pick evenly spaced songs across that order until the total time is
         close to length.
      3. Trim or add songs so the total is within the tolerance (NFR-5).
    Limits: "first track is closest to start" only holds when songs lie roughly
    between start and goal. If the pool is too short to fill the session, it
    returns as many songs as it has.
    """
    pool = sorted(candidates, key=lambda s: _distance(s, goal), reverse=True)
    n = len(pool)
    if n == 0:
        return []

    tol = config.LENGTH_TOLERANCE_MIN
    avg = sum(s["duration_min"] for s in pool) / n
    k = max(2, round(length / avg))
    k = min(k, n)

    if k == 1:
        chosen = [0]
    else:
        chosen = sorted({round(i * (n - 1) / (k - 1)) for i in range(k)})

    def total(indices):
        return sum(pool[i]["duration_min"] for i in indices)

    # Too long: drop the middle-most song (keeps both ends of the path).
    while total(chosen) > length + tol and len(chosen) > 2:
        chosen.pop(len(chosen) // 2)

    # Too short: add the first unused song that still fits.
    if total(chosen) < length - tol:
        for i in range(n):
            if i in chosen:
                continue
            if total(chosen) + pool[i]["duration_min"] <= length + tol:
                chosen.append(i)
                chosen.sort()
            if total(chosen) >= length - tol:
                break

    picked = [pool[i] for i in sorted(chosen)]
    result = []
    for idx, song in enumerate(picked):
        stage = _stage(idx, len(picked))
        explanation = (
            f"{stage.capitalize()} stage: this song sits {_distance(song, goal):.2f} "
            f"from the goal mood, moving the playlist toward it."
        )
        result.append(dict(song, explanation=explanation))
    return result
