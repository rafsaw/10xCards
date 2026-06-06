import { describe, expect, it, vi } from "vitest";
import { parseErrorBody } from "@/lib/parse-error";
import { reportError } from "@/lib/observability";

// The seam is mocked so we assert the *contract* (it gets called with the
// swallowed exception), not its dev/no-op transport. The factory also lets this
// suite reference `@/lib/observability` before the module exists (Phase B GREEN
// creates it).
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));

// Characterization coverage for the shared error-body parser (Phase A). We stub
// ONLY the parts of `Response` the parser touches (`json`), via a `Partial<Response>`
// cast — mirroring the fetch-stub harness in `openrouter.test.ts`.
//
// Oracle discipline: every fixture is hand-authored with a known shape, and every
// expected value is written out by hand here — never lifted from parseErrorBody.
//
// The generic default below is the literal the parser falls back to when no usable
// `message` field is present. It is hand-asserted, not derived.
const GENERIC = "Something went wrong. Please try again.";

/** A response whose `.json()` resolves to the given (hand-authored) body. */
function jsonBody(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as unknown as Response;
}

describe("parseErrorBody — pins the already-correct paths", () => {
  it("returns code and message from a full valid error body", async () => {
    const result = await parseErrorBody(jsonBody({ error: "db_error", message: "Could not save the change." }));
    expect(result).toEqual({ code: "db_error", message: "Could not save the change." });
  });

  it("falls back to the generic message when `message` is absent", async () => {
    const result = await parseErrorBody(jsonBody({ error: "not_found" }));
    expect(result).toEqual({ code: "not_found", message: GENERIC });
  });

  it("falls back to code `unknown` when `error` is absent", async () => {
    const result = await parseErrorBody(jsonBody({ message: "Boom" }));
    expect(result).toEqual({ code: "unknown", message: "Boom" });
  });

  it("ignores non-string `error` / `message` fields and uses both fallbacks", async () => {
    const result = await parseErrorBody(jsonBody({ error: 42, message: false }));
    expect(result).toEqual({ code: "unknown", message: GENERIC });
  });

  it("treats an empty-string `message` as absent (keeps the generic) while honoring code", async () => {
    const result = await parseErrorBody(jsonBody({ error: "bad_request", message: "" }));
    expect(result).toEqual({ code: "bad_request", message: GENERIC });
  });

  it("uses both fallbacks when the body is not an object", async () => {
    const result = await parseErrorBody(jsonBody("just a string"));
    expect(result).toEqual({ code: "unknown", message: GENERIC });
  });
});

describe("parseErrorBody — reports the swallowed exception (Phase B regression guard)", () => {
  // A response whose `.json()` rejects = the non-JSON error body that the old bare
  // `catch {}` discarded silently. The fix must surface that throw through the seam
  // while keeping the user-facing fallback intact.
  function rejectingBody(err: Error): Response {
    return { json: () => Promise.reject(err) } as unknown as Response;
  }

  it("calls reportError with the thrown error and context, but still returns the generic fallback", async () => {
    const parseFailure = new SyntaxError("Unexpected token < in JSON");
    const result = await parseErrorBody(rejectingBody(parseFailure));

    // User-facing behavior is unchanged: the generic fallback is still returned.
    expect(result).toEqual({ code: "unknown", message: GENERIC });

    // But the previously-swallowed exception is now observable through the seam.
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(parseFailure, { where: "parseErrorBody" });
  });
});
