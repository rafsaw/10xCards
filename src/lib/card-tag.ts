import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_TAG_LENGTH = 40;

export type TagParse = { ok: true; tag: string | null } | { ok: false };

/**
 * Parse a raw `tag` value from a request body. Callers handle `undefined`
 * (absent) themselves before calling; here it is treated like "no tag".
 * Length is counted in code points to match Postgres `char_length`.
 */
export function parseTag(raw: unknown): TagParse {
  if (raw === undefined || raw === null) return { ok: true, tag: null };
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, tag: null };
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code points match Postgres char_length
  if ([...trimmed].length > MAX_TAG_LENGTH) return { ok: false };
  return { ok: true, tag: trimmed };
}

/**
 * Return the existing spelling (earliest-used first) of `tag` among the
 * caller's tags, compared case-insensitively; otherwise `tag` as typed.
 * Throws when the `card_tags` RPC fails so callers fail closed.
 */
export async function canonicalizeTag(supabase: SupabaseClient, tag: string): Promise<string> {
  const existing = await listTags(supabase);
  const wanted = tag.toLowerCase();
  return existing.find((t) => t.toLowerCase() === wanted) ?? tag;
}

/** The caller's distinct tags, earliest-used first. Throws when the RPC fails. */
export async function listTags(supabase: SupabaseClient): Promise<string[]> {
  const res = await supabase.rpc("card_tags");
  if (res.error) throw new Error("card_tags rpc failed");
  const data: unknown = res.data;
  return Array.isArray(data) ? (data as string[]) : [];
}

/**
 * Distinct tags of the caller's SAVED cards, earliest first. Unlike `listTags`
 * (which includes drafts for autocomplete/canonicalization), this feeds the
 * library filter so it never offers a tag that matches no visible card.
 * RLS scopes the rows to the owner. Throws on query error.
 */
export async function listSavedTags(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("tag")
    .eq("status", "saved")
    .not("tag", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error("saved tags query failed");
  const seen = new Set<string>();
  for (const row of data as { tag: string | null }[]) if (row.tag !== null) seen.add(row.tag);
  return [...seen];
}
