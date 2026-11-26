---
name: supabase-migrations
description: Prepare Supabase schema changes for human deployment, or diagnose cloud schema drift and migration-dependent test failures.
---

# Supabase migrations

Agents prepare the SQL file in `supabase/migrations/` and exact commands for the human.
The human runs linking and migration commands; agents do not apply cloud migrations.

Include this sequence in the handoff, run from the repository root:

```sh
npx supabase link
npx supabase db push --dry-run
# Check the pending migration list before continuing.
npx supabase db push
```

Have the human check every pending migration, including older files, before pushing.
At the last deploy, the dry-run exposed an unpushed migration from PR #63:
`main` and the cloud schema had silently drifted. A merged PR does not prove deployment.

`link` asks for the database password, which is not `SUPABASE_KEY`.
If forgotten, reset it in the dashboard: Project Settings → Database. The app and CI do not use it.

A column rename is metadata-only; ship the migration and the code that uses it together.
`npm run test:integration` and `npm run test:e2e` hit the cloud project configured in `.env`;
run them after the human applies the migration, since they depend on the updated schema.
