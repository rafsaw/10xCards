import { reportError } from "@/lib/observability";

/**
 * Shared parser for an error-response body returned by our API routes.
 *
 * Extracted verbatim from `CardRow.parseError` (the M3L5 specimen) so every
 * inner error-body site can call one helper instead of copy-pasting the parse.
 * Returns the raw `{ code, message }` — each call site applies its own
 * `FALLBACK_MESSAGES[code]` lookup, since the fallback map differs per surface.
 *
 * A non-JSON error body (or any throw while parsing) used to be swallowed
 * silently here. It is now reported through the `reportError` seam — the
 * user-facing fallback `{ code, message }` is unchanged, but the exception is
 * observable instead of vanishing.
 */
export async function parseErrorBody(response: Response): Promise<{ code: string; message: string }> {
  let code = "unknown";
  let message = "Something went wrong. Please try again.";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const rawCode = (body as { error?: unknown }).error;
      const rawMessage = (body as { message?: unknown }).message;
      if (typeof rawCode === "string") code = rawCode;
      if (typeof rawMessage === "string" && rawMessage) message = rawMessage;
    }
  } catch (err) {
    // Non-JSON error body — keep the generic message, but surface the throw.
    reportError(err, { where: "parseErrorBody" });
  }
  return { code, message };
}
