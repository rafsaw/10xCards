---
name: supabase-migrations
description: Prepare Supabase schema changes for human deployment, or diagnose cloud schema drift and migration-dependent test failures.
---

# Supabase migrations

Agents prepare the SQL file in `supabase/migrations/` and hand the human
[`scripts/deploy-migrations.sh`](../../../scripts/deploy-migrations.sh).
The human runs linking and migration commands; agents do not apply cloud migrations.

Hand off this command, run from the repository root:

```sh
./scripts/deploy-migrations.sh
```

The wizard handles linking, dry-run review with explicit approval, pushing, and integration tests.
Agents hand off the script instead of executing it or repeating its raw command sequence.

Have the human check every pending migration, including older files, before pushing.
At the last deploy, the dry-run exposed an unpushed migration from PR #63:
`main` and the cloud schema had silently drifted. A merged PR does not prove deployment.

A column rename is metadata-only; ship the migration and the code that uses it together.
`npm run test:integration` and `npm run test:e2e` hit the cloud project configured in `.env`;
run them after the human applies the migration, since they depend on the updated schema.
