import { describe, expect, it } from "vitest";
import { OpenRouterError } from "@/lib/openrouter";

// Sanity check that the runner executes and that the `@/*` alias resolves via
// getViteConfig(). Kept trivial — real coverage lands in Phases 2–3.
describe("runner smoke test", () => {
  it("executes the runner", () => {
    expect(true).toBe(true);
  });

  it("resolves the @/* alias", () => {
    const err = new OpenRouterError("openrouter_parse_error", "smoke");
    expect(err).toBeInstanceOf(OpenRouterError);
    expect(err.code).toBe("openrouter_parse_error");
  });
});
