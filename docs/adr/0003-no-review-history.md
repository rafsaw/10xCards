# No review history

A Review leaves no trace beyond the schedule state it writes onto the Card. There is no
`reviews` table and no aggregate counters; `last_reviewed_at` is the only on-Card record
that a Review happened at all.

SM-2 is self-contained in Card state and has nothing to tune, so the scheduling argument
for history is empty, and no reader exists or is planned. The cost would be real: a new
owner-scoped RLS surface — a new cross-user isolation surface — plus a slot in the deletion
cascade, plus two-user test coverage, for rows nothing reads. The write would also stop
being atomic: adding an insert beside today's single guarded update means two untransacted
writes.

The trade-off accepted is that history is write-once, so the pre-decision log is
unrecoverable. Adding it later is a pure addition: a new table, RLS and cascade, with no
change to the algorithm or the API contract.

**Revisit trigger: the first feature that reads history** — statistics, undo of the last
rating, or parameter tuning.
