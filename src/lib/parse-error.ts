/**
 * Shared parser for an error-response body returned by our API routes.
 *
 * Extracted verbatim from `CardRow.parseError` (the M3L5 specimen) so every
 * inner error-body site can call one helper instead of copy-pasting the parse.
 * Returns the raw `{ code, message }` — each call site applies its own
 * `FALLBACK_MESSAGES[code]` lookup, since the fallback map differs per surface.
 *
 * NOTE: the `} catch { … }` below still swallows a non-JSON body. That is
 * intentional at this step (Phase A is a behavior-preserving extraction); the
 * swallow is fixed in Phase B, where a RED test births the `reportError` seam.
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
  } catch {
    /* non-JSON error body — keep the generic message */
  }
  return { code, message };
}
