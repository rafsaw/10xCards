/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Astro-native Vitest config: getViteConfig() merges astro.config.mjs so the
// `@/*` alias, `astro:env`, the React plugin, and Tailwind resolve in tests.
// getViteConfig() requires Vitest >= 3.2 on Astro 6 (pinned ^3.2.4).
export default getViteConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    globals: true,
  },
});
