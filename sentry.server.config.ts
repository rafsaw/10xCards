import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

interface SentryEnv {
  /** Sentry DSN, provided as a Cloudflare Worker secret. Absent ⇒ Sentry is disabled. */
  SENTRY_DSN?: string;
}

// Wraps the Astro Cloudflare Worker handler with Sentry — errors only.
//
// No tracesSampleRate (tracing disabled), no enableLogs, no extra integrations, no metrics.
// The DSN comes from the `SENTRY_DSN` Worker secret at runtime; when unset, withSentry is a
// no-op so dev/test/unconfigured deploys send nothing. `wrangler.jsonc` points `main` here so
// this wrapped handler is the deployed Worker entry.
export default Sentry.withSentry(
  (env) => ({
    dsn: (env as SentryEnv).SENTRY_DSN,
  }),
  handler,
);
