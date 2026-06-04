import type { APIContext } from "astro";
import { afterEach, describe, expect, it, vi } from "vitest";

// R5 validation parity for POST /api/cards (hermetic). Proves the manual
// card-create endpoint is server-authoritative: it derives user_id and status
// itself and IGNORES any client-supplied user_id/status/id/created_at, and it
// rejects empty/whitespace front/back. No real DB — the claim is about the
// payload the route HANDS to the insert, observed via a recording factory mock
// (the §6.2 sanctioned internal exception).
//
// Oracle (research §R5; prd.md:82,84,110 FR-009/US-03; :145,165 isolation NFR):
//   - front/back are required, non-empty (validation prevents empty saves);
//   - insert is built field-by-field {user_id: locals.user.id, front, back,
//     status:"saved", next_due_at:now()} — forged ownership/status/id/created_at
//     never reach the write.
// These values come from the PRD/domain rule, not from reading cards.ts, so the
// assertions cannot mirror an implementation bug (manual check 4.3).

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_MODEL: "test/model",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-supabase-key",
}));

// Static imports: vi.mock is hoisted, so the route binds the mocked factory.
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/cards";

type CreateClient = typeof import("@/lib/supabase").createClient;
type SupabaseClientType = NonNullable<ReturnType<CreateClient>>;

/**
 * A fake supabase client that records the single insert payload and resolves a
 * fixed result through the route's .insert().select().single().overrideTypes()
 * chain. The chain is awaitable (thenable) and every builder returns itself.
 */
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const recorded: { insertArg: unknown } = { insertArg: undefined };
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.overrideTypes = vi.fn(() => chain);
  chain.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(onFulfilled);
  const insert = vi.fn((arg: unknown) => {
    recorded.insertArg = arg;
    return chain;
  });
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClientType, recorded };
}

/** Build a hand-built Astro context; `locals` defaults to an authenticated, writable user. */
function ctx(opts: { body?: string; locals?: Partial<App.Locals> }): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  const request = new Request("http://test/api/cards", { method: "POST", headers, body: opts.body });
  const locals = { user: { id: "u1" }, isReadOnly: false, retentionUntil: null, ...opts.locals };
  return { request, locals, cookies: {} } as unknown as APIContext;
}

async function errorOf(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: string }).error;
}

afterEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("POST /api/cards — R5 server authority over the insert payload", () => {
  it("ignores forged user_id/status/id/created_at and writes only server-authored fields", async () => {
    const fc = fakeClient({ data: { id: "card-1", front: "Q1", back: "A1" } });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const body = JSON.stringify({
      front: "Q1",
      back: "A1",
      user_id: "attacker",
      status: "accepted",
      id: "forged-id",
      created_at: "1999-01-01",
    });
    const res = await POST(ctx({ body }));
    expect(res.status).toBe(201);

    const payload = fc.recorded.insertArg as Record<string, unknown>;
    // Server authority: user_id is locals.user.id and status is the hardcoded
    // "saved" literal, regardless of what the body claimed.
    expect(payload.user_id).toBe("u1");
    expect(payload.status).toBe("saved");
    // Forged client-controlled columns never reach the write.
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("created_at");
    // The payload is exactly the server-built field set (next_due_at is the
    // server-stamped enrolment time, so it is present and a string).
    expect(Object.keys(payload).sort()).toEqual(["back", "front", "next_due_at", "status", "user_id"]);
    expect(typeof payload.next_due_at).toBe("string");
  });

  it("writes the trimmed front/back, not the raw body values (trim authority)", async () => {
    const fc = fakeClient({ data: { id: "card-1", front: "Q1", back: "A1" } });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ front: "  Q1  ", back: "\n A1 \t" }) }));
    expect(res.status).toBe(201);

    const payload = fc.recorded.insertArg as Record<string, unknown>;
    expect(payload.front).toBe("Q1");
    expect(payload.back).toBe("A1");
  });
});

describe("POST /api/cards — empty/invalid input is rejected (FR-009)", () => {
  // One row per distinct way front/back can fail the non-empty requirement; each
  // catches a different regression in asNonEmptyString's guard.
  const invalid: { name: string; body: unknown }[] = [
    { name: "empty front", body: { front: "", back: "A1" } },
    { name: "empty back", body: { front: "Q1", back: "" } },
    { name: "whitespace-only front", body: { front: "   ", back: "A1" } },
    { name: "whitespace-only back", body: { front: "Q1", back: "\t\n " } },
    { name: "missing front", body: { back: "A1" } },
    { name: "missing back", body: { front: "Q1" } },
    { name: "non-string front", body: { front: 42, back: "A1" } },
  ];

  it.each(invalid)("rejects $name with 400 invalid_card and never inserts", async ({ body }) => {
    const fc = fakeClient({ data: { id: "card-1", front: "Q1", back: "A1" } });
    vi.mocked(createClient).mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify(body) }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("invalid_card");
    // Validation fails closed: no write is attempted on bad input.
    expect(fc.recorded.insertArg).toBeUndefined();
  });
});
