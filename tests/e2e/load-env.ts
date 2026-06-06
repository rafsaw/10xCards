import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Minimal .env loader so the Playwright Node-side processes (config, auth setup,
// teardown) see SUPABASE_* without adding a `dotenv` dependency. The Astro dev
// server loads .env on its own for `astro:env/server`; this only covers the
// test-runner side. Values already in process.env win, so CI secrets override.
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (key in process.env) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env on disk — auth.setup throws a descriptive error when it needs keys.
}
