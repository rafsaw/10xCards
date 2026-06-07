// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  // Sentry: errors only. Client init lives in sentry.client.config.ts (browser SDK)
  // and the Worker is wrapped via withSentry in sentry.server.config.ts. No authToken
  // is set, so no source maps are uploaded at build time; telemetry is off so the
  // build plugin sends nothing to Sentry.
  integrations: [sentry({ telemetry: false }), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENROUTER_MODEL: envField.string({ context: "server", access: "secret", optional: true }),
      // Publishable Sentry DSN embedded in the browser SDK (sentry.client.config.ts).
      PUBLIC_SENTRY_DSN: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});
