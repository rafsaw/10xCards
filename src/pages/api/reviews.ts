import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { readOnlyGuard } from "@/lib/account-retention";
import { schedule, type ReviewRating } from "@/lib/leitner";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isReviewRating(value: unknown): value is ReviewRating {
  return value === "right" || value === "wrong";
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
  const rawBox = obj && "currentBox" in obj ? obj.currentBox : undefined;

  const cardId = typeof rawCardId === "string" && rawCardId.length > 0 ? rawCardId : null;
  const rating = isReviewRating(rawRating) ? rawRating : null;
  const currentBox = typeof rawBox === "number" && Number.isInteger(rawBox) && rawBox >= 0 ? rawBox : null;
  if (cardId === null || rating === null || currentBox === null) {
    return json(
      { error: "invalid_rating", message: "Provide cardId, rating ('right'|'wrong'), and a non-negative currentBox." },
      400,
    );
  }

  const next = schedule(currentBox, rating);

  // Single-row, owner-scoped, box-guarded write. The cards_update_own RLS policy
  // scopes this to auth.uid(), so a stale/draft/foreign id simply matches no row.
  // The repetition_count guard makes the write idempotent: a double-POST or retry
  // of the same rating (same currentBox) matches 0 rows on replay -> applied:false,
  // so the box is never double-promoted. Mirrors finalize_drafts' fail-closed guard.
  const { data, error } = await supabase
    .from("cards")
    .update({
      repetition_count: next.repetition_count,
      interval_days: next.interval_days,
      next_due_at: next.next_due_at,
      last_reviewed_at: next.last_reviewed_at,
    })
    .eq("id", cardId)
    .eq("status", "saved")
    .eq("repetition_count", currentBox)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();

  if (error) {
    return json({ error: "db_error", message: "Could not record your review." }, 500);
  }

  // applied:false means no row matched (stale/draft/foreign id, or a replay of an
  // already-applied rating). The client treats this as success and advances.
  return json({ applied: data.length > 0 }, 200);
};
