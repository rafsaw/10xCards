import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

// Integration coverage for POST /api/generations: the full request -> response ->
// side-effect contract. Drives the route's exported POST with a hand-built Astro
// context, the REAL parse boundary (@/lib/openrouter runs unmocked over a stubbed
// global `fetch`), and a mocked DB-client factory so we can observe the exact
// insert payload — which is the R5 server-authority claim.
//
// Mocking policy (sets §6.2):
//   - OpenRouter edge   -> vi.stubGlobal('fetch', …)              (external HTTP edge)
//   - DB write          -> vi.mock('@/lib/supabase')             (one sanctioned internal
//                                                                  exception: the client factory)
//   - astro:env/server  -> vi.mock(…)                            (framework config edge; see note)
//
// astro:env note: getViteConfig() inlines the real `.env` into astro:env/server at
// config-load time, so `vi.stubEnv` / process.env do NOT control these values
// (probed 2026-06-03). We mock the virtual module with deterministic values and flip
// OPENROUTER_API_KEY per-test to exercise the 503 unconfigured path. SUPABASE_* are
// present for completeness but never read here — @/lib/supabase is fully mocked.

const envState = {
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_MODEL: "test/model",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_KEY: "test-supabase-key",
};

vi.mock("astro:env/server", () => ({
  get OPENROUTER_API_KEY() {
    return envState.OPENROUTER_API_KEY;
  },
  get OPENROUTER_MODEL() {
    return envState.OPENROUTER_MODEL;
  },
  get SUPABASE_URL() {
    return envState.SUPABASE_URL;
  },
  get SUPABASE_KEY() {
    return envState.SUPABASE_KEY;
  },
}));

vi.mock("@/lib/supabase", () => ({ createClient: vi.fn() }));

type CreateClient = typeof import("@/lib/supabase").createClient;
type SupabaseClientType = NonNullable<ReturnType<CreateClient>>;

const VALID_SOURCE = "a".repeat(300);

/**
 * Re-import the route (and the mocked factory) fresh so the endpoint's top-level
 * `astro:env/server` bindings reflect the current `envState`, and so each test gets
 * a clean `createClient` mock. The astro:env / supabase mocks persist across
 * resetModules; the test-file `envState` closure is never reset.
 */
async function loadRoute() {
  vi.resetModules();
  const supa = await import("@/lib/supabase");
  const route = await import("@/pages/api/generations");
  return { POST: route.POST, createClient: vi.mocked(supa.createClient) };
}

/** A fake supabase client that records the insert payload and resolves a fixed result. */
function fakeClient(result: { data?: unknown; error?: unknown }) {
  const recorded: { insertArg: unknown } = { insertArg: undefined };
  const select = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const insert = vi.fn((arg: unknown) => {
    recorded.insertArg = arg;
    return { select };
  });
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as unknown as SupabaseClientType, recorded };
}

/** Build a hand-built Astro context. `locals` defaults to an authenticated, writable user. */
function ctx(opts: { body?: string; locals?: Partial<App.Locals>; contentType?: string | null }): APIContext {
  const headers = new Headers();
  if (opts.contentType !== null) headers.set("Content-Type", opts.contentType ?? "application/json");
  const request = new Request("http://test/api/generations", { method: "POST", headers, body: opts.body });
  const locals = { user: { id: "u1" }, isReadOnly: false, retentionUntil: null, ...opts.locals };
  return { request, locals, cookies: {} } as unknown as APIContext;
}

/** A 200 OpenRouter envelope carrying `content` as the model message string. */
function modelEnvelope(content: string): Partial<Response> {
  const body = { choices: [{ message: { content } }] };
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** A 200 OpenRouter envelope whose model content is `{ cards }`. */
function cardsEnvelope(cards: { front: string; back: string }[]): Partial<Response> {
  return modelEnvelope(JSON.stringify({ cards }));
}

function providerResolves(value: Partial<Response>): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(value));
}

function providerRejects(err: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(err));
}

interface ErrorBody {
  error?: string;
  message?: string;
  detail?: string;
  drafts?: unknown;
}

async function readJson(res: Response): Promise<ErrorBody> {
  return (await res.json()) as ErrorBody;
}

beforeEach(() => {
  // setup.ts's afterEach already unstubs globals and restores mocks; reset env to the
  // configured defaults so a per-test flip (e.g. empty OPENROUTER_API_KEY) doesn't leak.
  envState.OPENROUTER_API_KEY = "test-openrouter-key";
  envState.OPENROUTER_MODEL = "test/model";
  envState.SUPABASE_URL = "https://test.supabase.co";
  envState.SUPABASE_KEY = "test-supabase-key";
});

