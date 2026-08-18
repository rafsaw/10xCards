// om-prepare-test-env: proves the recorded QA credentials actually produce an
// authenticated session in a real browser, through the configured Playwright
// provider (.ai/browsers/playwright.md).
//
// It is deliberately not a spec under tests/e2e/ — the provider contract asks for
// a throwaway flow outside the repository's discovered test directories, so this
// never joins the committed suite or its reporters.
//
// Secrets discipline: the password is read from the gitignored credentials file
// into this process and passed straight to `fill()`. It is never printed, never
// returned, and never placed on a command line.
//
// Usage: node .ai/scripts/qa-login-check.mjs

import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const descriptorPath = resolve(repoRoot, ".ai", "qa", "test-env.json");
const credsPath = resolve(repoRoot, ".ai", "qa", "test-env.env");

function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!existsSync(descriptorPath)) fail("No test-env descriptor. Run .ai/scripts/test-env-up.ps1 first.");
const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8"));
const baseUrl = descriptor.baseUrl;

const creds = readEnvFile(credsPath);
const email = creds.TEST_QA_EMAIL;
const password = creds.TEST_QA_PASSWORD;
if (!email || !password) fail("No QA credentials recorded. Re-run test-env-up.ps1 so the QA user is minted.");

const runId = descriptor.runId ?? "manual";
const artifactDir = resolve(repoRoot, ".ai", "qa", `artifacts_${runId}`);
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: baseUrl });
const page = await context.newPage();

try {
  // 1. The guard is real: an anonymous visit to a protected route must bounce.
  await page.goto("/dashboard");
  await page.waitForURL(/\/auth\/signin/, { timeout: 15_000 });
  process.stdout.write("GUARD_REDIRECTS_ANONYMOUS=1\n");

  // 2. Sign in through the real form, exactly as tests/e2e/auth.setup.ts does.
  //    exact: true — the "Show password" toggle's aria-label also contains
  //    "Password", so a substring match resolves to two elements.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // 3. Wait for the outcome, not for a URL transition: the sign-in POST answers
  //    302 and the browser may already have settled on the destination before a
  //    predicate-based waitForURL gets a navigation event to observe.
  const heading = page.getByRole("heading", { name: "Dashboard" });
  await heading.waitFor({ state: "visible", timeout: 20_000 });

  // The protected route renders — and belongs to THIS user. Asserting the email is
  // what separates "a page rendered" from "the session is ours".
  await page.goto("/dashboard");
  if (!(await heading.isVisible())) fail("Signed in, but /dashboard did not render its heading.");
  const body = await page.locator("body").innerText();
  if (!body.includes(email)) fail("/dashboard rendered but does not show the QA user's email — wrong session?");

  const shot = resolve(artifactDir, "dashboard-authenticated.png");
  await page.screenshot({ path: shot, fullPage: true });

  process.stdout.write("AUTHENTICATED_ROUTE_OK=1\n");
  process.stdout.write(`QA_EMAIL=${email}\n`);
  process.stdout.write(`SCREENSHOT=${shot}\n`);
} finally {
  await context.close();
  await browser.close();
}
