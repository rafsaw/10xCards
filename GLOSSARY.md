# 10xCards

An AI-assisted spaced-repetition flashcard app: the AI turns a pasted passage into Drafts, the user decides which become Cards, and Cards come back in Reviews on a schedule.

## Drafts

**Draft**:
An AI-generated question-answer pair waiting for the user's decision. A Draft is not a Card: it is never reviewed and does not appear in the library.
_Avoid_: Candidate, candidate card, proposal

**Accept**:
The user's decision that a Draft should become a Card, and the one every Draft starts with, so no Draft is ever undecided at Save. It is provisional: nothing changes until Save, and the decision is lost if the user leaves or reloads the page first.
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
One rating of one due Card — Again, Hard, Good or Easy — which sets when that Card is due next. Deciding on Drafts is never a Review.
_Avoid_: Draft review, right/wrong

**Repetition**:
How many times in a row a Card has been recalled correctly. An Again Review sends it back to 0.
_Avoid_: Box, repetition count, level, stage, streak

**Ease factor**:
How easy a Card has proven for the user, which governs how far each next interval the Card gets is stretched. A high factor stretches an interval further; a low one stretches it less, but never tightens it — see ADR 0002, where Hard always lengthening an interval (just less than Good) is recorded as an accepted weakness. It starts at 2.5 and never falls below 1.3.
_Avoid_: Easiness, difficulty, strength, ease (alone); `efactor` is the term's spelling in the schema and the code (the `cards.efactor` column, `EFACTOR_FLOOR`, `currentEfactor`), so use it there and the full term in prose

**Review session**:
One pass through the Cards that are due right now, made up of one Review per Card.
_Avoid_: Study session, quiz