describe("POST /api/generations — auth, read-only, and config gates", () => {
  it("returns 401 unauthorized when there is no locals.user", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ctx({ locals: { user: null }, body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe("unauthorized");
  });

  it("returns 403 account_read_only when locals.isReadOnly is true", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ctx({ locals: { isReadOnly: true }, body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe("account_read_only");
  });

  it("returns 503 ai_unconfigured when the OpenRouter env vars are unset", async () => {
    envState.OPENROUTER_API_KEY = "";
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe("ai_unconfigured");
  });
});

describe("POST /api/generations — request body and source validation", () => {
  it("returns 400 bad_request when the body is not JSON", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: "this is not json{" }));
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe("bad_request");
  });

  it("returns 400 invalid_source when the trimmed source is shorter than 200 chars", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: "a".repeat(50) }) }));
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe("invalid_source");
  });

  it("returns 400 invalid_source when the trimmed source exceeds 8000 chars", async () => {
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: "a".repeat(9000) }) }));
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe("invalid_source");
  });

  // Trim-authority (R5): bounds are enforced on the TRIMMED value, not the raw body.
  it("rejects a source that is >=200 untrimmed but <200 after trim (trim authority)", async () => {
    const source = " ".repeat(160) + "a".repeat(50) + " ".repeat(160); // 370 raw, 50 trimmed
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source }) }));
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe("invalid_source");
  });

  it("accepts a source that is >8000 untrimmed but <=8000 after trim (trim authority)", async () => {
    const source = " ".repeat(9000) + "a".repeat(500) + " ".repeat(9000); // 18500 raw, 500 trimmed
    providerResolves(cardsEnvelope([{ front: "Q1", back: "A1" }]));
    const { POST, createClient } = await loadRoute();
    createClient.mockReturnValue(fakeClient({ data: [{ id: 1, front: "Q1", back: "A1" }] }).client);
    const res = await POST(ctx({ body: JSON.stringify({ source }) }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/generations — provider error -> HTTP mapping (R1)", () => {
  it("maps a provider timeout (AbortError) to 504 ai_timeout", async () => {
    providerRejects(new DOMException("aborted", "AbortError"));
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(504);
    expect((await readJson(res)).error).toBe("ai_timeout");
  });

  it("maps a provider parse error (non-JSON model content) to 502 ai_parse_error", async () => {
    providerResolves(modelEnvelope("this is not json"));
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(502);
    expect((await readJson(res)).error).toBe("ai_parse_error");
  });

  it("maps any other OpenRouterError (non-200 upstream) to 502 ai_provider_error", async () => {
    providerResolves({ ok: false, status: 429, text: () => Promise.resolve("rate limited") });
    const { POST } = await loadRoute();
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(502);
    expect((await readJson(res)).error).toBe("ai_provider_error");
  });
});

describe("POST /api/generations — DB factory and persistence", () => {
  it("returns 503 supabase_unconfigured when the client factory returns null", async () => {
    providerResolves(cardsEnvelope([{ front: "Q1", back: "A1" }]));
    const { POST, createClient } = await loadRoute();
    createClient.mockReturnValue(null);
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe("supabase_unconfigured");
  });

  it("returns 500 db_error when the insert resolves an error", async () => {
    providerResolves(cardsEnvelope([{ front: "Q1", back: "A1" }]));
    const { POST, createClient } = await loadRoute();
    createClient.mockReturnValue(fakeClient({ error: { message: "insert failed" } }).client);
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(500);
    expect((await readJson(res)).error).toBe("db_error");
  });

  it("returns 200 { drafts } on the happy path", async () => {
    const drafts = [{ id: 1, front: "Q1", back: "A1", created_at: "2026-06-03" }];
    providerResolves(cardsEnvelope([{ front: "Q1", back: "A1" }]));
    const { POST, createClient } = await loadRoute();
    createClient.mockReturnValue(fakeClient({ data: drafts }).client);
    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(200);
    expect((await readJson(res)).drafts).toEqual(drafts);
  });
});

describe("POST /api/generations — R5 server authority over the insert payload", () => {
  it("ignores forged user_id/status/id/created_at and writes only server-authored fields", async () => {
    providerResolves(cardsEnvelope([{ front: "Q1", back: "A1" }]));
    const { POST, createClient } = await loadRoute();
    const fc = fakeClient({ data: [{ id: 1, front: "Q1", back: "A1" }] });
    createClient.mockReturnValue(fc.client);

    const body = JSON.stringify({
      source: VALID_SOURCE,
      user_id: "attacker",
      status: "accepted",
      id: 999,
      created_at: "1999-01-01",
    });
    const res = await POST(ctx({ body }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.insertArg as Record<string, unknown>[];
    expect(payload).toHaveLength(1);
    // Server authority: user_id is locals.user.id, status is hardcoded "draft",
    // and the forged id/created_at never reach the write.
    expect(payload[0].user_id).toBe("u1");
    expect(payload[0].status).toBe("draft");
    expect(payload[0]).not.toHaveProperty("id");
    expect(payload[0]).not.toHaveProperty("created_at");
    expect(Object.keys(payload[0]).sort()).toEqual(["back", "front", "status", "user_id"]);
  });

  it("writes the trimmed candidate front/back from the provider, not raw values", async () => {
    providerResolves(cardsEnvelope([{ front: "  Q1  ", back: "\n A1 \t" }]));
    const { POST, createClient } = await loadRoute();
    const fc = fakeClient({ data: [{ id: 1, front: "Q1", back: "A1" }] });
    createClient.mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.insertArg as Record<string, unknown>[];
    expect(payload[0].front).toBe("Q1");
    expect(payload[0].back).toBe("A1");
  });
});

describe("POST /api/generations — R1 persistence-gap characterisation", () => {
  // TODO(R1): documents the current behavior that invalid-but-typed candidates persist
  // as drafts BEFORE any review. Tied to the Phase 2 gap markers in openrouter.test.ts:
  // extractCards enforces neither a count floor nor the front<=500 / back<=2000 ceilings,
  // so a single over-length card flows straight into a 200 + insert. Characterisation
  // only (no behavior change); when the validator is tightened these become a 502/400.
  it("persists a single over-length typed card (no ceiling enforced today)", async () => {
    const overLong = { front: "x".repeat(600), back: "y".repeat(3000) };
    providerResolves(cardsEnvelope([overLong]));
    const { POST, createClient } = await loadRoute();
    const fc = fakeClient({ data: [{ id: 1, front: overLong.front, back: overLong.back }] });
    createClient.mockReturnValue(fc.client);

    const res = await POST(ctx({ body: JSON.stringify({ source: VALID_SOURCE }) }));
    expect(res.status).toBe(200);

    const payload = fc.recorded.insertArg as Record<string, unknown>[];
    expect(payload).toHaveLength(1);
    expect((payload[0].front as string).length).toBe(600);
  });
});
