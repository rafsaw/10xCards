import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  const { error } = await supabase.from("cards").delete().eq("user_id", user.id).eq("status", "draft");

  if (error) {
    return json({ error: "db_error", message: "Could not discard drafts." }, 500);
  }

  return context.redirect("/generate");
};
