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
// Why currentBox:0 is the real signal: A's seeded card has status 'saved' and
// repetition_count 0, so the route's status/box guards would BOTH match it. RLS
// is therefore the only thing standing between B's write and A's row — drop the
// policy and this test mutates A (the manual signal check in the plan).

// A fresh client per call (the fixture's), used to snapshot the owner's row
// before/after the foreign write. Reads go through the same serialization both
// times, so equality is a true "unchanged" check independent of timestamp format.
type FixtureClient = ReturnType<TwoUserFixture["a"]["scopedClient"]>;

interface SrColumns {
  repetition_count: number;
  interval_days: number;
  next_due_at: string | null;
  last_reviewed_at: string | null;
}

async function readScheduleColumns(client: FixtureClient, cardId: string): Promise<SrColumns> {
  const { data, error } = await client
    .from("cards")
    .select("repetition_count, interval_days, next_due_at, last_reviewed_at")
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
    const res = await POST(reviewCtx({ id: fx.b.id }, { cardId: fx.a.seededCardId, rating: "right", currentBox: 0 }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as ReviewResponse).applied).toBe(false);

    // Decisive assertion: A's schedule columns are byte-for-byte unchanged.
    const after = await readScheduleColumns(fx.a.scopedClient(), fx.a.seededCardId);
    expect(after).toEqual(before);
  });

  it("applies a review when B reviews B's own card (positive control)", async () => {
    setActingUser(fx.b.scopedClient());
    const res = await POST(reviewCtx({ id: fx.b.id }, { cardId: fx.b.seededCardId, rating: "right", currentBox: 0 }));

    expect(res.status).toBe(200);
    expect(((await res.json()) as ReviewResponse).applied).toBe(true);
  });
});
