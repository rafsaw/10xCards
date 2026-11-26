# 10xCards

An AI-assisted spaced-repetition flashcard app: the AI turns a pasted passage into Drafts, the user decides which become Cards, and Cards come back in Reviews on a schedule.

## Language

**Draft**:
An AI-generated question-answer pair awaiting acceptance or rejection, excluded from the library and **Reviews**. An accepted Draft becomes a **Card** only when saved.
_Avoid_: Candidate, candidate card, proposal

**Card**:
A question-answer pair in the user's study set, created either by saving an accepted **Draft** or by writing it manually. Only Cards appear in the library and in **Reviews**.
_Avoid_: Saved draft

**Review**:
One rating of one due **Card** — Again, Hard, Good or Easy — which sets when that Card is due next. Deciding on **Drafts** is never a Review.
_Avoid_: Draft review

**Review session**:
One pass through the **Cards** due at the start of the session, with one **Review** per Card.
_Avoid_: Study session, quiz

**Repetition**:
The number of consecutive successful recalls of a **Card**, not its total number of **Reviews** — Again resets it to 0.
_Avoid_: Review count, Box, level, stage
