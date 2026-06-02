// Single source of read-only enforcement for write routes. When the account is
// pending deletion (locals.isReadOnly, computed in middleware), every mutating
// handler returns this identical 403 right after its existing user null-check.
// Returns null when the account is writable so callers can proceed.
export function readOnlyGuard(locals: App.Locals): Response | null {
  if (!locals.isReadOnly) {
    return null;
  }
  return new Response(
    JSON.stringify({
      error: "account_read_only",
      message: "Your account is pending deletion and is read-only. Cancel the deletion to make changes.",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
}
