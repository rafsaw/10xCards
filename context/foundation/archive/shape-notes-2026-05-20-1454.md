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
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction — writing flashcards by hand is tedious"
    - topic: "competitive insight"
      decision: "existing tools are locked into one ecosystem (Anki plugins, Quizlet AI); wedge is being algorithm/platform-neutral"
    - topic: "primary persona scope"
      decision: "single user (the author as self-learner) for v1, but auth from day one to allow growth"
    - topic: "auth strategy"
      decision: "email + password from v1 (signup, login, session, password reset)"
    - topic: "role model"
      decision: "flat — all users equal, no admin, no sharing"
    - topic: "MVP scope-down"
      decision: "drop manual card creation; edit only before-save (not after); no password reset (manual email); simplest SR algorithm (SM-2 or Leitner)"
    - topic: "MVP timeline"
      decision: "3 weeks after-hours after scope-down (was 3-4 before cuts)"
  frs_drafted: 14
  quality_check_status: accepted
---

# 10xCards — Shape Notes

## Vision & Problem Statement

A self-learner reading a technical book wants to retain its concepts using spaced repetition, but the manual act of phrasing question/answer cards while reading is tedious enough that they skip making cards altogether. The cost: they lose the most reliable retention method available to them and rely on re-reading, which is slower and less effective.

Existing AI flashcard tools are locked into specific ecosystems — Anki plugins, Quizlet's built-in AI, ChatGPT prompts that copy-paste into one platform. The wedge here is being algorithm-agnostic: cards are generated from text by AI, then fed into a generic spaced-repetition algorithm, with no commitment to a specific ecosystem.

## User & Persona

**Primary persona** — A self-learner who reads technical books (the project author for v1). They have a working spaced-repetition habit in principle but in practice skip the card-creation step because writing high-quality cards from dense prose is too slow. They want to paste a passage and get usable cards in seconds.

For v1, the persona scope is literally one user (the author dogfooding the product). Auth is included in MVP anyway so the product can grow beyond a single user without a retrofit later.

## Access Control

Email + password authentication from v1 (signup, login, session, password reset). Flat role model — every authenticated user manages their own cards. No admin role, no sharing between users, no public/anonymous routes beyond the marketing/landing surface.

Each user's cards are isolated from every other user's cards. Unauthenticated requests to any card-management route redirect to login.

## Success Criteria

### Primary
- ≥ 75% of AI-generated cards are accepted by the user (with or without edit) across at least 5 generation sessions. This directly measures the product's wedge: AI quality high enough that the user doesn't fall back to manual writing.

### Secondary
- Review sessions are reliable end-to-end: a user can start a review, work through all due cards, and have progress saved without crashes or lost state. (Qualitative target; refine into a measurable form during /10x-prd if needed.)

### Guardrails
- A user can never see another user's cards.
- Pasted source text does not leak to other users and does not appear in operator-accessible logs after the request that processed it completes.
- If AI generation fails (timeout, error, rate limit), the user's pasted text is preserved and they can retry without re-pasting.
- Review mode always offers SOMETHING to study when cards are due, even if the SR algorithm's primary selection logic fails (fallback: oldest due card first).

## MVP Flow (sketched)

The smallest end-to-end flow that proves the product works:

1. User opens the app → login screen.
2. User signs up (email + password) or logs in.
3. Dashboard appears with a single primary CTA: "Generate cards from text".
4. User pastes a passage of text into a generation form.
5. AI returns N candidate cards (front/back).
6. User reviews each card: accept-as-is, edit-then-accept, or reject.
7. Accepted cards are saved to the user's card library.
8. User opens "Review" → SR algorithm picks due cards → user rates recall, progress is persisted.
9. User can browse and delete saved cards from a list view. (No edit after save; no manual creation.)

**Scope-down moves applied in Phase 3:**
- Manual card creation dropped (AI-only for v1).
- Editing only allowed BEFORE saving; saved cards are immutable except for delete.
- No password reset flow — manual support email only.
- Simplest viable SR algorithm — biased toward Leitner (2-state) given FR-013's binary rating.

