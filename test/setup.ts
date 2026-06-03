import { afterEach, vi } from "vitest";

// The four server vars are marked `optional` in astro.config.mjs, so imports
// never throw when they are unset. We stub them to dummy values here so the
// "configured" code paths run by default. Tests that exercise the *unconfigured*
// path (e.g. the 503 branches) override these locally with vi.stubEnv(..., "").
vi.stubEnv("OPENROUTER_API_KEY", "test-openrouter-key");
vi.stubEnv("OPENROUTER_MODEL", "test/model");
vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("SUPABASE_KEY", "test-supabase-key");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
