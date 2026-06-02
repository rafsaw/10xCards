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

// Human-readable retention date for the banner and settings page. Single source
// so the deletion date renders identically everywhere. `null`/missing → "soon"
// (only reached transiently; a present request row always carries a date).
export function formatRetentionDate(iso: string | null): string {
  if (!iso) {
    return "soon";
  }
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
