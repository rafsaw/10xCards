---
project: "10xCards"
context_type: greenfield
created: 2026-05-20
updated: 2026-05-20
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: 2026-08-10
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction + decision paralysis — manual card creation interrupts reading AND the user doesn't always know what to turn into a card"
    - topic: "competitive insight"
      decision: "human-in-the-loop curation — existing AI flashcard tools either dump output directly into a deck or require awkward copy-paste; wedge is AI proposes, user accepts/edits/rejects each card before it enters study material"
    - topic: "primary persona scope"
      decision: "just the project author, dogfooding (single user for v1); auth included from day one to allow growth without retrofit"
    - topic: "auth strategy"
      decision: "email + password — classic signup/login flow"
    - topic: "role model"
      decision: "flat — every authenticated user manages their own cards; no admin, no sharing"
    - topic: "MVP scope-down moves"
      decision: "defer password reset and email verification (manual recovery only); simplest viable SR algorithm (Leitner-style, 2-state); binary right/wrong rating"
    - topic: "MVP scope kept (not cut)"
      decision: "manual card creation, edit-after-save, browse list, delete — all in v1 alongside the AI generation path"
    - topic: "MVP timeline"
      decision: "4 weeks of after-hours work; sustained-effort cost acknowledged"
    - topic: "candidate-card editing"
      decision: "DROPPED from MVP — AI candidates are accept-or-reject only. Editing happens post-save via the standard saved-card edit surface (FR-011). Consolidates editing into one UI."
  frs_drafted: 15
  quality_check_status: accepted
---

# 10xCards — Shape Notes

## Vision & Problem Statement

A technical self-learner reading dense material — AI, software engineering, or similar topics — wants to retain concepts using spaced repetition, but manually crafting question/answer cards while reading interrupts the flow enough that they skip it. They fall back to passive highlighting, postpone card creation until later and never return to it, and end up re-reading the same material at the cost of time and retention.

Existing AI flashcard tools either dump model output directly into a deck without per-card review, or require awkward copy-paste workflows between an LLM and a separate flashcard app. The insight is that the value is not faster generation alone — it is a curated, human-in-the-loop step where the AI proposes cards and the user accepts, edits, or rejects each one before it enters their study material. The user remains the authority on what gets memorized; the AI removes the typing friction.

## User & Persona

**Primary persona** — A technical self-learner (the project author for v1) reading dense technical material such as books and papers on AI and software engineering. They have a working understanding of spaced repetition and want to use it, but in practice skip the card-creation step because writing high-quality Q/A cards from prose interrupts reading. They want to paste a passage and get usable candidate cards in seconds, with the option to fix or discard any that don't capture what they meant to remember.

For v1 the persona is literally one user — dogfooding. Auth is included in the MVP anyway so the product can grow beyond a single user without a retrofit later.

## Access Control

Email + password authentication. Each user signs up with an email address and password, then logs in with those credentials. After login the user sees only their own cards.

Flat role model — every authenticated user manages their own cards. No admin role, no sharing between users, no public/anonymous routes beyond a landing/marketing surface.

Each user's cards are isolated from every other user's cards. Unauthenticated requests to any card-management route redirect to login.

Whether password-reset and email-verification flows are inside the MVP or deferred is decided in Phase 6 (Non-Goals); the authentication mechanism above stands regardless.

## Success Criteria

### Primary
- ≥ 75% of AI-generated candidate cards are accepted by the user (with or without edit) across the first several generation sessions. "Accepted" includes both accept-as-is and edit-then-accept; "rejected" counts as not accepted. This metric directly measures the wedge: AI quality high enough that the user prefers it to manual writing.

### Secondary
- Review sessions are reliable end-to-end: a user can start a review, work through all due cards, rate each one, and have progress saved without crashes or lost state across sessions.

