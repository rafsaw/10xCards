import { afterEach, beforeAll, vi } from "vitest";

// Setup for the opt-in real-DB integration suite (`npm run test:integration`).
//
// Unlike test/setup.ts (which stubs DUMMY Supabase values for the hermetic
// default suite), this suite talks to the LIVE Supabase project. The real
// values arrive on `process.env` via vitest.integration.config.ts's
// `test.env = loadEnv(..., "")`. We fail fast here with an actionable message
// if any required secret is absent, so a contributor without `.env` sees
// "Integration tests require SUPABASE_SERVICE_ROLE_KEY ..." rather than an
// opaque auth error later in the harness.
//
// Source of the values: the git-ignored `.env` at the repo root. The app reads
// only the anon SUPABASE_KEY; SUPABASE_SERVICE_ROLE_KEY lives ONLY in this test
// process (it mints / tears down the two test users via the admin API).

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

beforeAll(() => {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Integration tests require ${missing.join(", ")} in .env (git-ignored). ` +
        `These hit the live Supabase project; SUPABASE_SERVICE_ROLE_KEY mints the two test users. ` +
        `Set them and re-run \`npm run test:integration\`, or run \`npm test\` for the hermetic suite.`,
    );
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
