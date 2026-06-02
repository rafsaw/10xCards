import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Cancel a pending deletion (FR-018) and restore read-write. Does NOT call the
// read-only guard — cancel must work while the account is read-only. Deleting
// the request row makes the next request recompute isReadOnly=false. Idempotent:
// deleting zero rows still returns ok.
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return json({ error: "unauthorized", message: "Login required." }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "supabase_unconfigured", message: "Database is not configured." }, 503);
  }

  // RLS scopes the delete to the owner's own row.
  const { error } = await supabase.from("account_deletion_requests").delete().eq("user_id", user.id);

  if (error) {
    return json({ error: "db_error", message: "Could not cancel your deletion request." }, 500);
  }

  return json({ ok: true }, 200);
};
