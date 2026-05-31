// Deliberately-simple Leitner scheduler for the S-04 review session.
// Pure function, edge-safe (Date.now / toISOString are V8 globals — no
// nodejs_compat dependency). The box index is persisted in cards.repetition_count.
// See context/changes/srs-review-session/leitner-docs.md for the full spec.

export const BOX_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30] as const; // 6 boxes
export const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;

const DAY_MS = 86_400_000;

export type ReviewRating = "right" | "wrong";

export interface Schedule {
  repetition_count: number; // new box index (0..MAX_BOX)
  interval_days: number; // days until next due, from the new box
  next_due_at: string; // ISO timestamp
  last_reviewed_at: string; // ISO timestamp
}

// right -> promote one box (capped at MAX_BOX, where it stays "graduated");
// wrong -> reset to box 0. The new box's fixed interval sets the next due date.
// `now` is injectable for testing; defaults to the call-time epoch ms.
export function schedule(box: number, rating: ReviewRating, now: number = Date.now()): Schedule {
  const nextBox = rating === "right" ? Math.min(box + 1, MAX_BOX) : 0;
  const interval = BOX_INTERVALS_DAYS[nextBox];
  const nowIso = new Date(now).toISOString();
  return {
    repetition_count: nextBox,
    interval_days: interval,
    next_due_at: new Date(now + interval * DAY_MS).toISOString(),
    last_reviewed_at: nowIso,
  };
}
