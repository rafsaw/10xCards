---
project: "10xCards"
version: 1
status: draft
created: 2026-05-20
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: 2026-08-10
  after_hours_only: true
---

# 10xCards — Product Requirements Document

## Vision & Problem Statement

A technical self-learner reading dense material — AI, software engineering, or similar topics — wants to retain concepts using spaced repetition, but manually crafting question/answer cards while reading interrupts the flow enough that they skip it. They fall back to passive highlighting, postpone card creation until later and never return to it, and end up re-reading the same material at the cost of time and retention.

Existing AI flashcard tools either dump model output directly into a deck without per-card review, or require awkward copy-paste workflows between an LLM and a separate flashcard app. The insight is that the value is not faster generation alone — it is a curated, human-in-the-loop workflow where the AI proposes candidate cards and the user explicitly accepts or rejects them before they enter study material. The user remains the authority on what gets memorized; the AI removes the friction of transforming source material into study-ready flashcards.

## User & Persona

**Primary persona** — A technical self-learner (the project author for v1) reading dense technical material such as books and papers on AI and software engineering. They have a working understanding of spaced repetition and want to use it, but in practice skip the card-creation step because writing high-quality Q/A cards from prose interrupts reading. They want to paste a passage and get usable candidate cards in seconds, deciding which ones deserve to enter their study set.

For v1 the persona is literally one user — dogfooding. The product is intentionally implemented as a multi-user web application from day one, so access control and per-user data isolation are built into the architecture rather than retrofitted later.

## Success Criteria

### Primary
- AI-generated flashcards are useful enough that the user repeatedly chooses the AI generation workflow instead of abandoning it in favor of manual-only creation.

### Secondary
- Review sessions are reliable end-to-end: a user can start a review, work through all due cards, rate each one, and have progress saved without crashes or lost state across sessions.

### Guardrails
- A user can never see another user's cards. Cross-user data leakage is ship-blocking even if everything else works.
- If AI generation fails (timeout, error, rate limit), the user's pasted source text is preserved and they can retry without re-pasting.
- Review mode always offers something to study when cards are due, even if the spaced-repetition selection logic fails. Fallback: oldest-due card first.

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
- **Then** the app presents due cards one at a time; the user reveals the back of each card, rates recall as right or wrong, and the card's next-due date updates

#### Acceptance Criteria
- "Start review" is disabled or shows an empty-state message when no cards are due.
- Each card shows the front first; the user reveals the back, then rates recall as either "right" or "wrong" (binary; per FR-014).
- After rating, the card's next-due date is updated and the rating persists across sessions.
- The session continues until all due cards have been reviewed or the user exits.
- If the primary due-card selection fails for any reason, the session falls back to "oldest due first" (per Guardrails).

### US-03: User creates a flashcard manually

- **Given** a logged-in user is on the dashboard or card library
- **When** they open the "Create card" form, type a front and a back, and submit
- **Then** the card is saved to their library and is immediately available for review once it becomes due

#### Acceptance Criteria
- The create-card form has two required fields: front and back (both non-empty).
- Submitting the form saves the card and returns the user to the library list (with the new card visible) or clears the form for another entry.
- Validation prevents saving a card with an empty front or back.
- A manually-created card enters the spaced-repetition lifecycle the same way an AI-generated accepted card does (initial due-date set per default scheduling).

## Functional Requirements

### Authentication
- FR-001: User can sign up with email and password. Priority: must-have
  > Socratic: Strongest counter — single-user v1 doesn't strictly need signup; the account could be seeded. Resolution: stands. Multi-user-from-day-one was chosen to avoid retrofit later; signup is the entry point that lets that future work without code changes.
- FR-002: User can log in with email and password. Priority: must-have
  > Socratic: Strongest counter — third-party identity (e.g. social login) is one button vs the email+password form and removes credential management from the codebase. Resolution: stands. Email+password was chosen for independence from third-party identity providers; switching restarts that decision.
- FR-003: User can log out. Priority: must-have
  > Socratic: Counter considered — session expiry handles logout implicitly; no explicit button needed. Resolution: stands. Explicit logout is cheap, expected, and supports the shared-device case (logging out before lending the laptop).

### AI generation
- FR-004: User can paste source text and trigger AI flashcard generation. Priority: must-have
  > Socratic: Counter considered — progressive generation (cards appear as produced) or file upload would improve UX. Resolution: stands. Request-response is simpler for v1; paste is the universal entry. File imports are explicitly excluded by the non-MVP list.
- FR-005: User can view AI-generated candidate cards (front/back) before saving. Priority: must-have
  > Socratic: Counter considered — auto-save all generated cards and let the user delete bad ones later. Resolution: stands. Per-candidate review IS the product wedge; remove it and the product becomes a generic AI-dumps-cards-into-deck tool. The core insight is at stake.
- FR-006: User can accept a candidate card, saving it to their library. Priority: must-have
  > Socratic: Counter considered — implicit acceptance (anything not rejected gets saved). Resolution: stands. Explicit per-candidate accept makes user intent clear and prevents accidental saves; matches the curation insight.
- FR-007: User can reject a candidate card, discarding it without saving. Priority: must-have
  > Socratic: Counter considered — batch reject or soft-reject with restore. Resolution: stands. Per-candidate hard reject is the simplest model; discarded cards leave no trace; matches the curation insight.
- FR-008: User can retry generation if it fails, without re-pasting the source text. Priority: must-have
  > Socratic: Counter considered — implicit state retention handles this without an explicit FR. Resolution: stands. Explicit FR forces the property to hold even if the implementation evolves (multi-step form, navigation on success); matches the Guardrail.

