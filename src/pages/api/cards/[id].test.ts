import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";

// Hermetic coverage of the `tag` semantics on PATCH /api/cards/[id]:
// absent = unchanged, null/"" = clear, string = set (canonicalized).

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));
vi.mock("astro:env/server", () => ({
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-supabase-key",
}));

import { createClient } from "@/lib/supabase";
import { PATCH } from "@/pages/api/cards/[id]";

type SupabaseClientType = NonNullable<ReturnType<typeof import("@/lib/supabase").createClient>>;

function fakeClient(tags: string[] | { error: unknown } = []) {
  const recorded: { updateArg: unknown } = { updateArg: undefined };
  const chain: Record<string, unknown> = {};
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.overrideTypes = vi.fn(() => chain);
  chain.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data: [{ id: "c1" }], error: null }).then(onFulfilled);
  const update = vi.fn((arg: unknown) => {
    recorded.updateArg = arg;
    return chain;
  });
  const rpc = vi
    .fn()
    .mockResolvedValue(Array.isArray(tags) ? { data: tags, error: null } : { data: null, error: tags.error });
  return { client: { from: vi.fn(() => ({ update })), rpc } as unknown as SupabaseClientType, recorded, rpc };
}

function ctx(body: unknown): APIContext {
  const request = new Request("http://test/api/cards/c1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const locals = { user: { id: "u1" }, isReadOnly: false, retentionUntil: null };
  return { request, locals, cookies: {}, params: { id: "c1" } } as unknown as APIContext;
}

afterEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("PATCH /api/cards/[id] — lesson tag", () => {
  it("leaves tag out of the update when absent (existing clients keep working)", async () => {
    const fc = fakeClient();
    vi.mocked(createClient).mockReturnValue(fc.client);
    const res = await PATCH(ctx({ front: "Q", back: "A" }));
    expect(res.status).toBe(200);
    expect(fc.recorded.updateArg).toEqual({ front: "Q", back: "A" });
    expect(fc.rpc).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])("clears the tag for %j", async (blank) => {
    const fc = fakeClient();
    vi.mocked(createClient).mockReturnValue(fc.client);
    const res = await PATCH(ctx({ front: "Q", back: "A", tag: blank }));
    expect(res.status).toBe(200);
    expect(fc.recorded.updateArg).toEqual({ front: "Q", back: "A", tag: null });
    expect(fc.rpc).not.toHaveBeenCalled();
  });

  it("sets a canonicalized tag", async () => {
    const fc = fakeClient(["Lesson 5"]);
    vi.mocked(createClient).mockReturnValue(fc.client);
    await PATCH(ctx({ front: "Q", back: "A", tag: "lesson 5 " }));
    expect(fc.recorded.updateArg).toEqual({ front: "Q", back: "A", tag: "Lesson 5" });
  });

  it("rejects a 41-character tag with 400 invalid_tag and never updates", async () => {
    const fc = fakeClient();
    vi.mocked(createClient).mockReturnValue(fc.client);
    const res = await PATCH(ctx({ front: "Q", back: "A", tag: "t".repeat(41) }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_tag");
    expect(fc.recorded.updateArg).toBeUndefined();
  });

  it("fails closed with 500 db_error when the RPC errors", async () => {
    const fc = fakeClient({ error: { message: "boom" } });
    vi.mocked(createClient).mockReturnValue(fc.client);
    const res = await PATCH(ctx({ front: "Q", back: "A", tag: "x" }));
    expect(res.status).toBe(500);
    expect(fc.recorded.updateArg).toBeUndefined();
  });
});
