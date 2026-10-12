export interface LibraryFilter {
  q: string;
  /** `q` with characters that would break a PostgREST `.or()` string removed. */
  safeQ: string;
  tag: string | null;
  noTag: boolean;
}

/** Read `q`, `tag` and `no_tag` from the URL. `no_tag=1` wins over `tag`. */
export function parseLibraryFilter(params: URLSearchParams): LibraryFilter {
  const q = (params.get("q") ?? "").trim();
  const safeQ = q.replace(/[,()"]/g, " ").trim();
  const noTag = params.get("no_tag") === "1";
  const rawTag = params.get("tag") ?? "";
  const tag = noTag || rawTag === "" ? null : rawTag;
  return { q, safeQ, tag, noTag };
}

/**
 * Minimal structural view of a PostgREST filter builder, so one helper serves the count and
 * page queries. Deliberately non-generic: PostgREST's builder types are too deep to unify
 * against a self-referential constraint (TS2589), so the helper returns the caller's own type.
 */
interface Filterable {
  eq(column: string, value: string): Filterable;
  is(column: string, value: null): Filterable;
  or(filters: string): Filterable;
}

/** Apply the saved-status, text-search and tag filters shared by the count and page queries. */
export function applyLibraryFilter<Q>(query: Q, filter: LibraryFilter): Q {
  let result = (query as unknown as Filterable).eq("status", "saved");
  if (filter.safeQ) result = result.or(`front.ilike.%${filter.safeQ}%,back.ilike.%${filter.safeQ}%`);
  if (filter.noTag) result = result.is("tag", null);
  else if (filter.tag !== null) result = result.eq("tag", filter.tag);
  return result as unknown as Q;
}

/** Build a /library URL carrying the filter and page. */
export function buildLibraryHref(filter: Pick<LibraryFilter, "q" | "tag" | "noTag">, page = 1): string {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.noTag) params.set("no_tag", "1");
  else if (filter.tag !== null) params.set("tag", filter.tag);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/library?${qs}` : "/library";
}
