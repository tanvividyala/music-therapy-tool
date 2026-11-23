"""UT-3: Iso ordering (FR-3), using the Calm route."""

import copy
import math

from tmr.planner import order_playlist
from tmr.questionnaire import route_points

START, GOAL = route_points("Calm")  # (-0.4, 0.6) to (0.4, -0.4)
LENGTH = 30


def make_candidates():
    """20 songs spread along the path from START to GOAL, over 30 min in total."""
    durations = [3.0, 3.5, 4.0, 3.2]
    songs = []
    for i in range(20):
        t = i / 19
        songs.append({
            "song_id": i,
            "valence": START[0] + t * (GOAL[0] - START[0]),
            "arousal": START[1] + t * (GOAL[1] - START[1]),
            "duration_min": durations[i % 4],
        })
    return songs


def dist(song, point):
    return math.hypot(song["valence"] - point[0], song["arousal"] - point[1])


def test_ut3_iso_ordering():
    candidates = make_candidates()
    assert sum(s["duration_min"] for s in candidates) > LENGTH

    playlist = order_playlist(candidates, START, GOAL, length=LENGTH)

    # First track is closest to start, last track is closest to goal.
    assert dist(playlist[0], START) == min(dist(s, START) for s in playlist)
    assert dist(playlist[-1], GOAL) == min(dist(s, GOAL) for s in playlist)

    # Distance to the goal never increases between tracks.
    goal_distances = [dist(s, GOAL) for s in playlist]
    assert all(a >= b for a, b in zip(goal_distances, goal_distances[1:]))

    # Total duration within 27 to 33 minutes (NFR-5).
    total = sum(s["duration_min"] for s in playlist)
    assert 27 <= total <= 33

    # Every track has a non-empty explanation (FR-3).
    assert all(s["explanation"].strip() for s in playlist)


def test_ut3_candidate_pool_is_unmodified():
    candidates = make_candidates()
    before = copy.deepcopy(candidates)
    result = order_playlist(candidates, START, GOAL, length=LENGTH)
    assert isinstance(result, list)
    assert candidates == before