**Timeline budget:** 3 weeks of after-hours work after scope-down.

## User Stories

### US-01: User generates and saves flashcards from a text passage

- **Given** a logged-in user is on the dashboard
- **When** they paste a passage into the generate form and submit
- **Then** they see N candidate cards (front/back) and can accept, edit-then-accept, or reject each one
- **And** accepted cards are saved to their library

#### Acceptance Criteria
- Generation produces at least 1 card for a passage of ≥ 200 words.
- Each candidate card displays front and back text and three actions: accept / edit / reject.
- "Edit" opens an inline form prefilled with the candidate's content; saving the edit returns to the candidate list and replaces the original.
- Accepting (with or without prior edit) saves the card and removes it from the candidate list.
- Rejecting removes the candidate from the list and does not save it.
- If AI generation fails, the original source text remains in the form and the user can retry.

### US-02: User reviews due cards using spaced repetition

- **Given** a logged-in user has saved at least one card whose next-due date is now or in the past
- **When** they start a review session
- **Then** the SR algorithm presents due cards one at a time, the user rates recall, and next-due dates are updated

#### Acceptance Criteria
- "Start review" is disabled or shows an empty-state message when no cards are due.
- Each card shows front first; the user reveals the back, then rates recall as either "right" or "wrong" (binary; per FR-013 Socrates revision).
- After rating, the next-due date for that card is updated by the SR algorithm; rating persists across sessions.
- The session continues until all due cards have been reviewed or the user exits.
- If SR algorithm selection fails for any reason, the session falls back to "oldest due first" (per Guardrails).

## Functional Requirements

### Authentication
- FR-001: User can sign up with email and password. Priority: must-have
  > Socrates: Counter — single-user v1 doesn't strictly need signup; could DB-seed the account. Resolution: stands. Multi-user-from-day-one was chosen in Phase 2 to avoid retrofit later.
- FR-002: User can log in with email and password. Priority: must-have
  > Socrates: Counter — magic-link auth would skip password storage and reset flows. Resolution: stands. Email+password was chosen in Phase 2; switching now restarts that decision.
- FR-003: User can log out. Priority: must-have
  > Socrates: Counter — session auto-expiry would remove the need for an explicit logout button. Resolution: stands. Explicit logout is cheap, expected, and supports the shared-device case.

### AI generation
- FR-004: User can paste source text and trigger AI flashcard generation. Priority: must-have
  > Socrates: Counter — streaming generation (cards appear progressively) would improve perceived performance. Resolution: stands. Streaming is polish; request-response is simpler for v1.
- FR-005: User can view AI-generated candidate cards (front/back) before saving. Priority: must-have
  > Socrates: Counter — auto-save all generated cards and let the user delete bad ones later. Resolution: stands. The accept-before-save flow IS the product wedge; remove it and the product is a generic "AI dumps cards into deck" tool.
- FR-006: User can edit a candidate card's front and back before saving. Priority: must-have
  > Socrates: Counter — drop edit; accept-or-reject only, since AI quality should make editing rare. Resolution: stands. Editing is the escape valve for "almost right" cards; high value when AI is close-but-not-quite.
- FR-007: User can accept a candidate card, saving it to their library. Priority: must-have
  > Socrates: Counter — acceptance could be implicit (anything not rejected is saved on navigation away). Resolution: stands. Explicit accept makes user intent clear and prevents accidental saves.
- FR-008: User can reject a candidate card, discarding it. Priority: must-have
  > Socrates: Counter — batch reject (multi-select + reject button) would be faster when many cards are bad. Resolution: stands. Per-card decisions are the model; simpler UI.
- FR-009: User can retry generation if it fails, without re-pasting the source text. Priority: must-have
  > Socrates: Counter — client-state retention makes this trivial; the FR is over-specified. Resolution: stands. Explicit FR forces the property to hold even if the implementation evolves (e.g., multi-step form, navigation on success).

### Card management
- FR-010: User can view a list of their saved cards. Priority: must-have
  > Socrates: Counter — drop the browse view; user only interacts via review. Resolution: stands. Browse is the surface that supports FR-011 (delete); without it, deletion has no UI.
