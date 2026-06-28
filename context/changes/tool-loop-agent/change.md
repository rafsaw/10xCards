---
change_id: tool-loop-agent
title: Rozbuduj code-reviewer w agenta z pętlą narzędziową (AI SDK tool-calling)
status: planned
created: 2026-06-26
updated: 2026-06-27
archived_at: null
---

## Notes

Intencja: rozbudować standalone pakiet `packages/code-reviewer` (powstały w m5l2 —
AI SDK + OpenRouter + zod, jednorazowy `generateText`) w agenta wykonującego
pętlę narzędziową (tool-calling loop): model → wywołanie narzędzia → wynik →
model, aż do zakończenia zadania.

Punkt wyjścia: `src/index.ts` (`createReviewer` / `reviewCode`, structured output
przez `Output.object({ schema })`) oraz `src/check.ts` (end-to-end check na
realnym wywołaniu OpenRouter).

Odpowiednik change'a, który autor kursu przygotował w lekcji jako `tool-loop-agent`.
Zmiana przebiega etapami: eksploracja → decyzja/plan → implementacja.