### Manual card creation
- FR-009: User can manually create a card by typing front and back, saving it directly to the library. Priority: must-have
  > Socratic: Strongest counter — drop manual creation; AI-only in MVP, manual is v2. Resolution: stands. Manual creation is the fallback for cases AI handles poorly (single specific definitions, edge content). Explicit decision to keep it.

### Card management
- FR-010: User can view a list of their saved cards. Priority: must-have
  > Socratic: Counter considered — drop the list view; user only interacts via review session. Resolution: stands. Browse is the surface that hosts edit (FR-011) and delete (FR-012); without it those FRs have no UI.
- FR-011: User can edit a saved card's front and back. Priority: must-have
  > Socratic: Counter considered — immutable saved cards; delete and re-create on errors. Resolution: stands. Editing is the only refinement path now that candidate-edit was dropped; without it, a small typo means re-generation.
- FR-012: User can delete a saved card. Priority: must-have
  > Socratic: Counter considered — archive (soft-delete) instead of hard delete. Resolution: stands. Hard delete matches user intuition and privacy expectations; simpler model. A confirmation step may be added in implementation without expanding scope.

### Review (spaced repetition)
- FR-013: User can start a review session that presents due cards. Priority: must-have
  > Socratic: Counter considered — replace spaced repetition with random shuffle for radical simplification. Resolution: stands. Spaced repetition is the integration point this product exists for; it is explicitly the core review behavior in MVP.
- FR-014: User can rate their recall on each card during review using a binary right/wrong scale. Priority: must-have
  > Socratic: Counter considered — multi-level rating (e.g. again/hard/good/easy) gives better scheduling. Resolution: stands. Binary matches the deliberately simplified MVP scheduling model. Smaller UI, simpler logic, lower implementation risk. Sophistication is a v2 lever.
- FR-015: User's review progress persists across sessions (next-due dates update per the scheduling model). Priority: must-have
  > Socratic: Counter considered — purely local persistence instead of central persistence. Resolution: stands. Authenticated, per-user data already implies central persistence; local-only would break cross-device support and lose progress on browser-data clears.

## Non-Functional Requirements

- Authentication protects against common abuse patterns without degrading normal user access (legitimate retypes after a mistype still succeed; high-volume credential guessing at scale is rejected before reaching the auth check).
- A user's cards and review progress are visible only to that user; no path through the product surfaces another user's data, ever.
- When AI generation takes more than a couple of seconds, the user sees continuous visible feedback that the request is in flight, not a frozen UI.
- The product remains usable on the latest two major versions of the four mainstream desktop browsers (Chrome, Firefox, Safari, Edge). Mobile-browser usability is a baseline, not a first-class commitment.

## Business Logic

Given a passage of source text, the application extracts the passage's key testable claims and phrases each as a question-answer pair; the user then reviews each candidate and accepts or rejects it, with accepted pairs entering a spaced-repetition lifecycle and rejected ones discarded.

The rule's input is a single passage of source text supplied by the user. Its output is a small set of question-answer pairs framed at the granularity of the passage's key claims — roughly one pair per claim — where the question is answerable from the passage and the answer is a single retrievable concept.

The transformation is the non-trivial work: identifying which claims in the passage are worth remembering, and phrasing each as a testable question-answer pair. This is what the application does that the user cannot easily do themselves while reading — it is the friction the product removes. The application does not claim correctness or completeness of the resulting pairs; it surfaces candidates and lets the user be the authority on what enters their study set.

The user encounters the rule's output immediately after submitting a passage, as a list of candidate cards. Each candidate is shown with two actions: accept (the candidate becomes a first-class card in the user's library and enters the spaced-repetition lifecycle, with an initial due-date scheduled) or reject (the candidate is discarded with no save). The same library can also contain cards the user created manually outside the AI path; both kinds participate identically in the spaced-repetition lifecycle.

## Access Control

Email + password authentication. Each user signs up with an email address and password, then logs in with those credentials. After login the user sees only their own cards.

Flat role model — every authenticated user manages their own cards. No admin role, no sharing between users, no public/anonymous routes beyond a landing/marketing surface.

Each user's cards are isolated from every other user's cards. Unauthenticated requests to any card-management route redirect to login.

Password reset and email verification flows are explicitly deferred from MVP scope (see Non-Goals); the authentication mechanism above stands regardless.

## Non-Goals

- **Avoid: advanced spaced-repetition algorithm engineering.** The MVP uses a deliberately simple scheduling model rather than sophisticated optimization logic. Sophistication is a v2 lever.
- **Avoid: multi-format import (PDF, DOCX, EPUB, web URLs).** Plain-text paste only in v1. File ingestion and parsing is v2+.
- **Avoid: sharing flashcards or decks between users.** Single-tenant per user. Closes off team/social features explicitly.
- **Avoid: native mobile apps (iOS, Android).** Web only. Mobile-browser usability is in scope as a baseline, but no native shells.
- **Avoid: password reset and email verification flows in v1.** Authentication is limited to signup, login, logout, and session handling. Manual recovery only.
- **Avoid: integrations with other platforms (Anki export, Quizlet sync, LMS integrations).** Self-contained product. Export/sync deferred to v2+.
- **Avoid: editing AI-generated candidates before saving.** Candidate cards are accept-or-reject only; refinement happens post-save via the standard saved-card edit surface (FR-011). Consolidates editing into one UI.

## Open Questions

No open questions at PRD finalization — shape-notes Phase 7 cross-check landed at `quality_check_status: accepted` on 2026-05-20 with no surfaced gaps. New unknowns discovered during downstream tech-stack selection or implementation should be added here as numbered entries with owner and resolution date.
