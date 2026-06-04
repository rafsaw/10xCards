import { getViteConfig } from "astro/config";
import { configDefaults } from "vitest/config";

// Astro-native Vitest config: getViteConfig() merges astro.config.mjs so the
// `@/*` alias, `astro:env`, the React plugin, and Tailwind resolve in tests.
// getViteConfig() requires Vitest >= 3.2 on Astro 6 (pinned ^3.2.4).
export default getViteConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    // The opt-in real-DB suite (`*.integration.test.ts`) hits the live Supabase
    // project and needs the service_role key. Keep the default `npm test`
    // hermetic, fast, and secret-free — those tests run only via
    // `npm run test:integration` (see vitest.integration.config.ts).
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
});
