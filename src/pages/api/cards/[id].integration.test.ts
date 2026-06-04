import type { APIContext } from "astro";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTwoUsers, type TwoUserFixture } from "../../../../test/integration/two-user-fixture";
// Static import registers vi.mock("@/lib/supabase") so the route's createClient
// returns the acting user's REAL scoped client (real RLS runs). Must precede the
// route import below so the mock is in place before @/lib/supabase resolves.
import { setActingUser } from "../../../../test/integration/scoped-supabase-mock";
import { PATCH, DELETE } from "@/pages/api/cards/[id]";

// Phase-2 R2 isolation (real RLS): user B cannot edit or delete user A's card by
// passing A's id in the route param. cards/[id] scopes by id+status only and
// relies entirely on cards_update_own / cards_delete_own to confine the write to
// the owner; a foreign id matches 0 rows and the route maps that to 404
// not_found (reviews.ts denies via applied:false instead — different deny shape,
// same oracle). The load-bearing assertion is A's row left intact.
//
// Positive controls run last because they mutate then delete B's single seeded
// card; the foreign-id cases above touch nothing of B's.

type FixtureClient = ReturnType<TwoUserFixture["a"]["scopedClient"]>;

interface CardContent {
  front: string;
  back: string;
}

async function readContent(client: FixtureClient, cardId: string): Promise<CardContent> {
  const { data, error } = await client
    .from("cards")
    .select("front, back")
    .eq("id", cardId)
    .overrideTypes<CardContent[], { merge: false }>();
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  return data[0];
}

async function cardCount(client: FixtureClient, cardId: string): Promise<number> {
  const { data, error } = await client
    .from("cards")
    .select("id")
    .eq("id", cardId)
    .overrideTypes<{ id: string }[], { merge: false }>();
  expect(error).toBeNull();
  return data.length;
}

function cardCtx(user: { id: string }, id: string, body?: unknown): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  const request = new Request(`http://test/api/cards/${id}`, {
    method: "POST", // overridden by the handler under test; method is irrelevant to PATCH/DELETE exports
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const locals = { user, isReadOnly: false, retentionUntil: null };
  return { request, locals, cookies: {}, params: { id } } as unknown as APIContext;
}

interface CardResponse {
  error?: string;
  id?: string;
  ok?: boolean;
}

describe("PATCH/DELETE /api/cards/[id] — R2 cross-user isolation (real RLS)", () => {
  let fx: TwoUserFixture;

  beforeAll(async () => {
    fx = await setupTwoUsers();
  });

  afterAll(async () => {
    await fx.teardown();
  });

  it("denies B editing A's card via a foreign id (404, A's front/back unchanged)", async () => {
    const before = await readContent(fx.a.scopedClient(), fx.a.seededCardId);

    setActingUser(fx.b.scopedClient());
    const res = await PATCH(cardCtx({ id: fx.b.id }, fx.a.seededCardId, { front: "hacked", back: "hacked" }));

    expect(res.status).toBe(404);
    expect(((await res.json()) as CardResponse).error).toBe("not_found");

    const after = await readContent(fx.a.scopedClient(), fx.a.seededCardId);
    expect(after).toEqual(before);
  });

  it("denies B deleting A's card via a foreign id (404, A's row still present)", async () => {
    setActingUser(fx.b.scopedClient());
    const res = await DELETE(cardCtx({ id: fx.b.id }, fx.a.seededCardId));

    expect(res.status).toBe(404);
    expect(((await res.json()) as CardResponse).error).toBe("not_found");

    expect(await cardCount(fx.a.scopedClient(), fx.a.seededCardId)).toBe(1);
  });

  it("applies an edit when B edits B's own card (positive control)", async () => {
    setActingUser(fx.b.scopedClient());
    const res = await PATCH(
      cardCtx({ id: fx.b.id }, fx.b.seededCardId, { front: "edited-front", back: "edited-back" }),
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as CardResponse).id).toBe(fx.b.seededCardId);

    const after = await readContent(fx.b.scopedClient(), fx.b.seededCardId);
    expect(after).toEqual({ front: "edited-front", back: "edited-back" });
  });

  it("applies a delete when B deletes B's own card (positive control)", async () => {
    setActingUser(fx.b.scopedClient());
    const res = await DELETE(cardCtx({ id: fx.b.id }, fx.b.seededCardId));

    expect(res.status).toBe(200);
    expect(((await res.json()) as CardResponse).ok).toBe(true);

    expect(await cardCount(fx.b.scopedClient(), fx.b.seededCardId)).toBe(0);
  });
});
