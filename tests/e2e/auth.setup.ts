import "./load-env";
import { test as setup, expect } from "@playwright/test";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STORAGE_STATE = "tests/e2e/.auth/user.json";
const USER_ID_FILE = "tests/e2e/.auth/user-id";

// Route client construction through one wrapper so the inferred type matches the
// value (mirrors test/integration/two-user-fixture.ts — dodges no-unsafe-* that
// a hand-written SupabaseClient annotation would trip).
function makeAdminClient(url: string, serviceRoleKey: string) {
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The one sanctioned UI login: a single setup, not a per-test login. It mints an
// ephemeral user and captures the SSR auth cookies into storageState; every spec
// then runs authenticated without touching the sign-in form (E2E rule).
setup("authenticate", async ({ page }) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "E2E auth setup needs SUPABASE_URL, SUPABASE_KEY and SUPABASE_SERVICE_ROLE_KEY in .env (git-ignored).",
    );
  }

  // Mint a confirmed user per run via the service_role admin API — the only way
  // to create a test user on this remote-only project (GoTrue blocks public
  // test-domain signup on the anon key). Unique email so runs never collide.
  const admin = makeAdminClient(url, serviceRoleKey);
  const email = `e2e-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Failed to mint E2E user: ${error.message}`);
  }

  // Sign in through the real form so Supabase SSR writes its auth cookies onto
  // our browser context — exactly what a real session carries.
  await page.goto("/auth/signin");
  // exact: true — the "Show password" toggle button's aria-label also contains
  // "Password", so a substring match would resolve to two elements.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for state: sign-in redirects away from /auth (api/auth/signin.ts -> "/"),
  // then confirm a protected route renders rather than bouncing back to sign-in.
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Card library" })).toBeVisible();

  // Warm up Vite's on-demand dependency optimization for every route the specs
  // hit. The FIRST visit to a route under `astro dev` triggers optimizeDeps,
  // which broadcasts a full-page reload to all connected clients — if that fires
  // mid-test it resets React form state and aborts navigations. Pay it once here.
  for (const route of ["/review", "/generate", "/dashboard"]) {
    try {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    } catch {
      // The optimizeDeps reload can abort this first navigation — that is exactly
      // the cost we are paying up front; ignore it and move on.
    }
  }

  // Persist auth for the chromium project, and stash the user id for teardown.
  mkdirSync(dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
  writeFileSync(USER_ID_FILE, created.user.id, "utf8");
});
