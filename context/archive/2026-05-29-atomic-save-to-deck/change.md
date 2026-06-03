---
change_id: atomic-save-to-deck
title: Atomowy zapis wybranych draftów AI do decka — north star pętli capture
status: archived
created: 2026-05-29
updated: 2026-06-03
archived_at: 2026-06-03T17:55:52Z
---

## Notes

Seed: S-02 z `context/foundation/roadmap.md`.

Outcome (per roadmap S-02): użytkownik patrzy na listę draftów z S-01, niezależnie
zaznacza accept/reject dla każdego, zatwierdza — operacja **atomowa**: zaakceptowani
dostają `status=saved` (wchodzą w SR lifecycle z initial due-date), odrzuceni są
hard-deleted. Albo wszystko, albo nic — bez stanu pośredniego. Domyka pętlę AI capture
(**validation milestone PRD Primary Success Criterion**).

- PRD refs: US-01 (accept/reject + save), FR-006 (accept → library), FR-007 (reject → discard bez save).
- Prerequisites: F-01 (`cards-schema-and-rls`), S-01 (`first-gated-generation`).
- Open question do rozstrzygnięcia w planie: czy "atomic" = DB transakcja, czy server-side
  guard + idempotency key wystarczy (Open Roadmap Question #3). Uwaga na race przy dwóch kartach przeglądarki.
