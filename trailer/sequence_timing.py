"""One clock for the focused V16 idea-to-team revision.

Outside the replacement window, picture and sound retain V16's exact relative timing.
The four-second extension is eight beats of the existing 120 BPM score.
All times are story seconds; subtract FILM_START for player time.
"""
FILM_START = 3.4
V16_SEQUENCE = (32.6, 40.0)
EXTRA_SECONDS = 4.0
SEQUENCE = (V16_SEQUENCE[0], V16_SEQUENCE[1] + EXTRA_SECONDS)
PROPOSE = (33.6, 34.9)
REVIEW = (34.9, 36.5)
APPROVAL = (36.5, 38.3)
APPROVE_PRESS = 37.55
APPROVED = 37.75
RECRUIT = (38.3, 44.0)
BEN_PRESS, BEN_JOIN = 39.25, 39.65
PRIYA_PRESS, PRIYA_JOIN = 40.85, 41.25
TEAM_LOCK = 41.6
PLAN_HANDOVER = (42.25, 44.0)
# Copy a whole two-bar phrase into the score, preserving every later V16 cue.
SCORE_INSERT = 35.0
SCORE_LOOP_START = SCORE_INSERT - EXTRA_SECONDS

def from_v16(story):
    """An unchanged V16 event's time in this cut. Replaced events use constants above."""
    return story + EXTRA_SECONDS if story >= V16_SEQUENCE[1] else story

def to_v16(story):
    """Source clock for unchanged picture and its shutter windows."""
    if story <= SEQUENCE[0]:
        return story
    if story >= SEQUENCE[1]:
        return story - EXTRA_SECONDS
    return V16_SEQUENCE[0] + (story - SEQUENCE[0]) * (V16_SEQUENCE[1] - V16_SEQUENCE[0]) / (SEQUENCE[1] - SEQUENCE[0])