### Guardrails
- A user can never see another user's cards. Cross-user data leakage is ship-blocking even if everything else works.
- If AI generation fails (timeout, error, rate limit), the user's pasted source text is preserved and they can retry without re-pasting.
- Review mode always offers something to study when cards are due, even if the SR algorithm's primary selection logic fails. Fallback: oldest-due card first.

## MVP Flow (sketched)

The smallest end-to-end flow that proves the product works:

1. User opens the app → login/signup screen.
2. User signs up (email + password) or logs in.
3. Dashboard appears with a clear primary action: "Generate flashcards from text."
4. User pastes a short passage from technical learning material and triggers generation.
5. AI returns a small set of candidate cards (front/back); the user reviews each candidate and either accepts (saves it as-is) or rejects (discards it). Editing of AI candidates is NOT in MVP — refinement of accepted cards happens later via the saved-card edit surface.
6. User starts a review session: the SR algorithm selects due cards, the user sees the front, reveals the back, rates recall as right/wrong, and the next-due date is scheduled.

**Also in MVP scope (beyond the smoke-test flow):**
- Manual card creation — separate form to type a card by hand (front + back), saved directly into the library without going through the candidate flow.
- Browse — list view of all saved cards.
- Edit — saved cards can be edited from the browse view (front and back are mutable).
- Delete — saved cards can be deleted from the browse view.
- Logout — explicit logout action.

**Scope-down moves applied in Phase 3:**
- Password reset and email verification deferred to v2. MVP supports manual recovery only (user contacts author by email).
- SR algorithm is the simplest viable option — Leitner-style 2-state bucketing. Binary right/wrong rating per card.

## Timeline acknowledgment

Acknowledged on 2026-05-20: the 4-week MVP requires sustained dedication and hard work across evenings/weekends. User accepted the cost up front; further mid-stream nagging about timeline is not warranted unless scope creep occurs.

## User Stories

### US-01: User generates and saves flashcards from a text passage

- **Given** a logged-in user is on the dashboard
- **When** they paste a passage of source text into the generation form and submit it
- **Then** the app returns a set of candidate cards (front/back) and the user can accept or reject each one independently
- **And** accepted candidates are saved to the user's library and disappear from the candidate list; rejected candidates are discarded with no save

#### Acceptance Criteria
- Generation produces at least 1 candidate for a passage of ≥ 200 words.
- Each candidate displays front and back text plus two actions: accept / reject.
- Accept saves the candidate to the library and removes it from the candidate list.
- Reject discards the candidate and removes it from the list; nothing is saved.
- If AI generation fails for any reason, the original source text remains in the form and the user can retry without re-pasting.
- After all candidates are resolved (accepted or rejected), the user returns to the dashboard or can paste a new passage.

### US-02: User reviews due cards using spaced repetition

- **Given** a logged-in user has at least one saved card whose next-due date is now or in the past
- **When** they start a review session
- **Then** the SR algorithm presents due cards one at a time; the user reveals the back of each card, rates recall as right or wrong, and the card's next-due date updates

#### Acceptance Criteria
- "Start review" is disabled or shows an empty-state message when no cards are due.
- Each card shows the front first; the user reveals the back, then rates recall as either "right" or "wrong" (binary; per FR-014).
- After rating, the SR algorithm updates the card's next-due date and the rating persists across sessions.
- The session continues until all due cards have been reviewed or the user exits.
- If SR algorithm selection fails for any reason, the session falls back to "oldest due first" (per Guardrails).

### US-03: User creates a flashcard manually

- **Given** a logged-in user is on the dashboard or card library
- **When** they open the "Create card" form, type a front and a back, and submit
- **Then** the card is saved to their library and is immediately available for review once it becomes due

#### Acceptance Criteria
- The create-card form has two required fields: front and back (both non-empty).
- Submitting the form saves the card and returns the user to the library list (with the new card visible) or clears the form for another entry.
- Validation prevents saving a card with an empty front or back.
- A manually-created card enters the SR lifecycle the same way an AI-generated accepted card does (initial due-date set per algorithm defaults).

## Functional Requirements

