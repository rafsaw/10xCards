<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Saved Card Library (S-03)

- **Plan**: context/changes/deck-edit-delete/plan.md
- **Scope**: All phases (1–3 of 3)
- **Date**: 2026-06-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (lint scoped to change — see note) |

## Notes

- **Plan adherence**: every planned change verified MATCH — POST `/api/cards`; PATCH/DELETE `/api/cards/[id]`; `library.astro` server-fetch + islands; `CreateCardForm`; `CardList`; `CardRow`; `/library` added to `PROTECTED_ROUTES`; dashboard CTA. PATCH payload is `{front, back}` only — the critical "no schedule reset on edit" guardrail holds. RLS-as-security-boundary, page-reload-on-mutation, and `.eq("status","saved")` draft-exclusion guards all align with intent.
- **Scope discipline**: no scope creep. Only additions beyond the plan are defensive id-missing 400 guards in the PATCH/DELETE handlers — reasonable, not flagged.
- **Investigated and dismissed**: both review sub-agents flagged `React.SubmitEvent<HTMLFormElement>` (CreateCardForm.tsx:25) as an invalid type. Verified it IS a real interface in this repo's React 19 `@types/react` (`interface SubmitEvent<T = Element>` at index.d.ts:2168) and is used consistently across existing siblings (PasteAndGenerateForm, DraftReviewList). Not a bug.
- **Success criteria**: `npm run build` passes (exit 0); Phase 3 files lint clean (exit 0). Full-repo `npm run lint` remains red on PRE-EXISTING, unrelated issues — Windows CRLF line endings across all committed files (core.autocrlf=true, no .gitattributes) and two `.claude/hooks/*.mjs` tsconfig project-service parse errors. User accepted scoping lint verification to the change. A durable fix would be a `.gitattributes` (`* text=auto eol=lf`) + renormalize — worth a separate change.

## Findings

### F1 — No explicit re-entrancy guard on Save/Delete handlers

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/components/library/CardRow.tsx:63, :88; src/components/library/CreateCardForm.tsx:25
- **Detail**: handleSave / handleDelete rely solely on `disabled={pending}` to prevent double-submit; no `if (pending) return;` belt-and-suspenders. Delete is additionally guarded by the synchronous `window.confirm`. Identical to existing siblings (PasteAndGenerateForm, DraftReviewList) — consistent, not a regression. Real double-fire likelihood is very low.
- **Fix**: (optional) add `if (pending) return;` at the top of each handler.
- **Decision**: SKIPPED — benign, matches repo pattern.

### F2 — Dead fallback-message branch

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/library/CardRow.tsx:39
- **Detail**: `message: message || FALLBACK_MESSAGES[code]` — `message` is always a non-empty string at that point, so the fallback branch is effectively dead. Harmless; identical to the sibling pattern.
- **Decision**: SKIPPED — cosmetic, matches repo pattern.

### F3 — db_error fallback text reused for delete

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/library/CardRow.tsx:20
- **Detail**: `FALLBACK_MESSAGES.db_error` ("Could not save the change.") is shared by PATCH and DELETE failures. Cosmetic only — the server's actual message ("Could not delete the card.") is what the user sees (see F2).
- **Decision**: SKIPPED — cosmetic, never surfaced to user.
