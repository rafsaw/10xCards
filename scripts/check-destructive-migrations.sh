#!/usr/bin/env bash
#
# Guards the escape hatch in BACKWARD_COMPATIBILITY.md section 2.
#
# Expand/migrate/contract is the default path for a schema change. A PR may
# still break the schema deliberately, but then the break has to be declared
# where tooling can see it, not only in prose: the PR carries the `risk-high`
# label AND a `## Deploy order` section in its body.
#
# Run in CI from the `migration-guard` job. Locally:
#
#   BASE_SHA=main HEAD_SHA=HEAD PR_BODY="$(cat body.md)" \
#     PR_LABELS='["risk-high"]' ./scripts/check-destructive-migrations.sh
#
# Exit 0 = nothing destructive, or destructive and properly discharged.
# Exit 1 = destructive and under-declared. Exit 2 = called wrong.

set -euo pipefail

: "${BASE_SHA:?BASE_SHA is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"
PR_BODY="${PR_BODY:-}"
PR_LABELS="${PR_LABELS:-[]}"

MIGRATIONS_DIR="supabase/migrations"

# Statements BACKWARD_COMPATIBILITY.md section 2 calls breaking against a table
# the deployed Worker reads. `set not null` is here because the doc treats a new
# NOT NULL without a default and a backfill as breaking; a reviewer still has to
# judge which of the two it is, so the check only demands the declaration.
DESTRUCTIVE_PATTERN='drop[[:space:]]+table|drop[[:space:]]+column|rename[[:space:]]+column|rename[[:space:]]+to|alter[[:space:]]+column[[:space:]]+[^;]*[[:space:]]type[[:space:]]|set[[:space:]]+not[[:space:]]+null|drop[[:space:]]+policy'

# Added or modified migrations only: a PR is not answerable for history. Three-dot
# so the comparison is against the merge-base, matching the review's fixed point.
mapfile -t changed < <(
  git diff --name-only --diff-filter=AM "$BASE_SHA...$HEAD_SHA" -- "$MIGRATIONS_DIR/*.sql" || true
)

if [ ${#changed[@]} -eq 0 ]; then
  echo "migration-guard: no migration added or modified in this PR."
  exit 0
fi

echo "migration-guard: inspecting ${#changed[@]} migration file(s):"
printf '  %s\n' "${changed[@]}"

# Strip `--` comments before matching, so a header that explains a past rename
# does not trip the check. Block comments are not used in this repo's migrations.
findings=()
for f in "${changed[@]}"; do
  [ -f "$f" ] || continue
  while IFS= read -r hit; do
    findings+=("$f: $hit")
  done < <(
    sed -e 's/--.*$//' "$f" |
      grep -inE "$DESTRUCTIVE_PATTERN" |
      sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]\+/ /g' || true
  )
done

if [ ${#findings[@]} -eq 0 ]; then
  echo "migration-guard: no destructive statement found. Nothing to declare."
  exit 0
fi

echo
echo "migration-guard: destructive statement(s) found:"
printf '  %s\n' "${findings[@]}"

has_label=no
# Compare against the JSON array as whole tokens, so `risk-high-ish` never counts.
if printf '%s' "$PR_LABELS" | grep -qE '"risk-high"'; then
  has_label=yes
fi

has_deploy_order=no
if printf '%s' "$PR_BODY" | grep -qiE '^[[:space:]]*#{2,}[[:space:]]*deploy order'; then
  has_deploy_order=yes
fi

echo
echo "  risk-high label:          $has_label"
echo "  '## Deploy order' section: $has_deploy_order"

if [ "$has_label" = yes ] && [ "$has_deploy_order" = yes ]; then
  echo
  echo "migration-guard: deliberate break, declared. Passing."
  echo "The reviewer still owns whether expand/migrate/contract was the better path."
  exit 0
fi

cat <<'MSG'

migration-guard: FAILED.

A destructive schema statement needs the expand/migrate/contract path in
BACKWARD_COMPATIBILITY.md section 2 — additive migration first, code that
tolerates both shapes next, the drop in a later PR.

Taking the break in one PR is still allowed, but it has to be declared where
tooling can see it. Add both:

  1. the `risk-high` label on this PR;
  2. a `## Deploy order` section in the PR body saying what has to happen at
     deploy time, in what order, and what breaks in the window between.

MSG
exit 1
