# Module 5 — status (notatka kontekstowa)

> Czytasz to za jakiś czas i nie pamiętasz, co realnie zrobione? Tu jest prawda.

## Co jest ZROBIONE

- **M5L1** — opportunity map + Mom Test (internal builder "Release Safety Digest").
  Pliki: `context/internal-builders/m5l1-*.md`.
- **M5L2** — standalone paczka `packages/code-reviewer` (AI SDK + OpenRouter + zod),
  potwierdzona komunikacja z modelem na żywo (`npm run check`, `npm start` →
  poprawny, ustrukturyzowany review buggy snippeta). To zamyka zadanie praktyczne M5L2.

## Czego NIE zrobiono jeszcze

- **M5L3** — zadanie praktyczne **NIEzrobione** (stan na ostatnią edycję tej notatki).
  Tu dopiero wdrożenie/rozbudowa agenta na CI/CD + zrzuty ekranu jako dowód na 10xChampion.

## ⚠️ Uwaga o commitach z prefiksem `m5l3` / `tool-loop-agent`

W historii (`main` i `learning/m5`) są commity oznaczone `m5l3` oraz
`feat/refactor/chore(tool-loop-agent)`:

```
ac06ba6 m5l3 - add tool-loop-agent implementation plan + brief
4106c02 m5l3 - add how-to-do guide for the 10x per-change workflow
b11d27b m5l3 - start tool-loop-agent change (10x-new + research)
ac2e692 refactor(tool-loop-agent): extract schemas & prompts into modules (p1)
8802c8e feat(tool-loop-agent): provider factory, ToolLoopAgent, CLI, barrel (p2)
f837ef4 chore(tool-loop-agent): close out plan (epilogue)
733b2ac docs(tool-loop-agent): add impl review report (APPROVED)
```

**To są materiały PRZYGOTOWAWCZE** (plan, research, brief, refaktor paczki do
`ToolLoopAgent`) — **NIE** ukończone zadanie lekcyjne M5L3. Prefiks `m5l3` mówi
"dotyczy lekcji M5L3", a nie "lekcja M5L3 zaliczona". Samo zadanie praktyczne
M5L3 wciąż przed Tobą.
