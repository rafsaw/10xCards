import type { APIContext } from "astro";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTwoUsers, type TwoUserFixture } from "../../../test/integration/two-user-fixture";
// Static import registers vi.mock("@/lib/supabase") so the route's createClient
// returns the acting user's REAL scoped client (real RLS runs). Must precede the
// route import below so the mock is in place before @/lib/supabase resolves.
import { setActingUser } from "../../../test/integration/scoped-supabase-mock";
import { POST } from "./reviews";

// Phase-2 R2 isolation (real RLS): an authenticated user's review against ANOTHER
// user's card id must neither reschedule nor reveal that card — the owner's SR
// columns stay byte-for-byte unchanged. reviews.ts denies a foreign id via the
// "0 rows matched" branch -> { applied: false } (NOT a 404; see reviews.ts:80),
// because the cards_update_own policy scopes the UPDATE to auth.uid(). The
// load-bearing assertion is A's row unchanged, not the response shape.
//
// Why the echoed state below is the real signal: A's seeded card takes every
// scheduler column from its default — status 'saved', repetition 0, efactor 2.50,
// interval_days 0 — so the route's status guard and all three state guards would
// match it. RLS is therefore the only thing standing between B's write and A's
// row — drop the policy and this test mutates A (the manual signal check in the
// plan). efactor arrives from PostgREST as a JSON number for numeric(4,2), and
// Postgres compares numeric exactly, so 2.5 is the value that matches.
//
// Test order matters in one direction only: the third case below deliberately
// rewrites A's card to a non-default ease factor, so it runs after the isolation
// case that needs A's row pristine. Nothing reads A's row after it.

// A fresh client per call (the fixture's), used to snapshot the owner's row
// before/after the foreign write. Reads go through the same serialization both
// times, so equality is a true "unchanged" check independent of timestamp format.
type FixtureClient = ReturnType<TwoUserFixture["a"]["scopedClient"]>;

interface SrColumns {
  repetition: number;
  efactor: number;
  interval_days: number;
  next_due_at: string | null;
  last_reviewed_at: string | null;
}

async function readScheduleColumns(client: FixtureClient, cardId: string): Promise<SrColumns> {
  const { data, error } = await client
    .from("cards")
    .select("repetition, efactor, interval_days, next_due_at, last_reviewed_at")
    .eq("id", cardId)
    .overrideTypes<SrColumns[], { merge: false }>();
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  if (!data) throw new Error("expected one card row");
  return data[0];
}

function reviewCtx(user: { id: string }, body: unknown): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  const request = new Request("http://test/api/reviews", { method: "POST", headers, body: JSON.stringify(body) });
  const locals = { user, isReadOnly: false, retentionUntil: null };
  return { request, locals, cookies: {} } as unknown as APIContext;
}

/** The seeded card's scheduler state, every field straight from its column default. */
const SEEDED_STATE = { currentRepetition: 0, currentEfactor: 2.5, currentIntervalDays: 0 };

interface ReviewResponse {
  applied?: boolean;
}

