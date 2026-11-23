"""Settings in one place so they are easy to change.

Mood points are (valence, arousal) on a -1..+1 scale.
Valence = how pleasant, arousal = how energetic.
"""

# PLACEHOLDER distress rule (FR-2). The group still has to decide the real one:
# which wellbeing items we ask and how they trigger the crisis screen.
DISTRESS_STRESS_THRESHOLD = 9  # stress is 1-10; this value or higher triggers

# Session lengths offered by the questionnaire (minutes) and the allowed
# error from NFR-5.
SESSION_LENGTHS = (30, 45, 60)
LENGTH_TOLERANCE_MIN = 3

# Routes table from the Questionnaire section of the spec.
# Each goal has a typical start mood and an end mood, as (valence, arousal).
# "Hype" is a goal tag in the questionnaire but has no route yet.
ROUTES = {
    "Calm": {"start": (-0.4, 0.6), "end": (0.4, -0.4)},
    "Focus": {"start": (-0.1, 0.5), "end": (0.2, 0.0)},
    "Sleep": {"start": (-0.2, 0.3), "end": (0.2, -0.8)},
    "Uplift": {"start": (-0.5, -0.4), "end": (0.6, 0.5)},
    "Release": {"start": (-0.6, -0.2), "end": (0.3, -0.1)},
}
