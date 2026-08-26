import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the auth family's Paper migration, following the layout
 * src/components/dashboard/dashboard-paper.test.ts established: read a shipped file as
 * text and assert over it, rather than rendering — this repo has no jsdom/RTL harness.
 *
 * The rendered half — that these three screens paint ink-on-paper with no gradient, and
 * that nothing overflows at 390px — is verified by the browser walk in
 * `.ai/runs/2026-08-26-bg-cosmic-cleanup/ui-walk.mjs` and recorded in the PR.
 *
 * Source: .ai/specs/2026-08-26-bg-cosmic-cleanup.md
 */

const AUTH_DIR = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

/**
 * A file with its comments removed.
 *
 * These screens document what the migration took away — "the previous
 * `text-purple-300 hover:underline` was colour-only until hover", "the emoji this
 * replaces" — and that prose necessarily names the utilities the assertions below forbid.
 * Asserting over the raw source would make an accurate comment fail the build and push
 * the next author toward deleting the explanation instead of the class. A utility inside
 * a comment ships nothing, so what the guards read is the code.
 *
 * Block comments, Astro `{/* … *\/}` blocks (prettier reformats these onto their own
 * lines, so the braces tolerate whitespace) and whole-line `//` comments are removed;
 * a trailing `//` after code is left alone rather than risk eating a URL.
 */
const stripComments = (source: string): string =>
  source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ 	]*\/\/.*$/gm, "");

const readAuth = (name: string) => stripComments(readFileSync(join(AUTH_DIR, name), "utf8"));
const readAuthPage = (name: string) => stripComments(readFileSync(join(SRC_DIR, "pages", "auth", name), "utf8"));

const MIGRATED_FILES: [name: string, source: string][] = [
  ["AuthCard.astro", readAuth("AuthCard.astro")],
  ["signin.astro", readAuthPage("signin.astro")],
  ["signup.astro", readAuthPage("signup.astro")],
  ["confirm-email.astro", readAuthPage("confirm-email.astro")],
  ["FormField.tsx", readAuth("FormField.tsx")],
  ["PasswordToggle.tsx", readAuth("PasswordToggle.tsx")],
  ["SubmitButton.tsx", readAuth("SubmitButton.tsx")],
  ["SignInForm.tsx", readAuth("SignInForm.tsx")],
  ["SignUpForm.tsx", readAuth("SignUpForm.tsx")],
];

