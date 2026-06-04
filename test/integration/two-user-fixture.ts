import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// supabase-js v2's generic defaults differ between the `SupabaseClient` alias,
// `ReturnType<typeof createClient>`, and what a real `createClient(url, key)`
// call actually infers — so annotating with any of those trips no-unsafe-* on
// assignment. Route every client construction through one wrapper and derive the
// type from *its* inferred return, so the annotation always matches the value.
function makeClient(url: string, key: string, accessToken?: string) {
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

type ScopedClient = ReturnType<typeof makeClient>;

// Two-user real-DB fixture: the harness every R2 isolation test builds on.
//
// Creates users A & B via the service_role admin API (the only way to mint test
// users — GoTrue blocks public test-domain signup on the anon key, per the
// deploy notes), seeds one `saved` card each, and exposes a real user-scoped
// supabase-js client per user (a Bearer access token from signInWithPassword,
// so queries run as that auth.uid() and REAL RLS applies — a stubbed client
// would lie about isolation). teardown() deletes both users; their cards
// cascade via the `user_id references auth.users(id) on delete cascade` FK.

export interface SeededUser {
  id: string;
  email: string;
  /** The id of this user's single seeded `saved` card. */
  seededCardId: string;
  /** A fresh supabase-js client authenticated as this user (real RLS scope). */
  scopedClient: () => ScopedClient;
}

export interface TwoUserFixture {
  a: SeededUser;
  b: SeededUser;
  teardown: () => Promise<void>;
}

// A fixed password is fine: these users are ephemeral, created and destroyed
// within a single suite run, and never reused across runs (unique emails).
const TEST_PASSWORD = "integration-test-pw-9f3a2b1c";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Integration tests require ${name} in .env (git-ignored). See test/setup.integration.ts.`);
  }
  return value;
}

async function createUserWithCard(
  admin: ScopedClient,
  url: string,
  anonKey: string,
  label: string,
): Promise<SeededUser> {
  // Unique per-run email avoids collisions with a prior run's residue. The
  // admin API bypasses the GoTrue domain block + email confirmation.
  const email = `iso-test-${label}-${randomUUID()}@example.com`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createError) {
    throw new Error(`Failed to create test user ${label}: ${createError.message}`);
  }
  const id = created.user.id;

  // Seed one saved card via the admin (service_role) client; bypassing RLS for
  // setup is exactly what the admin key is for. next_due_at mirrors the value a
  // real save writes, so review-path tests have a realistic starting row.
  const { data: cardRows, error: seedError } = await admin
    .from("cards")
    .insert({
      user_id: id,
      front: `front-${label}`,
      back: `back-${label}`,
      status: "saved",
      next_due_at: new Date().toISOString(),
    })
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (seedError) {
    throw new Error(`Failed to seed card for test user ${label}: ${seedError.message}`);
  }
  if (cardRows.length === 0) {
    throw new Error(`Failed to seed card for test user ${label}: no row returned`);
  }
  const seededCardId = cardRows[0].id;

  // Sign in once to obtain a real access token, then hand out clients that send
  // it on every request so queries run under this user's auth.uid().
  const { data: session, error: signInError } = await makeClient(url, anonKey).auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) {
    throw new Error(`Failed to sign in test user ${label}: ${signInError.message}`);
  }
  const accessToken = session.session.access_token;

  const scopedClient = (): ScopedClient => makeClient(url, anonKey, accessToken);

  return { id, email, seededCardId, scopedClient };
}

export async function setupTwoUsers(): Promise<TwoUserFixture> {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = makeClient(url, serviceRoleKey);

  const a = await createUserWithCard(admin, url, anonKey, "a");
  const b = await createUserWithCard(admin, url, anonKey, "b");

  const teardown = async (): Promise<void> => {
    // Delete both regardless of one failing; cards cascade via the FK.
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
  };

  return { a, b, teardown };
}
