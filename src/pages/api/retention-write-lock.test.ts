import type { APIContext, APIRoute } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";

// Real route handlers under test — imported directly (not stand-ins) so a future
// write route that forgets readOnlyGuard would surface here the moment it is
// added to the table below (manual check 3.3).
import { POST as cardsPost } from "@/pages/api/cards";
import { PATCH as cardPatch, DELETE as cardDelete } from "@/pages/api/cards/[id]";
import { POST as generationsPost } from "@/pages/api/generations";
import { POST as savePost } from "@/pages/api/generations/save";
import { POST as discardPost } from "@/pages/api/generations/discard";
import { POST as reviewsPost } from "@/pages/api/reviews";
import { POST as cancelPost } from "@/pages/api/account/cancel";
import { POST as deletePost } from "@/pages/api/account/delete";

// R4 retention write-lock (hermetic). The lock is a PURE function of
// locals.isReadOnly (account-retention.readOnlyGuard runs before any DB call),
// so this needs no real DB: drive every mutating route directly with faked
// locals and a recording client, and assert (1) read-only -> 403 + the mutating
// client methods were never invoked, (2) writable -> the route proceeds past the
// guard. The two lifecycle routes (cancel/delete) must stay usable while
// read-only — they deliberately skip the guard so a user can escape retention.
//
// Mocking policy (sets §6.2): the DB client factory is the one sanctioned
// internal mock; astro:env/server is mocked as a framework config edge (getViteConfig
// inlines real .env at config-load time, so it cannot be stubbed at runtime).

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_MODEL: "test/model",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-supabase-key",
}));

type CreateClient = typeof import("@/lib/supabase").createClient;
type SupabaseClientType = NonNullable<ReturnType<CreateClient>>;

/**
 * A universal recording client: every builder method is chainable and the chain
 * is awaitable (resolves to an empty, error-free result), so any route's query
 * shape — insert/update/delete/select/single/overrideTypes/eq/rpc — resolves
 * without a real DB. `calls` counts the four mutating entry points so a locked
 * route can be proven to have written nothing.
 */
function recordingClient() {
  const calls = { insert: 0, update: 0, delete: 0, rpc: 0 };

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.overrideTypes = vi.fn(() => chain);
    chain.then = (onFulfilled: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [] as unknown[], error: null }).then(onFulfilled);
    return chain;
  }

  const table = {
    insert: vi.fn(() => {
      calls.insert++;
      return makeChain();
    }),
    update: vi.fn(() => {
      calls.update++;
      return makeChain();
    }),
    delete: vi.fn(() => {
      calls.delete++;
      return makeChain();
    }),
    select: vi.fn(() => makeChain()),
  };

  const client = {
    from: vi.fn(() => table),
    rpc: vi.fn(() => {
      calls.rpc++;
      return makeChain();
    }),
  };

  return { client: client as unknown as SupabaseClientType, calls };
}

/** Build a hand-built Astro context with controllable read-only state. */
function ctx(opts: { body?: string; params?: Record<string, string>; isReadOnly: boolean }): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  const request = new Request("http://test/api/route", { method: "POST", headers, body: opts.body });
  const locals = { user: { id: "u1" }, isReadOnly: opts.isReadOnly, retentionUntil: null };
  // A minimal redirect stand-in: generations/discard redirects on its writable
  // path, the only mutating route with no post-guard validation to fail fast on.
  const redirect = (url: string): Response => new Response(null, { status: 302, headers: { Location: url } });
  return { request, locals, cookies: {}, params: opts.params ?? {}, redirect } as unknown as APIContext;
}

async function errorOf(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: string }).error;
}

afterEach(() => {
  vi.mocked(createClient).mockReset();
});

// Each writable body/params is chosen to fail a validation that sits AFTER the
// guard but BEFORE the mutation, so the positive control proves "past the guard"
// without performing (or needing a real) write. discard is the exception: it has
// no post-guard validation, so its writable path reaches the (faked) delete and
// redirects — still a clean !==403 signal.
const writeRoutes: { name: string; handler: APIRoute; body?: string; params?: Record<string, string> }[] = [
  { name: "cards POST", handler: cardsPost, body: "{}" },
  { name: "cards/[id] PATCH", handler: cardPatch, body: "{}", params: { id: "card-1" } },
  { name: "cards/[id] DELETE", handler: cardDelete },
  { name: "generations POST", handler: generationsPost, body: "{}" },
  { name: "generations/save POST", handler: savePost, body: JSON.stringify({ accept: 123 }) },
  { name: "generations/discard POST", handler: discardPost },
  { name: "reviews POST", handler: reviewsPost, body: "{}" },
];

describe("R4 retention write-lock — every write route is locked while read-only", () => {
  it.each(writeRoutes)(
    "$name returns 403 account_read_only with no mutation when read-only, and proceeds when writable",
    async ({ handler, body, params }) => {
      // Locked: the guard returns 403 before createClient is even called.
      const locked = recordingClient();
      vi.mocked(createClient).mockReturnValue(locked.client);
      const lockedRes = await handler(ctx({ body, params, isReadOnly: true }));
      expect(lockedRes.status).toBe(403);
      expect(await errorOf(lockedRes)).toBe("account_read_only");
      expect(locked.calls).toEqual({ insert: 0, update: 0, delete: 0, rpc: 0 });

      // Writable (positive control): the route gets past the guard.
      const open = recordingClient();
      vi.mocked(createClient).mockReturnValue(open.client);
      const openRes = await handler(ctx({ body, params, isReadOnly: false }));
      expect(openRes.status).not.toBe(403);
    },
  );
});

const exemptRoutes: { name: string; handler: APIRoute }[] = [
  { name: "account/cancel POST", handler: cancelPost },
  { name: "account/delete POST", handler: deletePost },
];

describe("R4 retention write-lock — lifecycle routes stay usable while read-only", () => {
  it.each(exemptRoutes)("$name is NOT blocked when read-only (escape hatch)", async ({ handler }) => {
    const fake = recordingClient();
    vi.mocked(createClient).mockReturnValue(fake.client);
    const res = await handler(ctx({ isReadOnly: true }));
    expect(res.status).not.toBe(403);
  });
});
