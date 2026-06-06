import { describe, expect, it } from "vitest";
import { parseErrorBody } from "@/lib/parse-error";

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
