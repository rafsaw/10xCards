// Checkpoint 3 / final-gate UI walk for the bg-cosmic-cleanup increment.
//
// Nine routes, two viewports each. For every page it records the computed
// background of <body> and of the page's own wrapper, the document scrollWidth
// against the viewport width (AC9), and whether any legacy glass utility survives
// in the served HTML (AC3). Screenshots land in the checkpoint artifacts folder.
//
// Not a test file: this is evidence capture, run by hand at a checkpoint. The
// committed guards in *.test.ts are what enforce these properties on every run.

import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:4321";
const OUT = process.argv[2] ?? ".ai/runs/2026-08-26-bg-cosmic-cleanup/checkpoint-3-artifacts";
mkdirSync(OUT, { recursive: true });

const creds = Object.fromEntries(
  readFileSync(".ai/qa/test-env.env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const PUBLIC = ["/", "/auth/signin", "/auth/signup", "/auth/confirm-email"];
const PRIVATE = ["/dashboard", "/generate", "/review", "/library", "/settings"];
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

// The glass recipe this increment removes. Checked against the SERVED HTML, which
// is the half a source grep cannot settle.
const LEGACY = ["bg-cosmic", "backdrop-blur", "bg-gradient-to-", "rounded-2xl", "text-white"];

const rows = [];

async function visit(page, route, vp) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  const probe = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const wrapper = document.body.querySelector("div");
    return {
      bodyBg: body.backgroundColor,
      bodyImage: body.backgroundImage,
      wrapperBg: wrapper ? getComputedStyle(wrapper).backgroundColor : null,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    };
  });
  // Against the live DOM, not page.content(). The served stylesheet legitimately
  // *defines* .text-white and friends — Tailwind's dev build scans the whole project,
  // including this run's own markdown and the test files that quote those class names —
  // so a string search over the HTML answers the wrong question. What matters is whether
  // any element actually carries one.
  const legacyHits = await page.evaluate((needles) => {
    const hits = new Set();
    for (const el of document.body.querySelectorAll("*")) {
      for (const cls of el.classList) {
        for (const needle of needles) if (cls.includes(needle)) hits.add(`${needle} on <${el.tagName.toLowerCase()}>`);
      }
    }
    return [...hits];
  }, LEGACY);
  rows.push({
    route,
    viewport: vp.name,
    ...probe,
    viewportWidth: vp.width,
    overflows: probe.scrollWidth > vp.width,
    legacyHits,
  });
  const slug = route === "/" ? "landing" : route.replace(/^\//, "").replace(/\//g, "-");
  await page.screenshot({ path: `${OUT}/screenshot-${slug}-${vp.name}.png`, fullPage: true });
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  // Public routes: a fresh, signed-out context every time.
  const anon = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const anonPage = await anon.newPage();
  for (const route of PUBLIC) await visit(anonPage, route, vp);
  await anon.close();

  // Authenticated routes: sign in through the real form, the way a user would.
  const auth = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const authPage = await auth.newPage();
  await authPage.goto(BASE + "/auth/signin", { waitUntil: "networkidle" });
  await authPage.getByLabel("Email", { exact: true }).fill(creds.TEST_QA_EMAIL);
  await authPage.getByLabel("Password", { exact: true }).fill(creds.TEST_QA_PASSWORD);
  await authPage.getByRole("button", { name: "Sign in" }).click();
  await authPage.waitForURL(/\/dashboard/, { timeout: 20000 });
  for (const route of PRIVATE) await visit(authPage, route, vp);

  // AC5: a signed-in visitor at / is still redirected to /dashboard.
  await authPage.goto(BASE + "/", { waitUntil: "networkidle" });
  rows.push({
    route: "/ (signed in)",
    viewport: vp.name,
    finalUrl: authPage.url(),
    redirectedToDashboard: authPage.url().endsWith("/dashboard"),
  });
  await auth.close();
}

await browser.close();
console.log(JSON.stringify(rows, null, 1));
