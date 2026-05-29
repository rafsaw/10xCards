import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

// Shape returned by the public.finalize_drafts(uuid[], uuid[]) rpc. No generated
// Supabase types in this codebase, so the loosely-typed rpc result is narrowed
// here and applied via .overrideTypes (consistent with generate.astro's cast).
interface FinalizeResult {
  saved_count: number;
  discarded_count: number;
}

const MAX_SELECTION = 100;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function asStringArray(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) return null;
    result.push(item);
  }
  return result;
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

  const rawAccept = typeof payload === "object" && payload !== null && "accept" in payload ? payload.accept : undefined;
  const rawReject = typeof payload === "object" && payload !== null && "reject" in payload ? payload.reject : undefined;
  const accept = asStringArray(rawAccept);
  const reject = asStringArray(rawReject);
  if (accept === null || reject === null || accept.length + reject.length > MAX_SELECTION) {
    return json({ error: "invalid_selection", message: "Selection must be id arrays." }, 400);
  }

  // Completeness guard: the submitted selection must resolve EXACTLY the caller's
  // current draft set. RLS scopes this select to auth.uid(), so the union check
  // also rejects any id outside the caller's own drafts (cross-user 400, before
  // the rpc). A stale tab whose draft set changed elsewhere fails closed here.
  const { data: draftRows, error: draftError } = await supabase
    .from("cards")
    .select("id")
    .eq("status", "draft")
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (draftError) {
    return json({ error: "db_error", message: "Could not save your selection." }, 500);
  }
  const draftIds = new Set(draftRows.map((row) => row.id));
  const submitted = [...accept, ...reject];
  const submittedSet = new Set(submitted);
  const exactlyCoversDrafts =
    submitted.length === submittedSet.size && // no duplicate/overlapping ids (enforces disjoint accept/reject)
    submittedSet.size === draftIds.size &&
    submitted.every((id) => draftIds.has(id));
  if (!exactlyCoversDrafts) {
    return json({ error: "incomplete_selection", message: "Your draft list changed. Refresh and review again." }, 400);
  }

  // rpc() is loosely typed without generated Supabase types; cast the awaited
  // result to the known finalize_drafts return shape (returns table -> row array).
  const { data, error } = (await supabase.rpc("finalize_drafts", {
    p_accept_ids: accept,
    p_reject_ids: reject,
  })) as { data: FinalizeResult[] | null; error: { message: string } | null };

  if (error) {
    return json({ error: "db_error", message: "Could not save your selection." }, 500);
  }

  const row = data?.[0];
  return json({ saved: row?.saved_count ?? 0, discarded: row?.discarded_count ?? 0 }, 200);
};
