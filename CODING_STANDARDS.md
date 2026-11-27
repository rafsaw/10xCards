# Coding standards

The judgement calls for 10xCards — Astro 6 (`output: "server"`, Cloudflare adapter), React 19 islands, TypeScript, Tailwind 4, Supabase with RLS, Vitest, Playwright.

Read during review, not implementation. Everything a tool can decide is left to the tool: Prettier owns formatting, type-aware ESLint owns `any`, non-null `!`, unused identifiers, hook rules and a11y, `astro check` owns types, and `migration-guard` owns destructive migrations. A rule that lands here is one no check could substitute for. The severity-graded, repo-specific checklist is `CODE_REVIEW.md`; this file is the smaller set of calls that need a reader's judgement.

## The why lives in exactly one place

A decision's rationale has one home. A migration header, a code comment, or a README that restates an ADR's reasoning is duplication: two copies drift, and the reader cannot tell which one is current.

```sql
-- SM-2 replaces Leitner Boxes as the review schedule (see docs/adr/0002-sm2-for-review-schedule.md).
alter table public.cards rename column box to repetition;
```

One line naming the decision and where it lives, then the statement. Not the trade-off, not the rejected alternatives, not what it means for existing rows — that is the ADR's job.

Three homes, three genres:

- **ADR** (`docs/adr/`) — the decision and the costs accepted with it. A paragraph is a complete ADR; see the format the `domain-modeling` skill carries.
- **Algorithm doc** (`docs/sm2-algorithm.md` is the model) — the arithmetic, and the oracle tests are worked out from. Never derived from the implementation: when the doc and the code disagree, the code is wrong.
- **Code comment** — how _this_ line does it, and the trap that is not visible from reading it.

Flag the restatement, not the pointer. More pointers to one source is the goal.

## Narrow a value rather than asserting it

A value that can be absent gets a check, and the check is what the rest of the function reads. This is the standard the type checker cannot finish for you: it catches `!` and `any`, but not a narrowing that TypeScript legitimately drops again.

```ts
// `marker` is `string | null` on the describe scope; the narrowing does not
// survive into a callback, so hold the narrowed value.
const front = marker;
if (!front) throw new Error("marker not set");
await page.getByRole("textbox", { name: "Front" }).fill(front);
```

Request bodies arrive as `unknown` and are narrowed by hand — `asNonEmptyString` in `src/pages/api/cards.ts` is the reference pattern. There is no schema-validation library in this project; do not introduce one in passing.

## Say what is true, not what is reassuring

A comment, a test name, or a PR body that claims more than the code delivers is worse than silence: the next reader stops checking. Prefer the honest narrower claim.

```ts
// Pins the two label lists to each other.
// NOT: "keeps the labels from being a second source of truth" — they still are.
```

The same bar applies to evidence. "Validation gate green" means the gate ran, all of it; a suite that could not run gets named as unrun, not omitted. A test whose name states a risk it does not exercise is a finding even when it passes — verify it by breaking the thing it guards.

## One source of truth for a contract the tests bind to

When a literal appears in both the code and a test that greps the code, say which one leads. `src/components/review/review-paper.test.ts` asserts on `ReviewSession.tsx`'s source text, so a class string, an `aria-keyshortcuts` value or a label is pinned in two places at once. Two live with it:

- `prettier-plugin-tailwindcss` reorders class strings, so write the assertion against formatted source, never against what you typed.
- A test rewritten to match a change it was meant to catch has stopped being a test. Changing the assertion is fine when the contract changed on purpose; say so.

## Match the surrounding file

The file wins on anything local to it: naming, the shape of a helper, how errors are threaded. A diff that is internally consistent and locally conventional is better than one that is globally tidy and reads as an import from another codebase.

This never overrides a rule above it. Where a file contradicts one of those, the rule wins and the file is what to fix — a long migration header does not license the next long migration header. Fix it in the same diff when it is the file you are already touching, and raise it as a finding when it is not.