### Authentication
- FR-001: User can sign up with email and password. *Priority: must-have*
  > Socrates: Strongest counter — single-user v1 doesn't strictly need signup; the account could be DB-seeded. Resolution: stands. Multi-user-from-day-one was chosen in Phase 2 to avoid retrofit later; signup is the entry point that lets that future work without code changes.
- FR-002: User can log in with email and password. *Priority: must-have*
  > Socrates: Strongest counter — OAuth (Google/GitHub) is one button vs the email+password form and removes credential management from the codebase. Resolution: stands. Email+password was chosen in Phase 2 over OAuth for independence from third-party identity providers; switching restarts that decision.
- FR-003: User can log out. *Priority: must-have*
  > Socrates: Counter considered — session expiry handles logout implicitly; no explicit button needed. Resolution: stands. Explicit logout is cheap, expected, and supports the shared-device case (logging out before lending the laptop).

### AI generation
- FR-004: User can paste source text and trigger AI flashcard generation. *Priority: must-have*
  > Socrates: Counter considered — streaming generation (cards appear progressively) or file upload would improve UX. Resolution: stands. Request-response is simpler for v1; paste is the universal entry. File imports are explicitly excluded by the seed's non-MVP list.
- FR-005: User can view AI-generated candidate cards (front/back) before saving. *Priority: must-have*
  > Socrates: Counter considered — auto-save all generated cards and let the user delete bad ones later. Resolution: stands. Per-candidate review IS the product wedge; remove it and the product becomes a generic AI-dumps-cards-into-deck tool. Step 1 insight is at stake.
- FR-006: User can accept a candidate card, saving it to their library. *Priority: must-have*
  > Socrates: Counter considered — implicit acceptance (anything not rejected gets saved). Resolution: stands. Explicit per-candidate accept makes user intent clear and prevents accidental saves; matches the curation insight.
- FR-007: User can reject a candidate card, discarding it without saving. *Priority: must-have*
  > Socrates: Counter considered — batch reject or soft-reject with restore. Resolution: stands. Per-candidate hard reject is the simplest model; discarded cards leave no trace; matches the curation insight.
- FR-008: User can retry generation if it fails, without re-pasting the source text. *Priority: must-have*
  > Socrates: Counter considered — client-state retention handles this implicitly; the FR is over-specified. Resolution: stands. Explicit FR forces the property to hold even if the implementation evolves (multi-step form, navigation on success); matches the Guardrail.

### Manual card creation
- FR-009: User can manually create a card by typing front and back, saving it directly to the library. *Priority: must-have*
  > Socrates: Strongest counter — drop manual creation; AI-only in MVP, manual is v2. Resolution: stands. Manual creation is the fallback for cases AI handles poorly (single specific definitions, edge content). Explicit Phase 3 decision to keep it.

### Card management
- FR-010: User can view a list of their saved cards. *Priority: must-have*
  > Socrates: Counter considered — drop the list view; user only interacts via review session. Resolution: stands. Browse is the surface that hosts edit (FR-011) and delete (FR-012); without it those FRs have no UI.
- FR-011: User can edit a saved card's front and back. *Priority: must-have*
  > Socrates: Counter considered — immutable saved cards; delete and re-create on errors. Resolution: stands. Editing is the only refinement path now that candidate-edit was dropped; without it, a small typo means re-generation.
- FR-012: User can delete a saved card. *Priority: must-have*
  > Socrates: Counter considered — archive (soft-delete) instead of hard delete. Resolution: stands. Hard delete matches user intuition and privacy expectations; simpler data model. A confirmation dialog may be added in implementation without expanding scope.

### Review (spaced repetition)
- FR-013: User can start a review session; the SR algorithm selects due cards. *Priority: must-have*
  > Socrates: Counter considered — replace SR with random shuffle for radical simplification. Resolution: stands. SR is the integration point this product exists for; idea-notes explicitly lists "integration with a ready-made SR algorithm" in MVP.
