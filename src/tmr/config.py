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

# BPM hard filter for the END ("settle") stage of each route. The start of a
# playlist follows the user's current mood (iso principle), so it isn't limited.
# Not wired into the planner yet.
# Sources:
#  - Slower tempo lowers breathing rate, heart rate and blood pressure; arousal
#    tracks tempo (Bernardi, Porta & Sleight 2006, Heart 92(4):445-52;
#    Husain, Thompson & Schellenberg 2002, Music Perception 20(2):151-171).
#  - Sleep studies typically use 52-85 BPM (as summarized in later work on
#    Dickson & Schubert 2020, Musicae Scientiae 26(3)); sleep playlists are
#    slower, quieter and more acoustic than general music (Scarratt et al.
#    2023, PLOS ONE 18:e0278813). Self-chosen sleep music can be faster
#    (~107 BPM on average in Dickson & Schubert), so Sleep is a soft upper bound.
#  - Focus: lyrics impair attention, so prefer instrumentals (Shih et al. 2012,
#    Work 42(4):573-578; Souza & Barbosa 2023, Journal of Cognition).
#  - Release: high-arousal music after anger matched physiology and raised
#    positive affect rather than anger (Sharman & Dingle 2015, Front. Hum.
#    Neurosci. 9:272); sad music can regulate mood (Sachs, Damasio & Habibi
#    2015, Front. Hum. Neurosci. 9:404).
# Sleep and Calm follow the sources. Focus, Uplift and Release ranges are team
# choices that only follow the sources' direction (faster = more arousal).
GOAL_END_BPM = {
    "Calm": (60, 90),
    "Focus": (60, 120),
    "Sleep": (50, 85),
    "Uplift": (100, 140),
    "Release": (60, 110),
}
FOCUS_PREFER_INSTRUMENTAL = True