- FR-011: User can delete a saved card. Priority: must-have
  > Socrates: Counter — archive (soft-delete) instead of hard delete to recover from accidents. Resolution: stands. Hard delete matches user privacy intuition; simpler data model.

### Review (spaced repetition)
- FR-012: User can start a review session; the SR algorithm selects due cards. Priority: must-have
  > Socrates: Counter — replace SR with random shuffle for radical simplification. Resolution: stands. SR is the integration point this product exists for; idea-notes explicitly lists "integration with a ready-made SR algorithm" in MVP.
- FR-013: User can rate their recall on each card during review using a binary right/wrong scale. Priority: must-have
  > Socrates: Counter — multi-level rating (e.g., SM-2's 4 levels) gives better scheduling. Resolution: REVISED to binary right/wrong. Simpler UI, simpler SR math. This biases the SR algorithm choice toward Leitner (2-state) rather than SM-2 (4-state). Recorded as a downstream stack/algorithm constraint.
- FR-014: User's review progress persists across sessions (next-due dates update per SR algorithm). Priority: must-have
  > Socrates: Counter — localStorage for review state, no backend persistence. Resolution: stands. Auth + per-user data already imply backend; localStorage breaks cross-device support and loses progress on browser-data clears.

## Business Logic

Given a passage of source text, the application generates question-answer pairs that capture the passage's key claims, and the user curates the set by accepting, editing, or rejecting each candidate.

The rule consumes one input: a passage of text provided by the user. It produces a set of candidate question-answer pairs framed at the granularity of the passage's key claims (one pair per claim, roughly). The user encounters the rule's output as a list of candidates immediately after submitting the passage; each candidate is shown alongside three actions (accept, edit, reject). Accepted candidates become first-class cards in the user's library and enter the spaced-repetition lifecycle. Rejected candidates are discarded. Edited candidates take the user's revised content before becoming first-class cards.

The transformation step is non-trivial: extracting key claims and phrasing them as testable question-answer pairs is the work the application is being asked to do. The curation step is also non-trivial as a domain decision — the application does not claim correctness; it surfaces candidates and lets the user be the authority on what enters their study set.

## Non-Functional Requirements

- Source text submitted for processing leaves no operator-accessible trace after the request that processed it completes. This includes server logs, monitoring traces, request bodies stored for debugging, and any third-party intermediaries.
- A failed login does not lock out a legitimate user who mistypes their password three to five times in a row, but credential-stuffing at scale is rejected before reaching the authentication check.
- The product remains usable on the latest two major versions of the four mainstream desktop browsers (Chrome, Firefox, Safari, Edge).

## Non-Goals

- **Avoid: building our own SR algorithm.** We integrate a ready-made one (biased toward Leitner per FR-013's binary rating). Prevents algorithm rabbit-holes.
- **Avoid: multi-format import (PDF, DOCX, EPUB).** Plain-text paste only in v1. File-based ingestion is v2+.
- **Avoid: sharing flashcards or decks between users.** Single-tenant per user. Closes off team/social features.
- **Avoid: mobile apps (native iOS / Android).** Web only. Mobile-browser usability is still in scope as a baseline, but no native shells.
- **Avoid: integrations with other platforms (Anki export, Quizlet sync, LMS integrations).** Self-contained product. Export/sync deferred to v2+.
- **Avoid: editing cards after they have been saved.** Saved cards are immutable except for delete. Editing happens only during the accept flow, before save.
- **Avoid: manual card creation in v1.** AI-generated only. Manual creation is a v2 feature.
- **Avoid: password reset and email verification flows in v1.** Manual support-email recovery only. Cuts email-sending dependency from MVP.

## Quality cross-check

All required elements present at finalization:
- Access Control — captured
- Business Logic (one-sentence rule) — captured
- Project artifacts — shape-notes.md with valid checkpoint
- Timeline-cost acknowledged — mvp_weeks: 3 (within default budget; no acknowledgment block required)
- Non-Goals — 8 entries

No gaps surfaced. `quality_check_status: accepted`.