- FR-014: User can rate their recall on each card during review using a binary right/wrong scale. *Priority: must-have*
  > Socrates: Counter considered — multi-level rating (SM-2's again/hard/good/easy) gives better scheduling. Resolution: stands. Binary matches the simplest-viable SR choice (Leitner) from Phase 3; smaller UI, simpler math; sophistication is a v2 lever.
- FR-015: User's review progress persists across sessions (next-due dates update per the SR algorithm). *Priority: must-have*
  > Socrates: Counter considered — localStorage instead of backend persistence. Resolution: stands. Auth + per-user data already imply backend; localStorage breaks cross-device support and loses progress on browser-data clears.

## Business Logic

Given a passage of source text, the application extracts the passage's key testable claims and phrases each as a question-answer pair; the user then reviews each candidate and accepts or rejects it, with accepted pairs entering a spaced-repetition lifecycle and rejected ones discarded.

The rule's input is a single passage of source text supplied by the user. Its output is a small set of question-answer pairs framed at the granularity of the passage's key claims — roughly one pair per claim — where the question is answerable from the passage and the answer is a single retrievable concept.

The transformation is the non-trivial work: identifying which claims in the passage are worth remembering, and phrasing each as a testable question-answer pair. This is what the application does that the user cannot easily do themselves while reading — it is the friction the product removes. The application does not claim correctness or completeness of the resulting pairs; it surfaces candidates and lets the user be the authority on what enters their study set.

The user encounters the rule's output immediately after submitting a passage, as a list of candidate cards. Each candidate is shown with two actions: accept (the candidate becomes a first-class card in the user's library and enters the spaced-repetition lifecycle, with an initial due-date scheduled) or reject (the candidate is discarded with no save). The same library can also contain cards the user created manually outside the AI path; both kinds participate identically in the SR lifecycle.

## Non-Functional Requirements

- A failed login does not lock out a legitimate user who mistypes their password three to five times in a row, but credential-stuffing at scale is rejected before reaching the authentication check.
- The product remains usable on the latest two major versions of the four mainstream desktop browsers (Chrome, Firefox, Safari, Edge). Mobile-browser usability is a baseline, not a first-class commitment.

## Non-Goals

- **Avoid: building our own SR algorithm.** Integrate a ready-made one (Leitner-style, biased by FR-014's binary rating). Prevents algorithm rabbit-holes that would torpedo the 4-week timeline.
- **Avoid: multi-format import (PDF, DOCX, EPUB, web URLs).** Plain-text paste only in v1. File ingestion and parsing is v2+.
- **Avoid: sharing flashcards or decks between users.** Single-tenant per user. Closes off team/social features explicitly.
- **Avoid: native mobile apps (iOS, Android).** Web only. Mobile-browser usability is in scope as a baseline, but no native shells.
- **Avoid: password reset and email verification flows in v1.** Manual support-email recovery only. Cuts the email-sending dependency from MVP scope.
- **Avoid: integrations with other platforms (Anki export, Quizlet sync, LMS integrations).** Self-contained product. Export/sync deferred to v2+.
- **Avoid: editing AI-generated candidates before saving.** Candidate cards are accept-or-reject only; refinement happens post-save via the standard saved-card edit surface (FR-011). Consolidates editing into one UI; explicit Phase 4 decision.

## Quality cross-check

All required greenfield elements present at finalization:

- **Access Control** — captured (email+password, flat role model, per-user isolation).
- **Business Logic (one-sentence rule)** — captured (transformation-emphasized; not empty-CRUD).
- **Project artifacts** — `shape-notes.md` exists with valid checkpoint frontmatter.
- **Timeline-cost acknowledged** — `mvp_weeks: 4` with explicit `## Timeline acknowledgment` block recording sustained-effort acceptance.
- **Non-Goals** — 7 entries covering both functional scope avoids (own SR algo, multi-format import, sharing, native mobile, integrations, password reset/verification, candidate-edit before save) and the existing user-base/scale framing.

No gaps surfaced. `quality_check_status: accepted`.
