"""UT-1: Distress detection (FR-2)."""

from tmr.questionnaire import is_distress


def test_ut1_distress_detection():
    # (a) stress 10 -> distress
    assert is_distress({"stress": 10, "wellbeing_flags": []}) is True
    # (b) stress 3, nothing flagged -> no distress
    assert is_distress({"stress": 3, "wellbeing_flags": [False, False]}) is False
    # (c) stress 9 sits exactly on the placeholder cutoff -> distress
    assert is_distress({"stress": 9, "wellbeing_flags": [False, False]}) is True


def test_ut1_flagged_wellbeing_item_triggers_even_at_low_stress():
    assert is_distress({"stress": 2, "wellbeing_flags": [False, True]}) is True


def test_ut1_does_not_change_its_input():
    answers = {"stress": 10, "wellbeing_flags": [False]}
    before = {"stress": 10, "wellbeing_flags": [False]}
    is_distress(answers)
    assert answers == before
