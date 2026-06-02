import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { readOnlyGuard } from "@/lib/account-retention";

// No generated Supabase types in this codebase; narrow the .select() result
// locally and apply via .overrideTypes (consistent with save.ts).
interface CardId {
  id: string;
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

export const PATCH: APIRoute = async (context) => {
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

  const id = context.params.id;
  if (!id) {
    return json({ error: "bad_request", message: "Card id is required." }, 400);
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

  // Update only front/back. The cards_set_updated_at trigger bumps updated_at;
  // schedule fields (next_due_at, repetition_count, interval_days) are left
  // untouched so editing a typo does not reset review progress. RLS confines to
  // the owner; the status guard prevents editing drafts via this surface.
  const { data, error } = await supabase
    .from("cards")
    .update({ front, back })
    .eq("id", id)
    .eq("status", "saved")
    .select("id")
    .overrideTypes<CardId[], { merge: false }>();

  if (error) {
    return json({ error: "db_error", message: "Could not update the card." }, 500);
  }
  if (data.length === 0) {
    return json({ error: "not_found", message: "Card not found." }, 404);
  }

  return json({ id: data[0].id }, 200);
};

export const DELETE: APIRoute = async (context) => {
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

  const id = context.params.id;
  if (!id) {
    return json({ error: "bad_request", message: "Card id is required." }, 400);
  }

  // Hard delete. RLS confines to the owner; the status guard keeps this surface
  // limited to saved cards. The .select() lets us distinguish a real delete
  // (one row) from a no-op (zero rows -> 404).
  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", id)
    .eq("status", "saved")
    .select("id")
    .overrideTypes<CardId[], { merge: false }>();

  if (error) {
    return json({ error: "db_error", message: "Could not delete the card." }, 500);
  }
  if (data.length === 0) {
    return json({ error: "not_found", message: "Card not found." }, 404);
  }

  return json({ ok: true }, 200);
};
