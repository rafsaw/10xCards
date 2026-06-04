import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// R2 cross-route backstop (hermetic, no DB/network). The two-user integration
// tests prove RLS holds on 3 routes, but RLS is the SINGLE isolation layer in
// this app: there is exactly one client factory (src/lib/supabase.ts) and it
// uses the anon key. A service_role client bypasses RLS entirely, so a single
// app module introducing one would silently void every R2 guarantee across ALL
// routes at once — something a 3-route test set cannot catch.
//
// This guard statically scans src/** and fails if any module references a
// service_role key. The service_role key must live ONLY in the integration TEST
// process (test/setup.integration.ts), never in shipped app code.
//
// Oracle: research §"Key Discoveries" / plan §"Critical Implementation Details" —
// "Service_role key must never reach app code ... The app reads only the anon
// SUPABASE_KEY." The allowlist is empty today and should stay that way.

const SRC_DIR = fileURLToPath(new URL("../src", import.meta.url));

// Matches service_role / service-role / servicerole / SERVICE_ROLE (case-insensitive).
const SERVICE_ROLE = /service[_-]?role/i;

// Explicit allowlist of src-relative paths permitted to mention service_role.
// Empty by design — no application module has any business with the key.
const ALLOWLIST = new Set<string>([]);

/** Recursively collect every file path under `dir`. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

describe("No service_role key reference in src/** (RLS-bypass guardrail)", () => {
  it("contains no application module referencing a service_role key", () => {
    const offenders = walk(SRC_DIR)
      .map((abs) => relative(SRC_DIR, abs).split("\\").join("/"))
      .filter((rel) => !ALLOWLIST.has(rel))
      .filter((rel) => SERVICE_ROLE.test(readFileSync(resolve(SRC_DIR, rel), "utf8")));

    // Naming the offenders makes a failure actionable: the message points at the
    // file that would silently bypass RLS, not just "expected [] to equal [x]".
    expect(offenders, `service_role referenced in src/ — RLS bypass risk: ${offenders.join(", ")}`).toEqual([]);
  });
});
