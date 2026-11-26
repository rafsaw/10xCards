import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { readOnlyGuard } from "@/lib/account-retention";
import { schedule, type Rating, EFACTOR_FLOOR } from "@/lib/sm2";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isRating(value: unknown): value is Rating {
  return value === "again" || value === "hard" || value === "good" || value === "easy";
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return json({ error: "unauthorized", message: "Login required." }, 401);
  }

  const readOnly = readOnlyGuard(context.locals);
  if (readOnly) return readOnly;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "supabase_unconfigured", message: "Database is not configured." }, 503);
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }

  const obj = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;
  const rawCardId = obj && "cardId" in obj ? obj.cardId : undefined;
  const rawRating = obj && "rating" in obj ? obj.rating : undefined;
  const rawRepetition = obj && "currentRepetition" in obj ? obj.currentRepetition : undefined;
  const rawEfactor = obj && "currentEfactor" in obj ? obj.currentEfactor : undefined;
  const rawIntervalDays = obj && "currentIntervalDays" in obj ? obj.currentIntervalDays : undefined;

  // Type plus lower bounds only — no upper bounds and no decimal-place check. The
  // update below is fail-closed, so an out-of-range or over-precise echo matches no
  // row rather than making a bad write; validation's only job is to reject payloads
  // that cannot be fed to schedule(). currentIntervalDays = 0 is legal (a
  // never-reviewed Card), and the 1.3 floor is the same number as the column CHECK.
  const cardId = typeof rawCardId === "string" && rawCardId.length > 0 ? rawCardId : null;
  const rating = isRating(rawRating) ? rawRating : null;
  const currentRepetition =
    typeof rawRepetition === "number" && Number.isInteger(rawRepetition) && rawRepetition >= 0 ? rawRepetition : null;
  const currentEfactor =
    typeof rawEfactor === "number" && Number.isFinite(rawEfactor) && rawEfactor >= EFACTOR_FLOOR ? rawEfactor : null;
  const currentIntervalDays =
    typeof rawIntervalDays === "number" && Number.isInteger(rawIntervalDays) && rawIntervalDays >= 0
      ? rawIntervalDays
      : null;
  if (
    cardId === null ||
    rating === null ||
    currentRepetition === null ||
    currentEfactor === null ||
    currentIntervalDays === null
  ) {
    return json(
      {
        error: "invalid_rating",
        message:
          "Provide cardId, rating ('again'|'hard'|'good'|'easy'), a non-negative integer currentRepetition, " +
          "a currentEfactor of at least 1.3, and a non-negative integer currentIntervalDays.",
      },
      400,
    );
  }

  const next = schedule(
    { repetition: currentRepetition, efactor: currentEfactor, interval_days: currentIntervalDays },
    rating,
  );

  // Single-row, owner-scoped, state-guarded write. The cards_update_own RLS policy
  // scopes this to auth.uid(), so a stale/draft/foreign id simply matches no row.
  // The three-column guard on the scheduler state makes the write idempotent: a
  // double-POST or retry of the same rating carries the pre-review state, matches 0
  // rows on replay -> applied:false, so a rating is recorded at most once. It is
  // also fail-closed against a client echoing state the row does not have.
  // Mirrors finalize_drafts' fail-closed guard.
  const { data, error } = await supabase
    .from("cards")
    .update({
      repetition: next.repetition,
      efactor: next.efactor,
      interval_days: next.interval_days,
      next_due_at: next.next_due_at,
      last_reviewed_at: next.last_reviewed_at,
    })
    .eq("id", cardId)
    .eq("status", "saved")
    .eq("repetition", currentRepetition)
    .eq("efactor", currentEfactor)
    .eq("interval_days", currentIntervalDays)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();

  if (error) {
    return json({ error: "db_error", message: "Could not record your review." }, 500);
  }

  // applied:false means no row matched (stale/draft/foreign id, or a replay of an
  // already-applied rating). The client treats this as success and advances.
  return json({ applied: data.length > 0 }, 200);
};
