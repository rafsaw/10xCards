// IMPORTANT:
// `PUBLIC_SENTRY_DSN` must be configured as a Cloudflare Build Variable.
// Worker Secrets are not exposed through `astro:env/client`.
// If `PUBLIC_SENTRY_DSN` is missing at build time, browser-side Sentry becomes a no-op and no client-side events will be sent.

import * as Sentry from "@sentry/astro";
import { PUBLIC_SENTRY_DSN } from "astro:env/client";

// Browser SDK init — errors only.
//
// No tracing (no browserTracingIntegration / tracesSampleRate), no session replay,
// no logs, no metrics, no captureConsoleIntegration. The default integrations capture
// uncaught exceptions and the errors routed through the `reportError` seam.
//
// The DSN is publishable, embedded at build time from PUBLIC_SENTRY_DSN. When it is
// absent (local dev, unconfigured deploys), Sentry.init is a no-op and nothing is sent.
Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
});