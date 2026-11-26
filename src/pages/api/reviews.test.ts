import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";

// R5 validation parity for POST /api/reviews (hermetic). Proves the review write
// is server-authoritative: the update payload is computed purely from the SM-2
// scheduler and IGNORES any body-supplied user_id/status, the query is owner- and
// state-scoped, and an invalid rating or echoed state is rejected. No real DB —
// the claim is about the payload + query the route HANDS to the client, observed
// via a recording factory mock (the §6.2 sanctioned internal exception).
//
// Oracle (ADR 0002; the published SM-2 algorithm, Woźniak 1990):
//   - the write carries only the five scheduler columns the scheduler produces
//     (repetition, efactor, interval_days, next_due_at, last_reviewed_at) —
//     never an ownership/status field lifted from the body;
//   - from the mature state (repetition 2, EF 2.50, interval 6 d): a pass advances
//     the repetition to 3 and stretches the interval by the EF the Card arrived
//     with (6 x 2.50 = 15 d), while the rating moves the EF itself by -0.14 (hard),
//     0 (good) or +0.10 (easy); Again goes back to repetition 0 and 1 day with the
//     EF untouched. These come from the algorithm as restated in ADR 0002, not from
//     reading reviews.ts or sm2.ts, so the assertions cannot mirror a bug (check 4.3);
//   - the arithmetic itself is pinned in src/lib/sm2.test.ts; the cases here are
//     one per rating branch, for the wiring;
//   - cardId/rating/the three echoed state fields are validated before any write.

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

type CreateClient = typeof import("@/lib/supabase").createClient;
type SupabaseClientType = NonNullable<ReturnType<CreateClient>>;

/**
 * A fake supabase client that records the update payload and the .eq() scoping
 * calls, resolving a fixed result through the route's
 * .update().eq()...eq().select().overrideTypes() chain.
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

/** The mature Card every branch case below rates: repetition 2, EF 2.50, interval 6 d. */
const MATURE = { currentRepetition: 2, currentEfactor: 2.5, currentIntervalDays: 6 };

afterEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("POST /api/reviews — R5 server authority over the update payload", () => {
  it("ignores forged user_id/status and writes only the scheduler's SR columns, owner/state-scoped", async () => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const body = JSON.stringify({
      cardId: "card-1",
      rating: "good",
      ...MATURE,
      user_id: "attacker",
      status: "accepted",
    });
    const res = await POST(ctx({ body }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.updateArg as Record<string, unknown>;
    // The write is exactly the five scheduler-produced SR columns — no body-supplied
    // ownership/status can ride along.
    expect(Object.keys(payload).sort()).toEqual([
      "efactor",
      "interval_days",
      "last_reviewed_at",
      "next_due_at",
      "repetition",
    ]);
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("status");

    // SM-2 oracle: Good is a pass, so the repetition advances to 3 and the stored
    // interval is stretched by the EF this rating produces (Good moves the EF by
    // 0, so 6 x 2.50 = 15 days).
    expect(payload.repetition).toBe(3);
    expect(payload.efactor).toBe(2.5);
    expect(payload.interval_days).toBe(15);

    // The query is owner/state-scoped: id + status="saved" + all three scheduler
    // columns, so a replay of the same rating matches no row. Ownership itself is
    // enforced by RLS (proven in the integration suite); here we pin that the
    // route does not widen the scope.
    expect(fc.recorded.eqCalls).toContainEqual(["id", "card-1"]);
    expect(fc.recorded.eqCalls).toContainEqual(["status", "saved"]);
    expect(fc.recorded.eqCalls).toContainEqual(["repetition", 2]);
    expect(fc.recorded.eqCalls).toContainEqual(["efactor", 2.5]);
    expect(fc.recorded.eqCalls).toContainEqual(["interval_days", 6]);
  });

  // One end-to-end case per rating branch, for the wiring: each rating reaches
  // sm2.ts and its distinct result reaches the update payload.
  const branches: { rating: string; repetition: number; efactor: number; interval_days: number }[] = [
    { rating: "again", repetition: 0, efactor: 2.5, interval_days: 1 },
    { rating: "hard", repetition: 3, efactor: 2.36, interval_days: 15 },
    { rating: "good", repetition: 3, efactor: 2.5, interval_days: 15 },
    { rating: "easy", repetition: 3, efactor: 2.6, interval_days: 16 },
  ];

  it.each(branches)("schedules a mature card on $rating", async ({ rating, ...expected }) => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ cardId: "card-1", rating, ...MATURE }) }));
    expect(res.status).toBe(200);

    expect(fc.recorded.updateArg).toMatchObject(expected);
  });

  it("accepts a never-reviewed card's zero interval and schedules it one day out", async () => {
    const fc = fakeClient({ data: [{ id: "card-1" }] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const body = JSON.stringify({
      cardId: "card-1",
      rating: "good",
      currentRepetition: 0,
      currentEfactor: 2.5,
      currentIntervalDays: 0,
    });
    const res = await POST(ctx({ body }));
    expect(res.status).toBe(200);

    // I(1) = 1 day: the fixed first interval, so a zero echo is legal input.
    expect(fc.recorded.updateArg).toMatchObject({ repetition: 1, interval_days: 1, efactor: 2.5 });
  });

  it("reports applied:false when the guarded update matches no row (a replay)", async () => {
    const fc = fakeClient({ data: [] });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ cardId: "card-1", rating: "good", ...MATURE }) }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { applied?: boolean }).applied).toBe(false);
  });
});

describe("POST /api/reviews — invalid input is rejected", () => {
  // One row per distinct way the cardId/rating/echoed-state contract can break;
  // each catches a different regression in the route's validation. Validation is
  // type plus lower bounds only — the fail-closed guard handles everything else.
  const invalid: { name: string; body: unknown }[] = [
    { name: "missing cardId", body: { rating: "good", ...MATURE } },
    { name: "empty cardId", body: { cardId: "", rating: "good", ...MATURE } },
    { name: "rating outside the enum", body: { cardId: "card-1", rating: "maybe", ...MATURE } },
    { name: "the retired 'right' rating", body: { cardId: "card-1", rating: "right", ...MATURE } },
    { name: "missing rating", body: { cardId: "card-1", ...MATURE } },
    {
      name: "missing currentRepetition",
      body: { cardId: "card-1", rating: "good", currentEfactor: 2.5, currentIntervalDays: 6 },
    },
    {
      name: "negative currentRepetition",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentRepetition: -1 },
    },
    {
      name: "non-integer currentRepetition",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentRepetition: 1.5 },
    },
    {
      name: "non-numeric currentRepetition",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentRepetition: "2" },
    },
    {
      name: "missing currentEfactor",
      body: { cardId: "card-1", rating: "good", currentRepetition: 2, currentIntervalDays: 6 },
    },
    {
      name: "currentEfactor below the 1.3 floor",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentEfactor: 1.29 },
    },
    {
      name: "non-numeric currentEfactor",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentEfactor: "2.5" },
    },
    { name: "null currentEfactor", body: { cardId: "card-1", rating: "good", ...MATURE, currentEfactor: null } },
    {
      name: "missing currentIntervalDays",
      body: { cardId: "card-1", rating: "good", currentRepetition: 2, currentEfactor: 2.5 },
    },
    {
      name: "negative currentIntervalDays",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentIntervalDays: -1 },
    },
    {
      name: "non-integer currentIntervalDays",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentIntervalDays: 6.5 },
    },
    {
      name: "non-numeric currentIntervalDays",
      body: { cardId: "card-1", rating: "good", ...MATURE, currentIntervalDays: "6" },
    },
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