describe("POST /api/reviews — R2 cross-user isolation (real RLS)", () => {
  let fx: TwoUserFixture;

  beforeAll(async () => {
    fx = await setupTwoUsers();
  });

  afterAll(async () => {
    await fx.teardown();
  });

  it("denies B rescheduling A's card via a foreign cardId (applied:false, A unchanged)", async () => {
    const before = await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId);

    setActingUser(fx.b.scopedClient());
    const res = await POST(reviewCtx({ id: fx.b.id }, { cardId: fx.a.seededCardId, rating: "good", ...SEEDED_STATE }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as ReviewResponse).applied).toBe(false);

    // Decisive assertion: A's schedule columns are byte-for-byte unchanged.
    const after = await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId);
    expect(after).toEqual(before);
  });

  it("applies a review when B reviews B's own card (positive control)", async () => {
    setActingUser(fx.b.scopedClient());
    const res = await POST(reviewCtx({ id: fx.b.id }, { cardId: fx.b.seededCardId, rating: "good", ...SEEDED_STATE }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as ReviewResponse).applied).toBe(true);
  });

  // The one fragile hinge in the write guard, and the only place a live database
  // can exercise it. reviews.ts guards the update with .eq("efactor", currentEfactor)
  // on a numeric(4,2) column, fed by a number the CLIENT echoed back and
  // re-serialised by JSON.stringify. Every other test in the repo — hermetic,
  // integration and E2E — only ever drives the column DEFAULT 2.50, where the
  // echo happens to be an integer-valued 2.5 and several wrong answers look
  // right. If PostgREST ever serialised numeric as a STRING, or the echo lost a
  // digit, the guard would match zero rows and every Review would come back
  // applied:false — which the client treats as success and advances past (spec
  // #76), so the whole schedule would silently stop moving. This case runs one
  // Review end to end at a two-decimal, non-default ease factor so that
  // round-trip is actually exercised.
  it("applies a review at a non-default two-decimal ease factor (numeric round-trip)", async () => {
    // Put A's own card into a mature, deliberately non-default state through A's
    // OWN scoped client, so RLS applies to the setup too and no new helper is
    // needed. 2.36 is the ease factor a single Hard produces from the 2.50
    // default, so it is a state a real Card reaches.
    const mature = { repetition: 2, efactor: 2.36, interval_days: 6 };
    const { error: seedError } = await fx.a
      .scopedClient()
      .from("cards")
      .update(mature)
      .eq("id", fx.a.seededCardId)
      .select("id")
      .overrideTypes<{ id: string }[], { merge: false }>();
    expect(seedError).toBeNull();

    // Half the hinge: what PostgREST hands back for numeric(4,2). The client
    // echoes exactly this value into the next POST, so if it is not a JSON
    // number equal to 2.36, the guard below cannot match.
    const before = await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId);
    expect(typeof before.efactor).toBe("number");
    expect(before.efactor).toBe(2.36);

    setActingUser(fx.a.scopedClient());
    const res = await POST(
      reviewCtx(
        { id: fx.a.id },
        {
          cardId: fx.a.seededCardId,
          rating: "good",
          currentRepetition: before.repetition,
          currentEfactor: before.efactor,
          currentIntervalDays: before.interval_days,
        },
      ),
    );

    expect(res.status).toBe(200);
    // The other half: the guard MATCHED on a non-integer numeric. applied:false
    // here is the silent failure this test exists to make loud.
    expect(((await res.json()) as ReviewResponse).applied).toBe(true);

    // The stored columns, worked out by hand from ADR 0002: Good leaves the ease
    // factor alone, the repetition advances to 3, and the interval is the stored
    // one stretched by that factor, rounded up — ceil(6 x 2.36) = ceil(14.16) = 15.
    const after = await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId);
    expect(after.repetition).toBe(3);
    expect(after.efactor).toBe(2.36);
    expect(after.interval_days).toBe(15);
    expect(after.last_reviewed_at).not.toBeNull();
    expect(after.next_due_at).not.toBeNull();
    // Due 15 days out, measured from the review that was just recorded, so the
    // written next_due_at agrees with the written interval (one day of slack for
    // clock skew between this process and the database).
    const reviewedAt = new Date(after.last_reviewed_at ?? "").getTime();
    const dueAt = new Date(after.next_due_at ?? "").getTime();
    expect(Math.round((dueAt - reviewedAt) / 86_400_000)).toBe(15);

    // A replay of the same POST carries the now-stale state, matches no row and
    // changes nothing: the non-default ease factor does not weaken idempotency.
    const replay = await POST(
      reviewCtx(
        { id: fx.a.id },
        {
          cardId: fx.a.seededCardId,
          rating: "good",
          currentRepetition: before.repetition,
          currentEfactor: before.efactor,
          currentIntervalDays: before.interval_days,
        },
      ),
    );
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as ReviewResponse).applied).toBe(false);
    expect(await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId)).toEqual(after);
  });
});
