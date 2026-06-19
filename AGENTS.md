# Repository Guidelines

10xCards is an AI-assisted spaced-repetition flashcard MVP: Astro 6, React 19, TypeScript, Tailwind 4, Supabase Auth, Cloudflare Workers. Core slices are built (AI generation, atomic save, manual CRUD, SRS review, account deletion); see `context/foundation/roadmap.md` for slice status.

## Agent Tripwires

- Committing runs `npx lint-staged` (`.husky/pre-commit`): `eslint --fix` on staged `*.{ts,tsx,astro}`, `prettier --write` on `*.{json,css,md}`. Expect staged files to change — re-stage after.
- CI (`@.github/workflows/ci.yml`) triggers only on `master`, but the working branch is `main` — so CI does not currently run. Do not assume a green gate.
- Never overwrite `context/` — the 10x-workflow source of truth (PRD, tech-stack, plans). `context/archive/**` and `context/foundation/archive/**` are immutable.
- Edits inside `CLAUDE.md`'s `<!-- BEGIN/END @przeprogramowani/10x-cli -->` markers are lost on the next `10x get` — put durable guidance above the first marker.

## Project Structure & Module Organization

- `src/pages/` — routes and API endpoints (`src/pages/api/auth/*.ts`).
- `src/components/` — Astro/React components; primitives in `ui/`, auth forms in `auth/`.
- `src/layouts/` Astro layouts; `src/styles/global.css` global styles.
- `src/lib/` — shared helpers (Supabase setup, config checks).
- `src/middleware.ts` enforces route protection via `PROTECTED_ROUTES`.
- `public/` assets; `supabase/` local config; `context/` 10x-workflow notes.

## Build, Test, and Development Commands

Node `22.14.0` (`.nvmrc`); install with `npm install`.

- `npm run dev` / `preview` — dev server and production preview.
- `npm run build` — production build for Cloudflare.
- `npm run lint` / `lint:fix` — type-aware ESLint, optionally auto-fixing.
- `npm run typecheck` — `astro sync && astro check`.
- `npm run format` — Prettier across the repo.
- `npm test` / `test:watch` — Vitest unit tests; `npm run test:integration` — Vitest integration suite (`vitest.integration.config.ts`).
- `npm run test:e2e` — Playwright end-to-end tests (`tests/e2e/`).
- `npx astro sync` — regenerate Astro types; CI runs this before lint/build.

## Coding Style & Naming Conventions

Write application logic in TypeScript; keep pages and layouts as `.astro` files. Formatting follows `@.prettierrc.json` (`printWidth: 120`, double quotes). ESLint runs strict type-checked TypeScript plus React Hooks, React Compiler, Astro, and jsx-a11y rules; prefix intentionally unused identifiers with `_`.

Name React components `PascalCase.tsx`, route files with lowercase paths, and utilities lowercase or kebab-case.

## Testing Guidelines

Vitest is the runner: unit/integration specs are colocated as `*.test.ts` / `*.integration.test.ts` next to source (e.g. `src/pages/api/reviews.test.ts`), with a shared harness, two-user fixture, and scoped Supabase mock under `test/integration/`. Playwright drives end-to-end specs in `tests/e2e/` (auth setup/teardown included; see `tests/e2e/AGENTS.md`). Stryker (`@stryker-mutator/vitest-runner`) is available for mutation testing.

Validate changes with `npm run lint`, `npm run build`, the relevant test suite (`npm test`, `npm run test:integration`, and/or `npm run test:e2e`), and manual checks of affected routes (`/auth/*`, `/dashboard`, `/library`, `/generate`, `/review`). New tests: colocate `*.test.ts`/`*.test.tsx`; integration specs use the `test/integration/` harness, E2E specs follow `/10x-e2e`.

## Commit & Pull Request Guidelines

Recent history uses short, task-oriented messages prefixed with lesson/tool context (`m1l4 - ...`). Match it: imperative mood, subject ≤ ~72 characters, same lesson/tool prefix.

PRs should include a summary, validation steps, lesson/issue context, and screenshots for UI changes. Lint and build locally before pushing — CI does not gate `main` (see Agent Tripwires).

## Security & Configuration Tips

Copy `.env.example` to `.env` and `.dev.vars`; see `@README.md` for full Supabase setup. Never commit real `SUPABASE_URL`/`SUPABASE_KEY` values; store production secrets in Cloudflare and GitHub repository secrets.
