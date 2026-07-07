#!/usr/bin/env bash
#
# Render the code-review agent's JSON output into a Markdown PR comment.
#
# Usage: format-comment.sh <review.json> [truncated:true|false]
# Writes the comment to stdout.
#
# Kept as a standalone script (not inline in action.yml) so the formatting can be
# exercised locally against a sample JSON fixture without spinning up the agent —
# that local shell run is Phase 2's automated check for comment well-formedness.
#
# Input JSON contract (produced by `npm run ci`, see packages/code-reviewer/src/ci.ts):
#   { summary, criteria: { <key>: { score, rationale } }, findings?[], overall, pass }
set -euo pipefail

REVIEW_JSON="${1:?usage: format-comment.sh <review.json> [truncated]}"
TRUNCATED="${2:-false}"

pass=$(jq -r '.pass' "$REVIEW_JSON")
summary=$(jq -r '.summary' "$REVIEW_JSON")
# Round the mean to one decimal place for display (e.g. 7.1666… -> 7.2).
overall=$(jq -r '(.overall * 10 | round) / 10' "$REVIEW_JSON")

if [ "$pass" = "true" ]; then
  badge="✅ Passed"
else
  badge="❌ Failed"
fi

# Hidden marker reserved for a future single-canonical-comment dedup pass; this
# MVP still posts a new comment per run.
# printf '<!-- ai-code-review -->\n'
printf '## 🤖 AI Code Review — %s\n\n' "$badge"
printf '%s\n\n' "$summary"

# Plan alignment: the explicit diff↔plan comparison. Present only on the plan-aware
# path (the `readPlan` tool read a change's plan.md); rendered as its own section so
# the comparison is unmistakable instead of buried in the summary prose. Each bucket
# is always shown — an empty one prints "_none_" so "Missing: none" is stated.
has_plan_alignment=$(jq -r 'if .planAlignment then "true" else "false" end' "$REVIEW_JSON")
if [ "$has_plan_alignment" = "true" ]; then
  printf '### Plan alignment\n\n'
  plan_found=$(jq -r '.planAlignment.planFound' "$REVIEW_JSON")
  if [ "$plan_found" != "true" ]; then
    printf '> ℹ️ No implementation plan found for this change — reviewed the diff only.\n\n'
  else
    # Sanitize newlines in each item so a multi-line entry can't break the list.
    jq -r '
      .planAlignment as $p
      | [
          ["✅ Implemented", $p.implemented],
          ["❌ Missing",     $p.missing],
          ["➕ Scope drift", $p.scopeDrift],
          ["❓ Out of plan", $p.outOfPlan]
        ]
      | map(
          "**\(.[0])**\n\n"
          + ( if (.[1] | length) > 0
              then (.[1] | map("- \(. | gsub("\n"; " "))") | join("\n"))
              else "- _none_" end )
          + "\n"
        )
      | join("\n")
    ' "$REVIEW_JSON"
    printf '\n'
    if [ "$TRUNCATED" = "true" ]; then
      printf '> ⚠️ The code diff was truncated (12 KB cap), but the **plan was read in full** via the `readPlan` tool; "Missing" may list code the reviewer did not see.\n\n'
    fi
  fi
fi

printf '### Scores\n\n'
printf '| Criterion | Score | Notes |\n'
printf '| --- | --- | --- |\n'
# Fixed display order/labels for the six criteria. Sanitize each rationale so a
# stray newline or pipe can't break the table row.
jq -r '
  .criteria as $c
  | [
      ["Implementation correctness",   $c.implementationCorrectness],
      ["Idiomaticity",                 $c.idiomaticity],
      ["Complexity & maintainability", $c.complexityMaintainability],
      ["Tests & risk coverage",        $c.testsRiskCoverage],
      ["Documentation",                $c.documentation],
      ["Security & safety",            $c.securitySafety]
    ]
  | map("| \(.[0]) | \(.[1].score)/10 | \(.[1].rationale | gsub("\n"; " ") | gsub("[|]"; "\\|")) |")
  | .[]
' "$REVIEW_JSON"
printf '| **Overall** | **%s/10** | mean of the six criteria |\n\n' "$overall"

printf '**Verdict:** %s — pass requires overall ≥ 6 **and** correctness ≥ 6 **and** security ≥ 6.\n\n' "$badge"

if [ "$TRUNCATED" = "true" ]; then
  printf '> ⚠️ Review based on a **truncated diff** (capped at 12 KB); some changes were not analyzed.\n\n'
fi

# Findings are optional in the schema; only render the section when present.
findings_count=$(jq -r '(.findings // []) | length' "$REVIEW_JSON")
if [ "$findings_count" -gt 0 ]; then
  printf '### Findings\n\n'
  jq -r '
    (.findings // [])
    | map(
        "- **[\(.severity)]** \(.title) — \(.detail | gsub("\n"; " "))"
        + (if .suggestion then " _Suggestion: \(.suggestion | gsub("\n"; " "))_" else "" end)
      )
    | .[]
  ' "$REVIEW_JSON"
  printf '\n'
fi

printf -- '---\n'
printf '_Advisory only — this review does not block merge._\n'
