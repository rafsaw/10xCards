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

console.log("SENTRY CLIENT LOADED");

console.log(
  "PUBLIC_SENTRY_DSN length:",
  PUBLIC_SENTRY_DSN?.length,
);

Sentry.captureException(
  new Error("deploy-verification-test"),
);