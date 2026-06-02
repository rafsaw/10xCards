import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const RETENTION_DAYS = 30;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Request account deletion (FR-016): place the account into the 30-day retention
// state. Does NOT call the read-only guard — a pending user re-requesting is a
// no-op that returns the existing window. The user stays logged in but the next
// navigation computes isReadOnly=true from the now-present request row.
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return json({ error: "unauthorized", message: "Login required." }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "supabase_unconfigured", message: "Database is not configured." }, 503);
  }

  const now = new Date();
  const retentionUntil = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Insert-or-select (NOT upsert): a plain upsert would move the window on every
  // re-request. RLS allows the owner to insert their own row.
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .insert({ user_id: user.id, requested_at: now.toISOString(), retention_until: retentionUntil })
    .select("retention_until")
    .single()
    .overrideTypes<{ retention_until: string }, { merge: false }>();

  if (error) {
    // Duplicate key (Postgres 23505) — already pending. Return the existing
    // window unchanged; never overwrite requested_at / retention_until.
    if (error.code === "23505") {
      const { data: existing, error: selectError } = await supabase
        .from("account_deletion_requests")
        .select("retention_until")
        .eq("user_id", user.id)
        .single()
        .overrideTypes<{ retention_until: string }, { merge: false }>();
      if (selectError) {
        return json({ error: "db_error", message: "Could not read your deletion request." }, 500);
      }
      return json({ ok: true, retention_until: existing.retention_until }, 200);
    }
    return json({ error: "db_error", message: "Could not request account deletion." }, 500);
  }

  return json({ ok: true, retention_until: data.retention_until }, 201);
};
