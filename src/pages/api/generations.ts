import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { createClient } from "@/lib/supabase";
import { generateCandidateCards, OpenRouterError } from "@/lib/openrouter";

const MIN_SOURCE_LENGTH = 200;
const MAX_SOURCE_LENGTH = 8000;
const REQUEST_TIMEOUT_MS = 60_000;

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

  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    return json({ error: "ai_unconfigured", message: "AI generation is not configured." }, 503);
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "bad_request", message: "Request body must be JSON." }, 400);
  }

  const rawSource = typeof payload === "object" && payload !== null && "source" in payload ? payload.source : undefined;
  const source = typeof rawSource === "string" ? rawSource.trim() : "";
  if (source.length < MIN_SOURCE_LENGTH || source.length > MAX_SOURCE_LENGTH) {
    return json({ error: "invalid_source", message: "Source text must be between 200 and 8000 characters." }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  let cards;
  try {
    cards = await generateCandidateCards(source, {
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      if (err.code === "openrouter_timeout") {
        return json({ error: "ai_timeout", message: "AI generation timed out. Please try again." }, 504);
      }
      if (err.code === "openrouter_parse_error") {
        return json({ error: "ai_parse_error", message: "Could not read AI response. Please try again." }, 502);
      }
      return json({ error: "ai_provider_error", message: "AI provider error.", detail: err.detail }, 502);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "supabase_unconfigured", message: "Database is not configured." }, 503);
  }

  const insertPayload = cards.map((c) => ({
    user_id: user.id,
    front: c.front,
    back: c.back,
    status: "draft",
  }));

  const { data, error } = await supabase.from("cards").insert(insertPayload).select("id, front, back, created_at");

  if (error) {
    return json({ error: "db_error", message: "Could not save drafts." }, 500);
  }

  return json({ drafts: data }, 200);
};
