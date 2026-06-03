import { describe, expect, it, vi } from "vitest";
import { generateCandidateCards, OpenRouterError } from "@/lib/openrouter";

// Unit coverage for the R1 parse/validate boundary. We stub ONLY global `fetch`
// (the external HTTP edge); `generateCandidateCards` takes apiKey/model as args,
// so no astro:env or module mocking is needed here.
//
// Oracle discipline: every fixture below is hand-authored with a known-bad or
// known-good shape. No expected value is ever lifted from extractCards itself.

const SOURCE = "Some passage of source text to summarise into flashcards.";
const OPTS = { apiKey: "test-key", model: "test/model" };

/** Build a fake `fetch` that resolves to the given (partial) Response. */
function stubFetchResolving(response: Partial<Response>): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

/** A 200 response whose JSON envelope is the given value. */
function jsonEnvelope(value: unknown): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve(JSON.stringify(value)),
  };
}

/** A 200 response carrying `content` as the model message string. */
function modelContent(content: string): Partial<Response> {
  return jsonEnvelope({ choices: [{ message: { content } }] });
}

/** Await a call expected to reject with an OpenRouterError; return it. */
async function expectOpenRouterError(promise: Promise<unknown>): Promise<OpenRouterError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(OpenRouterError);
    return err as OpenRouterError;
  }
  throw new Error("expected generateCandidateCards to reject, but it resolved");
}

describe("generateCandidateCards — typed-error contract", () => {
  it("maps a network throw to openrouter_http_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unreachable")));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_http_error");
  });

  it("maps an AbortError (timeout) to openrouter_timeout", async () => {
    // The timeout branch keys on `err instanceof DOMException && err.name === "AbortError"`,
    // so a plain Error would fall through to openrouter_http_error. Node 22 has DOMException.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_timeout");
  });

  it("maps a non-200 response to openrouter_http_error and truncates detail to 500 chars", async () => {
    const longBody = "x".repeat(600);
    stubFetchResolving({ ok: false, status: 429, text: () => Promise.resolve(longBody) });
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_http_error");
    expect(err.detail).toHaveLength(500);
  });

  it("maps a non-JSON HTTP envelope to openrouter_parse_error", async () => {
    stubFetchResolving({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("not json")),
    });
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });

  it("maps a missing choices[0].message.content string to openrouter_parse_error", async () => {
    stubFetchResolving(jsonEnvelope({ choices: [{ message: { content: 42 } }] }));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });

  it("maps an empty choices array to openrouter_parse_error", async () => {
    stubFetchResolving(jsonEnvelope({ choices: [] }));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });

  it("maps non-JSON model content to openrouter_parse_error", async () => {
    stubFetchResolving(modelContent("this is not json"));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });

  it("maps an empty card list to openrouter_parse_error", async () => {
    stubFetchResolving(modelContent(JSON.stringify({ cards: [] })));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });

  it("maps an all-invalid card list to openrouter_parse_error", async () => {
    const content = JSON.stringify({
      cards: [{ front: "", back: "" }, { front: 7, back: "ok" }, { back: "no front" }],
    });
    stubFetchResolving(modelContent(content));
    const err = await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    expect(err.code).toBe("openrouter_parse_error");
  });
});

describe("generateCandidateCards — happy path", () => {
  it("returns 3 trimmed cards from a well-formed 3-card response", async () => {
    const content = JSON.stringify({
      cards: [
        { front: "  Q1  ", back: "  A1  " },
        { front: "Q2", back: "A2" },
        { front: "Q3", back: "A3" },
      ],
    });
    stubFetchResolving(modelContent(content));
    const cards = await generateCandidateCards(SOURCE, OPTS);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toEqual({ front: "Q1", back: "A1" });
  });

  it("slices a response of more than 10 cards down to 10", async () => {
    const content = JSON.stringify({
      cards: Array.from({ length: 12 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` })),
    });
    stubFetchResolving(modelContent(content));
    const cards = await generateCandidateCards(SOURCE, OPTS);
    expect(cards).toHaveLength(10);
  });
});

describe("extractCards characterisation — pins CURRENT behavior (no floor, silent drop, trim)", () => {
  it("accepts a single valid card (no count floor enforced today)", async () => {
    stubFetchResolving(modelContent(JSON.stringify({ cards: [{ front: "Q", back: "A" }] })));
    const cards = await generateCandidateCards(SOURCE, OPTS);
    expect(cards).toHaveLength(1);
  });

  it("silently drops malformed items and returns only the valid ones", async () => {
    const content = JSON.stringify({
      cards: [
        { front: "Good1", back: "Ans1" },
        { front: 123, back: "wrong type" }, // dropped
        { front: "   ", back: "blank front" }, // dropped (empty after trim)
        { front: "Good2", back: "Ans2" },
      ],
    });
    stubFetchResolving(modelContent(content));
    const cards = await generateCandidateCards(SOURCE, OPTS);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.front)).toEqual(["Good1", "Good2"]);
  });

  it("trims leading/trailing whitespace on front and back", async () => {
    const content = JSON.stringify({ cards: [{ front: "\n  trimmed front \t", back: "  trimmed back  " }] });
    stubFetchResolving(modelContent(content));
    const cards = await generateCandidateCards(SOURCE, OPTS);
    expect(cards[0]).toEqual({ front: "trimmed front", back: "trimmed back" });
  });
});

describe("extractCards gap markers — RED, document known validator weaknesses", () => {
  // These tests assert the DESIRED (stricter) behavior the requested schema implies.
  // They currently fail because extractCards does not enforce it; `it.fails` marks
  // them expected-fail so the suite stays green AND the gap stays visible. When the
  // validator is tightened (see "tighten later" decision in plan.md §"What We're NOT
  // Doing"), each of these will start passing — flipping `it.fails` to a real failure
  // that signals "remove the marker, the gap is closed".

  it.fails(
    "TODO(R1): should reject a single-card response against the 3-card prompt floor (currently passes — tighten later)",
    async () => {
      stubFetchResolving(modelContent(JSON.stringify({ cards: [{ front: "Q1", back: "A1" }] })));
      // Desired: a sub-floor (1 < 3) response is rejected. Today extractCards has no count floor.
      await expectOpenRouterError(generateCandidateCards(SOURCE, OPTS));
    },
  );

  it.fails(
    "TODO(R1): should reject cards exceeding front<=500 / back<=2000 ceilings (currently passes — tighten later)",
    async () => {
      const content = JSON.stringify({
        cards: [
          { front: "x".repeat(600), back: "y".repeat(3000) },
          { front: "Q2", back: "A2" },
          { front: "Q3", back: "A3" },
        ],
      });
      stubFetchResolving(modelContent(content));
      // Desired: over-length cards are dropped/rejected against the requested schema ceiling.
      // Today they are returned verbatim, so this expectation fails.
      const cards = await generateCandidateCards(SOURCE, OPTS);
      expect(cards.every((c) => c.front.length <= 500 && c.back.length <= 2000)).toBe(true);
    },
  );
});
