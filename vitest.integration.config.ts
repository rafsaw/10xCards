/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";
import { loadEnv } from "vite";

// Opt-in real-DB integration suite. Runs ONLY `*.integration.test.ts` against
// the live Supabase project, so it is excluded from the default `npm test`
// (see vitest.config.ts) and invoked explicitly via `npm run test:integration`.
//
// Why loadEnv with an empty prefix: Vitest only autoloads VITE_-prefixed vars,
// but our Supabase secrets are unprefixed (SUPABASE_URL / SUPABASE_KEY /
// SUPABASE_SERVICE_ROLE_KEY). loadEnv(mode, cwd, "") reads ALL of `.env`; we
// expose them on `process.env` via `test.env`, where the two-user fixture and
// the integration setup read them. SUPABASE_SERVICE_ROLE_KEY is deliberately
// NOT declared in astro.config.mjs, so it never reaches app code
// (astro:env/server) — only this test process ever sees it.
const env = loadEnv("test", process.cwd(), "");

export default getViteConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.integration.test.ts"],
    setupFiles: ["./test/setup.integration.ts"],
    env,
  },
});
