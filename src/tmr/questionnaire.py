"""Questionnaire logic. Covers FR-2 (mood questionnaire with crisis safeguard)."""

from tmr import config


def is_distress(answers):
    """Return True if the answers suggest severe distress (show crisis resources).

    answers is a dict with:
        "stress": int from 1 to 10
        "wellbeing_flags": list of booleans, True = that wellbeing item is flagged
                           (optional, defaults to none flagged)

    PLACEHOLDER RULE: stress at or above the config threshold, or any
    wellbeing item flagged. The group will replace this with the real rule.

    This function only decides yes or no. It does not write to a database
    and does not start building a playlist (see UT-1 postconditions).
    """
    stress = answers["stress"]
    flags = answers.get("wellbeing_flags", [])
    return stress >= config.DISTRESS_STRESS_THRESHOLD or any(flags)


def route_points(goal):
    """Return (start, end) mood points for a goal tag, e.g. "Calm".

    Raises KeyError for a goal with no route yet (for example "Hype").
    """
    route = config.ROUTES[goal]
    return route["start"], route["end"]
