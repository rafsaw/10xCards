import "./load-env";
import { test as teardown } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, rmSync } from "node:fs";

const USER_ID_FILE = "tests/e2e/.auth/user-id";

// Reap the ephemeral user minted by auth.setup. Cards cascade via the
// user_id -> auth.users on delete cascade FK, so no card residue remains.
teardown("delete ephemeral user", async () => {
  if (!existsSync(USER_ID_FILE)) return;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = readFileSync(USER_ID_FILE, "utf8").trim();
  if (url && serviceRoleKey && id) {
    const admin = createSupabaseClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.auth.admin.deleteUser(id);
  }
  rmSync(USER_ID_FILE, { force: true });
});
