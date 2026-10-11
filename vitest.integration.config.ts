import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Opt-in real-DB integration suite. Runs ONLY `*.integration.test.ts` against
// the live Supabase project, so it is excluded from the default `npm test`
// (see vitest.config.ts) and invoked explicitly via `npm run test:integration`.
//
// Why a plain Vite config and NOT astro's getViteConfig (which `npm test` uses):
// getViteConfig loads the @astrojs/cloudflare adapter, which boots a workerd
// runner inside the vitest process. In sandboxes/CI that startup is slow and
// flaky ("Network connection lost", or a swallowed vite-node "deps_ssr/... not
// found" timeout on a cold cache) and vitest exits 1 with NO output right after
// `RUN`. These tests only exercise route handlers against Supabase over the
// network, so they need no Astro/Workers runtime — just the `@/` alias.
//
// Why loadEnv with an empty prefix: Vitest only autoloads VITE_-prefixed vars,
// but our Supabase secrets are unprefixed (SUPABASE_URL / SUPABASE_KEY /
// SUPABASE_SERVICE_ROLE_KEY). loadEnv(mode, cwd, "") reads ALL of `.env`; we
// expose them on `process.env` via `test.env`, where the two-user fixture and
// the integration setup read them. SUPABASE_SERVICE_ROLE_KEY is deliberately
// NOT declared in astro.config.mjs, so it never reaches app code
// (astro:env/server) — only this test process ever sees it.
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.integration.test.ts"],
    setupFiles: ["./test/setup.integration.ts"],
    env,
  },
});
