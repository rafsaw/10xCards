import * as Sentry from "@sentry/astro";

/**
 * The single observability seam. `reportError` is the one call site that
 * replaces the copy-pasted inline error swallows across the components.
 *
 * Dev logs to the console; production routes to Sentry. The transport is
 * initialized once per runtime — the browser SDK in `sentry.client.config.js`
 * and the Worker via `withSentry` in `sentry.server.config.ts` — so this call
 * site never changes; the signature is the contract.
 */
export interface ErrorContext {
  /** The call site that caught the error (e.g. "parseErrorBody"). */
  where: string;
  [key: string]: unknown;
}

export function reportError(err: unknown, context?: ErrorContext): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[reportError] ${context?.where ?? "unknown"}:`, err, context);
    return;
  }
  // Production: report through Sentry. `@sentry/astro` resolves to the browser SDK
  // on the client and the Cloudflare SDK on the Worker, sharing the global scope set
  // up at init. With no DSN configured, captureException is a safe no-op.
  Sentry.captureException(err, { extra: context });
}
