# Repository Guidelines

## Project Structure & Module Organization

This is an Astro 6 app with React islands, TypeScript, Tailwind CSS 4, Supabase Auth, and Cloudflare Workers deployment.

- `src/pages/` contains route pages and API endpoints, including `src/pages/api/auth/*.ts`.
- `src/components/` contains reusable Astro and React components; shared primitives live in `src/components/ui/`.
- `src/layouts/` contains Astro layouts, and `src/styles/global.css` holds global styles.
- `src/lib/` contains shared helpers such as Supabase setup and config checks.
- `public/` stores static assets served as-is.
- `supabase/` stores local Supabase configuration.
- `context/` contains product, architecture, and change notes.

## Build, Test, and Development Commands

Use Node `22.14.0` from `.nvmrc`.

- `npm install` installs dependencies.
- `npm run dev` starts the Astro development server.
- `npm run build` creates the production build for Cloudflare.
- `npm run preview` previews the built app locally.
- `npm run lint` runs type-aware ESLint rules.
- `npm run lint:fix` applies safe ESLint fixes.
- `npm run format` formats files with Prettier.
- `npx astro sync` refreshes Astro-generated types; CI runs this before lint/build.

## Coding Style & Naming Conventions

Use TypeScript for application logic and keep pages/layouts in `.astro` files. Prettier enforces 2-space indentation, semicolons, double quotes, `printWidth: 120`, and trailing commas. ESLint uses strict type-checked TypeScript, React Hooks, React Compiler, Astro, and JSX accessibility rules. Prefix intentionally unused variables or parameters with `_`.

Name React components in `PascalCase.tsx`, route files with lowercase path names, and utilities with descriptive lowercase or kebab-case names.

## Testing Guidelines

No dedicated test runner is configured yet. For now, validate changes with:

1. `npm run lint`
2. `npm run build`
3. Manual checks of affected routes, especially `/auth/*` and `/dashboard`.

If adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files and document the new command in `package.json`.

## Commit & Pull Request Guidelines

Recent history uses short, task-oriented messages, often prefixed with the lesson or tool context, for example `m1l4 - ...` or `10x @latest get m1l3 ...`. Keep commits concise and imperative, and mention the area changed when useful.

Pull requests should include a clear summary, validation steps, linked issue or lesson context when applicable, and screenshots for visible UI changes. Ensure CI passes on `master` targets.

## Security & Configuration Tips

Copy `.env.example` to `.env` and `.dev.vars` for local work. Never commit real `SUPABASE_URL` or `SUPABASE_KEY` values. Store production secrets in Cloudflare and GitHub repository secrets.
