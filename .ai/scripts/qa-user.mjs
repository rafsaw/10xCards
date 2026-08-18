// om-prepare-test-env: QA user lifecycle for the agent-driven browser provider.
//
// Mirrors tests/e2e/auth.setup.ts: this Supabase project is remote-only and GoTrue
// blocks public signup on test domains, so the service_role admin API is the only
// way to mint a user. The user is ephemeral — created when the test environment
// comes up, deleted when it goes down.
//
// Secrets discipline: the generated password is never printed. It is written
// straight into .ai/qa/test-env.env (gitignored), which consumers load into their
// shell and reference by variable name. Only the email and the user id, neither of
// which is a secret, go to stdout.
//
// Usage:
//   node .ai/scripts/qa-user.mjs create   -> mints the user, writes the env file
//   node .ai/scripts/qa-user.mjs delete   -> deletes the recorded user, removes it
//   node .ai/scripts/qa-user.mjs sweep    -> deletes leftover QA users from crashed runs

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const envPath = resolve(repoRoot, ".env");
const credsPath = resolve(repoRoot, ".ai", "qa", "test-env.env");

// Every ephemeral QA account carries this prefix so `sweep` can recognise its own
// leftovers and never touch a real account.
const EMAIL_PREFIX = "qa-agent-";
const EMAIL_DOMAIN = "example.com";
const SWEEP_AGE_HOURS = 6;

// Same minimal loader as tests/e2e/load-env.ts — values already in the environment
// win, so CI secrets override the file.
function loadEnv() {
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (key in process.env) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env on disk — adminClient() throws a descriptive error below.
  }
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "QA user management needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (git-ignored).",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function readCreds() {
  if (!existsSync(credsPath)) return {};
  const out = {};
  for (const line of readFileSync(credsPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function writeCreds(values) {
  mkdirSync(dirname(credsPath), { recursive: true });
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(credsPath, `${body}\n`, { encoding: "utf8" });
}

async function create() {
  const admin = adminClient();
  const email = `${EMAIL_PREFIX}${randomUUID()}@${EMAIL_DOMAIN}`;
  const password = `Pw-${randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to mint the QA user: ${error.message}`);

  writeCreds({
    TEST_QA_EMAIL: email,
    TEST_QA_PASSWORD: password,
    TEST_QA_USER_ID: data.user.id,
  });

  // Email and id only — the password stays in the file.
  process.stdout.write(`QA_EMAIL=${email}\nQA_USER_ID=${data.user.id}\n`);
}

async function remove() {
  const creds = readCreds();
  const id = creds.TEST_QA_USER_ID;
  if (!id) {
    process.stdout.write("QA_USER_DELETED=0\nQA_NOTE=no recorded QA user\n");
    return;
  }
  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  // A user that is already gone is success, not failure — teardown must be safe twice.
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Failed to delete the QA user ${id}: ${error.message}`);
  }
  rmSync(credsPath, { force: true });
  process.stdout.write(`QA_USER_DELETED=1\nQA_USER_ID=${id}\n`);
}

// A run killed between create and delete leaks an account into the shared project.
// Sweep removes only accounts this script created, and only once they are too old
// to belong to a run still in progress.
async function sweep() {
  const admin = adminClient();
  const cutoff = Date.now() - SWEEP_AGE_HOURS * 60 * 60 * 1000;
  let deleted = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const users = data?.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (!u.email?.startsWith(EMAIL_PREFIX)) continue;
      if (new Date(u.created_at).getTime() > cutoff) continue;
      const { error: delError } = await admin.auth.admin.deleteUser(u.id);
      if (delError && !/not found/i.test(delError.message)) {
        throw new Error(`Failed to delete leftover QA user ${u.id}: ${delError.message}`);
      }
      deleted += 1;
    }
    if (users.length < 200) break;
    page += 1;
  }
  process.stdout.write(`QA_USERS_SWEPT=${deleted}\n`);
}

loadEnv();
const command = process.argv[2];
const actions = { create, delete: remove, sweep };
const action = actions[command];
if (!action) {
  process.stderr.write(`Unknown command: ${command ?? "(none)"}. Use create | delete | sweep.\n`);
  process.exit(2);
}
action().catch((err) => {
  // Never echo the message of an error that might quote a key.
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
