import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the /dashboard Paper migration, following the technique
 * src/components/review/review-paper.test.ts and
 * src/components/library/library-paper.test.ts established: read a shipped file as
 * text and assert over it, rather than rendering — this repo has no jsdom/RTL harness.
 *
 * These cover the acceptance criteria a grep can genuinely settle. The clauses about
 * *rendered* size, greyscale legibility and per-viewport scroll (AC4's rendered half,
 * AC11's scroll half, AC14) are verified by the manual walkthrough instead and recorded
 * in the PR body.
 *
 * Source: .ai/specs/2026-08-26-screen-migration-dashboard.md
 */

const DASHBOARD_DIR = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

const page = readFileSync(join(SRC_DIR, "pages", "dashboard.astro"), "utf8");
const lead = readFileSync(join(DASHBOARD_DIR, "DashboardLead.astro"), "utf8");
const note = readFileSync(join(DASHBOARD_DIR, "DashboardNote.astro"), "utf8");

const FILES: [name: string, source: string][] = [
  ["dashboard.astro", page],
  ["DashboardLead.astro", lead],
  ["DashboardNote.astro", note],
];

describe("AC1 — no legacy utility and no colour literal survives on /dashboard", () => {
  const LEGACY = [/\bbg-cosmic\b/, /\bbackdrop-blur/, /\brounded-2xl\b/, /\bbg-gradient-to-/, /\btext-white\b/];

  it.each(FILES)("%s carries no legacy surface utility", (_name, source) => {
    for (const pattern of LEGACY) {
      expect(source).not.toMatch(pattern);
    }
  });

  const PALETTE_SCALE =
    /\b(?:bg|text|border|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

  it.each(FILES)("%s carries no Tailwind palette-scale colour utility", (_name, source) => {
    expect(source).not.toMatch(PALETTE_SCALE);
  });

  it.each(FILES)("%s carries no white/N or black/N opacity utility", (_name, source) => {
    expect(source).not.toMatch(/\b(?:bg|text|border|from|to|via)-(?:white|black)\/\d{1,3}\b/);
  });

  it.each(FILES)("%s carries no hex, rgb() or oklch() colour literal", (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgba?\(/);
    expect(source).not.toMatch(/\boklch\(/);
  });
});

describe("AC2 and Q2 — the page paints its own Paper ground at the reading measure", () => {
  it("the wrapper carries the Paper ground instead of relying on the body gradient", () => {
    expect(page).toMatch(/<div class="bg-background text-foreground min-h-screen p-4">/);
  });

  it("the container is the 66ch reading column the other single-region pages use", () => {
    // Q2: /dashboard joins /generate, /review and /settings rather than /library —
    // three short sentences and some links are exactly the prose column
    // --container-content exists for. A visible desktop layout change, by decision.
    expect(page).toMatch(/<div class="max-w-content mx-auto space-y-6 py-8">/);
    expect(page).not.toMatch(/max-w-3xl/);
  });

  it("the header is PageHeader, and the accessible name Dashboard survives verbatim", () => {
    expect(page).toMatch(/<PageHeader title="Dashboard" \/>/);
    expect(page).not.toMatch(/<h1\b/);
  });
});

describe("AC3 — bg-cosmic is removed from dashboard.astro and nowhere else", () => {
  const SURVIVORS = [
    ["styles/global.css", join(SRC_DIR, "styles", "global.css")],
    ["layouts/Layout.astro", join(SRC_DIR, "layouts", "Layout.astro")],
    ["components/Welcome.astro", join(SRC_DIR, "components", "Welcome.astro")],
    ["pages/auth/signin.astro", join(SRC_DIR, "pages", "auth", "signin.astro")],
    ["pages/auth/signup.astro", join(SRC_DIR, "pages", "auth", "signup.astro")],
    ["pages/auth/confirm-email.astro", join(SRC_DIR, "pages", "auth", "confirm-email.astro")],
  ] as const;

  it.each(SURVIVORS)("%s still carries bg-cosmic — the next increment removes it", (_name, path) => {
    expect(readFileSync(path, "utf8")).toMatch(/bg-cosmic/);
  });
});

describe("AC4 and Q3 — the lead recipe, with a quiet eyebrow above a loud statement", () => {
  const EYEBROW = /<h2 class="text-meta text-muted-foreground font-sans tracking-wide uppercase">\{label\}<\/h2>/;

  it("the eyebrow is an h2 at text-meta on --muted-foreground, with no font-medium", () => {
    // Q3: the recipe is ReviewSession.tsx:205's verbatim, sans substituted for serif.
    // No weight is added ahead of the walkthrough. If the fallback is ever taken, this
    // assertion and AC4 are amended in the same commit.
    expect(lead).toMatch(EYEBROW);
    expect(lead).not.toMatch(/font-medium/);
    expect(note).toMatch(EYEBROW);
    expect(note).not.toMatch(/font-medium/);
  });

  it("the statement is text-title at full --foreground, the largest text below the h1", () => {
    expect(lead).toMatch(/<p class="text-foreground text-title font-sans">\{statement\}<\/p>/);
    // Nothing on the page or in the two components outranks it: text-display belongs to
    // PageHeader's h1 alone.
    for (const [, source] of FILES) {
      expect(source).not.toMatch(/text-display/);
    }
  });

  it("the note's body is small and muted, so the two tiers differ in size and colour", () => {
    expect(note).toMatch(/<p class="text-muted-foreground text-sm"><slot \/><\/p>/);
  });

  it("the lead has no top hairline and the note is separated by exactly one", () => {
    expect(lead).toMatch(/<section class="space-y-3">/);
    expect(lead).not.toMatch(/border/);
    expect(note).toMatch(/<section class="border-border space-y-1 border-t pt-4">/);
  });

  it("neither component carries a surface fill or a shadow (principles 1 and 4)", () => {
    for (const source of [lead, note]) {
      expect(source).not.toMatch(/\bbg-[a-z]/);
      expect(source).not.toMatch(/\bshadow-[a-z]/);
    }
  });
});

describe("AC5 — the both-waiting state is a lead plus a hairline note, never two peers", () => {
  const reviewWaiting = /state\.kind === "review-waiting" && \(([\s\S]*?)\n {6}\}/.exec(page)?.[1] ?? "";

  it("the branch was found", () => {
    expect(reviewWaiting).not.toBe("");
  });

  it("its lead carries the one filled Button, over an anchor to /review", () => {
    expect(reviewWaiting).toMatch(/<DashboardLead label="Next up" statement=\{dueSentence\(state\.dueCount\)\}>/);
    expect(reviewWaiting).toMatch(
      /<Button asChild>\s*\n\s*<a href="\/review">Start review session<\/a>\s*\n\s*<\/Button>/,
    );
    expect((reviewWaiting.match(/<Button\b/g) ?? []).length).toBe(1);
  });

  it("Also waiting is a note whose only control is an underlined text link", () => {
    expect(reviewWaiting).toMatch(/<DashboardNote label="Also waiting">/);
    expect(reviewWaiting).toMatch(/\{alsoWaitingSentence\(state\.alsoWaitingDrafts\)\}/);
    expect(reviewWaiting).toMatch(/<a href="\/generate" class="text-link text-sm underline underline-offset-4">/);
    expect(reviewWaiting).toMatch(/state\.alsoWaitingDrafts !== null &&/);
  });
});

describe("AC6 — at most one filled Button per state, and every action is a link", () => {
  it("no file contains a literal button element", () => {
    for (const [, source] of FILES) {
      expect(source).not.toMatch(/<button\b/);
    }
  });

  it("every Button occurrence carries asChild, so none of them renders a real button", () => {
    // A bare "zero <button elements" regex would pass for the wrong reason: <Button>
    // without asChild renders one. Both halves are asserted.
    const buttons = page.match(/<Button\b[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const tag of buttons) {
      expect(tag).toMatch(/\basChild\b/);
    }
  });

  it("no Button carries a non-default variant, and no state branch holds two", () => {
    expect(page).not.toMatch(/<Button[^>]*variant=/);
    const branches = page.split(/state\.kind === /).slice(1);
    for (const branch of branches) {
      expect((branch.match(/<Button\b/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it("there are exactly four filled Buttons across the page — one per lead", () => {
    expect((page.match(/<Button\b/g) ?? []).length).toBe(4);
  });
});

describe("AC7 and Q1 — the read-only state announces itself through Notice", () => {
  const readOnly = /state\.kind === "read-only" && \(([\s\S]*?)\n {6}\}/.exec(page)?.[1] ?? "";

  it("both user-visible strings survive, as Notice's title and body", () => {
    expect(readOnly).toMatch(/<Notice variant="warning" title="Your account is read-only">/);
    expect(readOnly).toMatch(
      /While deletion is pending you can browse your cards, but you can't review, generate, or edit them\. Cancel\s*\n\s*the deletion in the banner above to continue\./,
    );
  });

  it("the warning variant is what supplies role=status and aria-live=polite", () => {
    const notice = readFileSync(join(SRC_DIR, "components", "ui", "Notice.tsx"), "utf8");
    expect(notice).toMatch(/const role = variant === "error" \? "alert" : "status";/);
    expect(notice).toMatch(/const ariaLive = variant === "error" \? "assertive" : "polite";/);
  });

  it("no review, generate or draft action is offered in this state", () => {
    expect(readOnly).not.toMatch(/href="\/review"/);
    expect(readOnly).not.toMatch(/href="\/generate"/);
    expect(readOnly).not.toMatch(/<Button\b/);
  });

  it("Browse library is reachable exactly once — only when the library note is absent", () => {
    expect(readOnly).toMatch(/libraryText === null &&/);
    expect((readOnly.match(/href="\/library"/g) ?? []).length).toBe(1);
  });
});

describe("AC8 — the load-error state announces itself and precedes its three links", () => {
  const errorBranch = /state\.kind === "error" && \(([\s\S]*?)\n {6}\}/.exec(page)?.[1] ?? "";

  it("the message renders through Notice variant=error, which carries role=alert", () => {
    expect(errorBranch).toMatch(
      /<Notice variant="error">We couldn't load your dashboard right now\. Try refreshing the page\.<\/Notice>/,
    );
  });

  it("the message precedes the three links in DOM order", () => {
    const messageAt = errorBranch.indexOf("<Notice");
    const linksAt = errorBranch.indexOf('href="/review"');
    expect(messageAt).toBeGreaterThanOrEqual(0);
    expect(linksAt).toBeGreaterThan(messageAt);
  });

  it("all three links render in the text-link recipe, and none is a filled button", () => {
    for (const href of ["/review", "/generate", "/library"]) {
      expect(errorBranch).toMatch(
        new RegExp(`<a href="${href}" class="text-link text-sm underline underline-offset-4">`),
      );
    }
    expect(errorBranch).not.toMatch(/<Button\b/);
    expect(errorBranch).toMatch(/<div class="flex flex-wrap items-center gap-3">/);
  });

  it("no numeric count can render — the branch names none of the count sentences", () => {
    expect(errorBranch).not.toMatch(/dueSentence|draftsWaitingSentence|alsoWaitingSentence|librarySentence/);
  });

  it("not-configured is an error Notice too, with its operator-facing copy verbatim", () => {
    expect(page).toMatch(
      /<Notice variant="error">Supabase is not configured — your dashboard cannot be loaded\.<\/Notice>/,
    );
  });
});

describe("AC9 — every user-visible sentence is byte-identical to what main rendered", () => {
  it("the caught-up and new-account statements survive verbatim", () => {
    expect(page).toMatch(/statement="Nothing is due right now\. Cards come back when their interval is up\."/);
    expect(page).toMatch(
      /statement="You have no cards yet\. Paste a passage and 10xCards drafts question-and-answer cards for you to review before anything is saved\."/,
    );
  });

  it("every action label survives verbatim", () => {
    for (const label of [
      "Start review session",
      "Check generated cards",
      "Generate more cards",
      "Create your first cards",
      "Or add a card by hand",
      "Browse library",
      "Generate cards",
    ]) {
      expect(page).toContain(label);
    }
  });

  it("the four eyebrows carry the headings main rendered as h2s", () => {
    expect((page.match(/label="Next up"/g) ?? []).length).toBe(2);
    expect(page).toMatch(/label="All caught up"/);
    expect(page).toMatch(/label="Start your first deck"/);
    expect(page).toMatch(/label="Also waiting"/);
    expect(page).toMatch(/label="Your library"/);
  });
});

describe("AC10 — the components' call sites, and not one legacy const survives", () => {
  it("DashboardLead has four call sites, one per state that answers what now?", () => {
    expect((page.match(/<DashboardLead\b/g) ?? []).length).toBe(4);
    for (const kind of ["review-waiting", "drafts-waiting", "caught-up", "new-account"]) {
      expect(page).toMatch(new RegExp(`state\\.kind === "${kind}"`));
    }
  });

  it("DashboardNote has two call sites — Also waiting and Your library", () => {
    expect((page.match(/<DashboardNote\b/g) ?? []).length).toBe(2);
  });

  it("none of the eleven legacy class consts is declared any more", () => {
    for (const name of [
      "headingClass",
      "sectionClass",
      "sectionHeadingClass",
      "bodyClass",
      "primaryLinkClass",
      "asideClass",
      "asideHeadingClass",
      "asideBodyClass",
      "textLinkClass",
      "actionsClass",
      "noticeClass",
    ]) {
      expect(page).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it("the px-6 alignment hack the padded card required is gone", () => {
    expect(page).not.toMatch(/\bpx-6\b/);
  });
});

describe("AC11 — the page stays server-rendered, with no island and no placeholder", () => {
  it.each(FILES)("%s declares no client: directive", (_name, source) => {
    expect(source).not.toMatch(/client:(load|idle|visible|media|only)/);
  });

  it.each(FILES)("%s contains no skeleton or spinner markup", (_name, source) => {
    // The page's own comment explains *why* there is no skeleton, so the ban is on
    // markup, not on the word: a rendered class or element, never a code comment.
    expect(source).not.toMatch(/animate-pulse|animate-spin/);
    expect(source).not.toMatch(/class(?:Name)?="[^"]*(?:skeleton|spinner)/i);
    expect(source).not.toMatch(/<(?:Skeleton|Spinner)\b/);
  });
});

describe("AC15 — no Section, no EmptyState, and no new registry primitive", () => {
  it("the page renders neither Section nor EmptyState", () => {
    expect(page).not.toMatch(/<Section\b/);
    expect(page).not.toMatch(/<EmptyState\b/);
    expect(page).not.toMatch(/from "@\/components\/ui\/(Section|EmptyState)"/);
  });

  it("both new components live under src/components/dashboard/, not the ui registry", () => {
    expect(page).toMatch(/import DashboardLead from "@\/components\/dashboard\/DashboardLead\.astro";/);
    expect(page).toMatch(/import DashboardNote from "@\/components\/dashboard\/DashboardNote\.astro";/);
  });
});

describe("AC16 — the PR #31 reasoning survives its expression being replaced", () => {
  it("the page still records the two-tier requirement and where it now lives", () => {
    expect(page).toMatch(/UX review of PR #31/);
    expect(page).toMatch(/`DashboardLead`/);
    expect(page).toMatch(/`DashboardNote`/);
    expect(page).toMatch(/\.ai\/specs\/2026-08-26-screen-migration-dashboard\.md/);
  });
});

describe("the data layer is frozen — this increment rewrote markup only", () => {
  it("the three count queries survive verbatim, head: true included", () => {
    expect(page).toMatch(
      /\.from\("cards"\)\s*\n\s*\.select\("id", \{ count: "exact", head: true \}\)\s*\n\s*\.eq\("status", "saved"\)\s*\n\s*\.lte\("next_due_at", nowIso\)/,
    );
    expect(page).toMatch(
      /supabase\.from\("cards"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("status", "draft"\)/,
    );
    expect(page).toMatch(
      /supabase\.from\("cards"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("status", "saved"\)/,
    );
    // Three queries, three head-only counts. The fourth occurrence in the file is the
    // frontmatter comment explaining what `head: true` buys, so the select recipe is
    // what is counted rather than the bare words.
    expect((page.match(/count: "exact", head: true/g) ?? []).length).toBe(3);
  });

  it("the Promise.all, the try/catch and the never-render-a-zero rule survive", () => {
    expect(page).toMatch(/const \[due, drafts, library\] = await Promise\.all\(\[/);
    expect(page).toMatch(/\} catch \{\s*\n\s*loadError = true;\s*\n\s*\}/);
    expect(page).toMatch(/if \(due\.error \|\| drafts\.error \|\| library\.error\) \{\s*\n\s*loadError = true;/);
  });

  it("resolveDashboardState is still what decides which state renders", () => {
    expect(page).toMatch(
      /const state = resolveDashboardState\(\{\s*\n\s*configured: supabase !== null,\s*\n\s*loadError,\s*\n\s*isReadOnly,\s*\n\s*dueCount,\s*\n\s*draftCount,\s*\n\s*libraryCount,\s*\n\s*\}\);/,
    );
    expect(page).toMatch(
      /const libraryText = "libraryCount" in state && state\.libraryCount !== null \? librarySentence\(state\.libraryCount\) : null;/,
    );
  });
});
