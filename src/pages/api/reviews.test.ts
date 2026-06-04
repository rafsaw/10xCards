import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";

// R5 validation parity for POST /api/reviews (hermetic). Proves the review write
// is server-authoritative: the update payload is computed purely from the Leitner
// scheduler and IGNORES any body-supplied user_id/status, the query is owner- and
// box-scoped, and invalid rating/currentBox/cardId are rejected. No real DB — the
// claim is about the payload + query the route HANDS to the client, observed via a
// recording factory mock (the §6.2 sanctioned internal exception).
//
// Oracle (research §R5; src/lib/leitner.ts box spec; BOX_INTERVALS_DAYS):
//   - the write carries only the four SR columns the scheduler produces
//     (repetition_count, interval_days, next_due_at, last_reviewed_at) — never an
//     ownership/status field lifted from the body;
//   - "right" promotes one box (box 0 -> box 1), and the new box's fixed interval
//     sets interval_days (box 1 = 2 days). These come from the Leitner domain rule,
//     not from reading reviews.ts, so the assertions cannot mirror a bug (check 4.3);
//   - cardId/rating/currentBox are validated before any write.

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_MODEL: "test/model",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-supabase-key",
}));

// Static imports: vi.mock is hoisted, so the route binds the mocked factory.
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/reviews";
import { BOX_INTERVALS_DAYS } from "@/lib/leitner";

type CreateClient = typeof import("@/lib/supabase").createClient;
type SupabaseClientType = NonNullable<ReturnType<CreateClient>>;

/**
 * A fake supabase client that records the update payload and the .eq() scoping
 * calls, resolving a fixed result through the route's
 * .update().eq().eq().eq().select().overrideTypes() chain.
 */
function fakeClient(result: { data?: unknown[]; error?: unknown }) {
  const recorded: { updateArg: unknown; eqCalls: [string, unknown][] } = { updateArg: undefined, eqCalls: [] };
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn((col: string, val: unknown) => {
    recorded.eqCalls.push([col, val]);
    return chain;
  });
  chain.select = vi.fn(() => chain);
  chain.overrideTypes = vi.fn(() => chain);
  chain.then = (onFulfilled: (v: { data: unknown[]; error: unknown }) => unknown) =>
    Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(onFulfilled);
  const update = vi.fn((arg: unknown) => {
    recorded.updateArg = arg;
    return chain;
  });
  const from = vi.fn(() => ({ update }));
  return { client: { from } as unknown as SupabaseClientType, recorded };
}

/** Build a hand-built Astro context; `locals` defaults to an authenticated, writable user. */
function ctx(opts: { body?: string; locals?: Partial<App.Locals> }): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  const request = new Request("http://test/api/reviews", { method: "POST", headers, body: opts.body });
  const locals = { user: { id: "u1" }, isReadOnly: false, retentionUntil: null, ...opts.locals };
  return { request, locals, cookies: {} } as unknown as APIContext;
}

async function errorOf(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: string }).error;
}

afterEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("POST /api/reviews — R5 server authority over the update payload", () => {
  it("ignores forged user_id/status and writes only the scheduler's SR columns, owner/box-scoped", async () => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const body = JSON.stringify({
      cardId: "card-1",
      rating: "right",
      currentBox: 0,
      user_id: "attacker",
      status: "accepted",
    });
    const res = await POST(ctx({ body }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.updateArg as Record<string, unknown>;
    // The write is exactly the four scheduler-produced SR columns — no body-supplied
    // ownership/status can ride along.
    expect(Object.keys(payload).sort()).toEqual([
      "interval_days",
      "last_reviewed_at",
      "next_due_at",
      "repetition_count",
    ]);
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("status");

    // Leitner oracle: "right" from box 0 promotes to box 1; box 1's fixed interval
    // (BOX_INTERVALS_DAYS[1]) sets interval_days.
    expect(payload.repetition_count).toBe(1);
    expect(payload.interval_days).toBe(BOX_INTERVALS_DAYS[1]);

    // The query is owner/box-scoped: id + status="saved" + the current box index.
    // Ownership itself is enforced by RLS (proven in the integration suite); here we
    // pin that the route does not widen the scope.
    expect(fc.recorded.eqCalls).toContainEqual(["id", "card-1"]);
    expect(fc.recorded.eqCalls).toContainEqual(["status", "saved"]);
    expect(fc.recorded.eqCalls).toContainEqual(["repetition_count", 0]);
  });

  it("resets to box 0 on a 'wrong' rating (Leitner reset rule)", async () => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ cardId: "card-1", rating: "wrong", currentBox: 3 }) }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.updateArg as Record<string, unknown>;
    expect(payload.repetition_count).toBe(0);
    expect(payload.interval_days).toBe(BOX_INTERVALS_DAYS[0]);
  });
});

describe("POST /api/reviews — invalid input is rejected", () => {
  // One row per distinct way the cardId/rating/currentBox contract can break; each
  // catches a different regression in the route's validation.
  const invalid: { name: string; body: unknown }[] = [
    { name: "missing cardId", body: { rating: "right", currentBox: 0 } },
    { name: "empty cardId", body: { cardId: "", rating: "right", currentBox: 0 } },
    { name: "rating outside the enum", body: { cardId: "card-1", rating: "maybe", currentBox: 0 } },
    { name: "missing rating", body: { cardId: "card-1", currentBox: 0 } },
    { name: "negative currentBox", body: { cardId: "card-1", rating: "right", currentBox: -1 } },
    { name: "non-integer currentBox", body: { cardId: "card-1", rating: "right", currentBox: 1.5 } },
    { name: "non-numeric currentBox", body: { cardId: "card-1", rating: "right", currentBox: "0" } },
  ];

  it.each(invalid)("rejects $name with 400 invalid_rating and never updates", async ({ body }) => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify(body) }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("invalid_rating");
    // Validation fails closed: no write is attempted on bad input.
    expect(fc.recorded.updateArg).toBeUndefined();
  });
});
