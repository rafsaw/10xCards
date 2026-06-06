/**
 * The single observability seam. `reportError` is the one call site that
 * replaces the copy-pasted inline error swallows across the components.
 *
 * Today it logs in dev and no-ops elsewhere. Phase D swaps the no-op branch for
 * a Sentry transport (`Sentry.captureException(err, { extra: context })`) without
 * touching any call site — the signature is the contract.
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
  // Production/test: no-op for now. Phase D injects the Sentry transport here —
  // `Sentry.captureException(err, { extra: context })` when a DSN is configured.
}
