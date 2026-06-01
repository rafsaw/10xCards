import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

// Shape returned by the insert .select(). No generated Supabase types in this
// codebase, so the loosely-typed result is narrowed here and applied via
// .overrideTypes (consistent with generate.astro / save.ts).
interface SavedCard {
  id: string;
  front: string;
  back: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return json({ error: "unauthorized", message: "Login required." }, 401);
  }

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

  const rawFront = typeof payload === "object" && payload !== null && "front" in payload ? payload.front : undefined;
  const rawBack = typeof payload === "object" && payload !== null && "back" in payload ? payload.back : undefined;
  const front = asNonEmptyString(rawFront);
  const back = asNonEmptyString(rawBack);
  if (front === null || back === null) {
    return json({ error: "invalid_card", message: "Both front and back are required." }, 400);
  }

  // A manually-created card enters the SR lifecycle immediately: status='saved'
  // AND next_due_at=now() so the review query surfaces it. interval_days and
  // repetition_count keep their column defaults (0).
  const { data, error } = await supabase
    .from("cards")
    .insert({ user_id: user.id, front, back, status: "saved", next_due_at: new Date().toISOString() })
    .select("id, front, back")
    .single()
    .overrideTypes<SavedCard, { merge: false }>();

  if (error) {
    return json({ error: "db_error", message: "Could not save the card." }, 500);
  }

  return json({ card: data }, 201);
};
