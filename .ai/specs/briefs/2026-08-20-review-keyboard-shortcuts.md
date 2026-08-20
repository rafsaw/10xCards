# Review Session Keyboard Shortcuts

**Date:** 2026-08-20
**Status:** Proposed
**Type:** Product improvement

## Problem / Opportunity

The Review Session currently requires mouse interaction to reveal an answer and rate a flashcard.

During repeated study sessions, these actions are performed frequently. Requiring mouse interaction for every card adds unnecessary friction and slows down the review flow.

## User Value

Allow users to complete the core review interaction from the keyboard so that reviewing flashcards is faster and more fluid.

## Desired Behavior

While using the Review Session:

* `Space` reveals the answer when the answer is currently hidden.
* `1` rates the card as **Wrong** after the answer has been revealed.
* `2` rates the card as **Right** after the answer has been revealed.
* Rating shortcuts do nothing before the answer is revealed.
* Keyboard actions must use the existing review submission flow rather than creating separate rating logic.
* Existing mouse controls continue to work unchanged.
* The UI provides a small visible indication of the available shortcuts.

## Acceptance Criteria

1. Pressing `Space` on a card with a hidden answer reveals the answer.
2. Pressing `1` or `2` before reveal does not submit a review.
3. After reveal, pressing `1` performs the same action as clicking **Wrong**.
4. After reveal, pressing `2` performs the same action as clicking **Right**.
5. Keyboard interaction cannot cause duplicate review submissions.
6. Rating shortcuts are ignored while a review submission is already in progress.
7. The Review Session UI displays the available keyboard shortcuts.
8. Existing button-based interaction continues to work.
9. Existing review persistence and scheduling behavior remains unchanged.

## Out of Scope

* Changes to the Leitner scheduling algorithm.
* Changes to `/api/reviews`.
* Database or schema changes.
* Additional keyboard customization.
* Global application shortcuts.
* Changes to the broader Review Session design.

## Constraints

* Preserve the existing review submission and locking behavior.
* Do not expose or modify local QA credentials.
* Do not modify `.claude/settings.local.json`.
* Avoid unrelated refactoring.

## Origin / Decision

This change was selected on 2026-08-20 as the first real product improvement after completing the Open Mercato pipeline setup for 10xCards.

It was chosen because it combines:

* real user value,
* a small and controlled implementation scope,
* a visible authenticated UI interaction,
* meaningful browser QA potential,
* and an opportunity to observe how the Open Mercato pipeline selects testing, review, QA, and merge activities for a real product change.

## Implementation

Not started.

PR: *TBD*