describe("AC2 — no colour literal or palette-scale utility survives in the auth family", () => {
  it.each(MIGRATED_FILES)("%s has no hex, rgb() or oklch() colour literal", (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgba?\(/);
    expect(source).not.toMatch(/\boklch\(/);
  });

  it.each(MIGRATED_FILES)("%s uses no Tailwind palette-scale colour utility", (_name, source) => {
    const paletteHues =
      "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
    expect(source).not.toMatch(new RegExp(`\\b(?:bg|text|border|from|to|via)-(?:${paletteHues})-\\d{2,3}\\b`));
  });

  it.each(MIGRATED_FILES)("%s uses no white/N or black/N opacity utility", (_name, source) => {
    expect(source).not.toMatch(/\b(?:bg|text|border|from|to|via|placeholder)-(?:white|black)\/\d{1,3}\b/);
  });
});

describe("AC3 — no legacy surface utility survives on the auth screens", () => {
  const LEGACY = [/\bbg-cosmic\b/, /\bbackdrop-blur/, /\brounded-2xl\b/, /\bbg-gradient-to-/, /\btext-white\b/];

  it.each(MIGRATED_FILES)("%s carries no legacy surface utility", (_name, source) => {
    for (const pattern of LEGACY) {
      expect(source).not.toMatch(pattern);
    }
  });

  it.each(MIGRATED_FILES)("%s carries no shadow utility", (_name, source) => {
    // Paper allows exactly one shadow, and it belongs to Dialog, Popover, Tooltip and
    // Toast. AuthCard is separated from the page by its hairline and its whitespace.
    expect(source).not.toMatch(/\bshadow-[a-z]/);
  });
});

describe("AC6 — every auth screen composes AuthCard rather than repeating the card recipe", () => {
  const PAGES: [name: string, source: string, title: string][] = [
    ["signin.astro", readAuthPage("signin.astro"), '"Sign in"'],
    ["signup.astro", readAuthPage("signup.astro"), '"Sign up"'],
    ["confirm-email.astro", readAuthPage("confirm-email.astro"), "{content.heading}"],
  ];

  it.each(PAGES)("%s composes AuthCard", (_name, source) => {
    expect(source).toMatch(/import AuthCard from "@\/components\/auth\/AuthCard\.astro";/);
    expect(source).toMatch(/<AuthCard title=/);
  });

  it.each(PAGES)("%s passes the title AuthCard renders as the page h1", (_name, source, title) => {
    expect(source).toContain(`<AuthCard title=${title}>`);
  });

  it.each(PAGES)("%s declares no h1 and no card recipe of its own", (_name, source) => {
    expect(source).not.toMatch(/<h1\b/);
    expect(source).not.toMatch(/max-w-sm/);
    expect(source).not.toMatch(/min-h-screen/);
  });

  it("AuthCard carries the shell exactly once, and it is the only h1", () => {
    const card = readAuth("AuthCard.astro");
    expect(card).toMatch(
      /<div class="bg-background text-foreground flex min-h-screen items-center justify-center p-4">/,
    );
    expect(card).toMatch(/<div class="border-border bg-card rounded-paper w-full max-w-sm border p-8">/);
    expect(card).toMatch(/<h1 class="text-display text-foreground mb-6 font-sans font-bold">\{title\}<\/h1>/);
    expect(card).toMatch(/<slot \/>/);
    // Left-aligned: centred headings were part of the glass recipe, and Paper's migrated
    // screens are uniformly left-aligned.
    expect(card).not.toMatch(/text-center/);
  });
});

describe("AC7 — server errors render through the registry Notice, not a second recipe", () => {
  const FORMS: [name: string, source: string][] = [
    ["SignInForm.tsx", readAuth("SignInForm.tsx")],
    ["SignUpForm.tsx", readAuth("SignUpForm.tsx")],
  ];

  it.each(FORMS)("%s renders Notice variant=error, guarded at the call site", (_name, source) => {
    expect(source).toMatch(/import \{ Notice \} from "@\/components\/ui\/Notice";/);
    expect(source).toMatch(/\{serverError && <Notice variant="error">\{serverError\}<\/Notice>\}/);
  });

  it.each(FORMS)("%s no longer imports the deleted ServerError component", (_name, source) => {
    expect(source).not.toMatch(/ServerError/);
  });
});

describe("AC8 — every credential field declares its autofill purpose", () => {
  // WCAG 2.1 AA §1.3.5 Identify Input Purpose, and the thing password managers and mobile
  // keyboards actually key on. Before this increment, `autocomplete` did not appear once
  // anywhere in src/.
  it("FormField forwards the prop to the input's autoComplete attribute", () => {
    const field = readAuth("FormField.tsx");
    expect(field).toMatch(/autocomplete\?: string;/);
    expect(field).toMatch(/autoComplete=\{autocomplete\}/);
  });

  it("sign-in declares email and current-password", () => {
    const form = readAuth("SignInForm.tsx");
    expect(form.match(/autocomplete="email"/g) ?? []).toHaveLength(1);
    expect(form.match(/autocomplete="current-password"/g) ?? []).toHaveLength(1);
  });

  it("sign-up declares email and two new-password fields", () => {
    const form = readAuth("SignUpForm.tsx");
    expect(form.match(/autocomplete="email"/g) ?? []).toHaveLength(1);
    expect(form.match(/autocomplete="new-password"/g) ?? []).toHaveLength(2);
  });
});

describe("the accessible names the E2E auth fixture locates by must not drift (AC11)", () => {
  // tests/e2e/auth.setup.ts uses getByLabel("Email", { exact: true }),
  // getByLabel("Password", { exact: true }) and getByRole("button", { name: "Sign in" }).
  // The exact:true guard matters because PasswordToggle's aria-label also contains
  // "password" — so that label is pinned here too.
  it("the sign-in form still labels Email and Password and submits as Sign in", () => {
    const form = readAuth("SignInForm.tsx");
    expect(form).toMatch(/label="Email"/);
    expect(form).toMatch(/label="Password"/);
    expect(form).toMatch(/>\s*Sign in\s*<\/SubmitButton>/);
  });

  it("the password toggle keeps its aria-label", () => {
    expect(readAuth("PasswordToggle.tsx")).toMatch(/aria-label=\{visible \? "Hide password" : "Show password"\}/);
  });

  it("FormField still pairs htmlFor with the input id", () => {
    const field = readAuth("FormField.tsx");
    expect(field).toMatch(/<label htmlFor=\{id\}/);
    expect(field).toMatch(/id=\{id\}/);
  });
});

describe("confirm-email — the emoji became a silent icon", () => {
  const page = readAuthPage("confirm-email.astro");

  it("renders a lucide icon marked aria-hidden instead of an emoji", () => {
    expect(page).toMatch(/import \{ CircleCheck, Mail \} from "lucide-react";/);
    expect(page).toMatch(/const Icon = isAutoConfirmed \? CircleCheck : Mail;/);
    expect(page).toMatch(/<Icon aria-hidden="true" className="text-muted-foreground mb-4 size-8" \/>/);
  });

  it("drops the emoji key while keeping the copy of both branches verbatim", () => {
    expect(page).not.toMatch(/emoji/);
    expect(page).toMatch(/heading: "Registration successful"/);
    expect(page).toMatch(/heading: "Check your email"/);
    expect(page).toMatch(/linkText: "Go to sign in"/);
    expect(page).toMatch(/linkText: "Back to sign in"/);
  });
});

describe("links are identifiable without colour (WCAG 1.4.1)", () => {
  it.each([
    ["signin.astro", readAuthPage("signin.astro")],
    ["signup.astro", readAuthPage("signup.astro")],
    ["confirm-email.astro", readAuthPage("confirm-email.astro")],
  ])("%s underlines its link at rest, not only on hover", (_name, source) => {
    expect(source).toMatch(/class="text-link[^"]*underline underline-offset-4"/);
    expect(source).not.toMatch(/hover:underline/);
  });
});
