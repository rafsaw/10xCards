# 10xCards

An AI-assisted spaced-repetition flashcard app: the AI turns a pasted passage into Drafts, the user decides which become Cards, and Cards come back in Reviews on a schedule.

## Drafts

**Draft**:
An AI-generated question-answer pair waiting for the user's decision. A Draft is not a Card: it is never reviewed and does not appear in the library.
_Avoid_: Candidate, candidate card, proposal

**Accept**:
The user's decision that a Draft should become a Card. It is provisional: nothing changes until Save, and the decision is lost if the user leaves or reloads the page first.
_Avoid_: Keep, approve

**Reject**:
The user's decision that a Draft should not become a Card. It is provisional like Accept; at Save the Draft is permanently deleted and leaves no trace.
_Avoid_: Discard, remove

**Save**:
The single step that applies every Accept and Reject on the user's Drafts at once, all or nothing. Accepted Drafts become Cards at this moment and are immediately due; rejected Drafts are deleted.
_Avoid_: Save changes, finalize, confirm

## Cards and reviewing

**Card**:
A question-answer pair in the user's study set, created either by saving an accepted Draft or by writing it manually. Only Cards appear in the library and in Reviews.
_Avoid_: Saved draft

**Review**:
One rating of one due Card (right or wrong), which sets when that Card is due next. Deciding on Drafts is never a Review.
_Avoid_: Draft review

**Box**:
The step of the schedule a Card currently sits in, which alone decides how long until it is due again. A right Review moves the Card up one Box, a wrong Review sends it back to the first; it counts consecutive successes, not Reviews.
_Avoid_: Repetition count, level, stage

**Review session**:
One pass through the Cards that are due right now, made up of one Review per Card.
_Avoid_: Study session, quiz
