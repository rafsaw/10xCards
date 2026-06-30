---
date: 2026-06-26T16:47:03-0500
researcher: Rafal S
git_commit: 77bb85c3a8370b83b8d5ab90951c643b39d72dc1
branch: learning/m5
repository: 10xCards
topic: "Rozbudowa code-reviewer w agenta z pętlą narzędziową (AI SDK ToolLoopAgent)"
tags: [research, codebase, code-reviewer, ai-sdk, tool-loop-agent, openrouter]
status: complete
last_updated: 2026-06-26
last_updated_by: Rafal S
---

# Research: Rozbudowa code-reviewer w agenta z pętlą narzędziową (AI SDK ToolLoopAgent)

**Date**: 2026-06-26T16:47:03-0500
**Researcher**: Rafal S
**Git Commit**: 77bb85c3a8370b83b8d5ab90951c643b39d72dc1
**Branch**: learning/m5
**Repository**: 10xCards

## Research Question

Jak rozbudować standalone pakiet `packages/code-reviewer` (z m5l2: AI SDK + OpenRouter +
zod, jednorazowy `generateText`) w agenta wykonującego **pętlę narzędziową** (tool-calling
loop), na wzór change'a `tool-loop-agent` przygotowanego przez autora kursu? Z naciskiem
na aktualne API AI SDK do tool-loopa.

## Summary

Punkt wyjścia jest mały i czysty: jeden plik `src/index.ts` eksportuje `reviewSchema`,
`createReviewer()` i `reviewCode()`, używając **`generateText` + `Output.object({ schema })`**
przez provider OpenRouter. To pojedyncze wywołanie modelu bez żadnych narzędzi.

Aby zrobić z tego agenta z pętlą narzędziową, AI SDK v6 daje gotową abstrakcję
**`ToolLoopAgent`** (`import { ToolLoopAgent } from "ai"`). Sama enkapsuluje pętlę
reason→act: model w każdym kroku albo generuje tekst (koniec), albo woła narzędzie
(`tool({ inputSchema, execute })`), którego wynik wraca do modelu — aż do warunku stopu.
Domyślnie pętla zatrzymuje się po 20 krokach (`stopWhen: stepCountIs(20)`).

Kluczowe odkrycie infrastrukturalne: pakiet ma **lokalny, przypięty skill `ai-sdk`**
(`packages/code-reviewer/.claude/skills/ai-sdk/`, hash w `skills-lock.json`) oraz
**bundlowaną dokumentację w `node_modules/ai/docs/`** dokładnie dla zainstalowanej wersji
`ai@6.0.212`. Skill wprost zakazuje polegania na pamięci modelu i każe czytać te lokalne
docsy — są wersjonowane, więc są wiarygodniejsze niż jakiekolwiek zewnętrzne źródło
(Context7 nie był tu potrzebny — patrz "Źródła dokumentacji").

Najwięcej ryzyka w tej zmianie to nie sama pętla, lecz **przemianowane API w v6**
(udokumentowane w `common-errors.md` skilla): `maxSteps` → `stopWhen: stepCountIs(n)`,
`parameters` → `inputSchema`, `generateObject` → `generateText`/`Output.object`. Plan musi
ich pilnować, bo pamięć modelu podsuwa stare nazwy.

## Detailed Findings

### Punkt wyjścia: dzisiejszy `code-reviewer`

Pakiet jest standalone (własny `package.json`/`node_modules`, nie rusza monorepa root).

- `packages/code-reviewer/src/index.ts:61-86` — `createReviewer()` tworzy provider
  `createOpenRouter({ apiKey })`, wiąże model i zwraca obiekt z jedną metodą
  `reviewCode(code, context?)`. To **pojedyncze** `generateText({ model, output:
  Output.object({ schema: reviewSchema }), system, prompt })` — bez `tools`, bez pętli.
- `packages/code-reviewer/src/index.ts:15-32` — `reviewSchema` (zod): `summary`,
  `verdict: approve|comment|request_changes`, `findings[]` z `severity/title/detail/
  suggestion?`. To jednocześnie runtime'owy kontrakt wyniku.
- `packages/code-reviewer/src/index.ts:44-45` — `FALLBACK_MODEL = "anthropic/claude-sonnet-4.5"`;
  override przez `OPENROUTER_MODEL`.
- `packages/code-reviewer/src/index.ts:52-58` — `loadEnv()` przez natywne
  `process.loadEnvFile()` (bez zależności); import modułu jest side-effect-free, env
  ładuje się tylko w trybie CLI (`main()`), `index.ts:107-113`.
- `packages/code-reviewer/src/check.ts:9-41` — e2e check: jedno realne (płatne) wywołanie
  OpenRouter + ponowna walidacja `reviewSchema.parse(review)`; exit≠0 na błędzie.
- `packages/code-reviewer/package.json:8-24` — skrypty `start/dev/check/build/typecheck`;
  deps `ai@^6.0.212`, `@openrouter/ai-sdk-provider@^2.10.0`, `zod@^4.4.3`; `type: module`.

Wniosek: agent wejdzie naturalnie obok `createReviewer` (np. `createReviewAgent()` /
nowy plik `src/agent.ts`), zachowując `reviewSchema` jako finalny `Output` agenta i
re-używając wzorca ładowania env oraz e2e-check.

### Docelowy mechanizm: `ToolLoopAgent` (AI SDK v6)

Z `node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx` i
`03-agents/02-building-agents.mdx`:

- **Tworzenie**: `new ToolLoopAgent({ model, instructions, tools, stopWhen, output,
  toolChoice, prepareStep, onStepFinish, ... })`. Przyjmuje te same ustawienia co
  `generateText`/`streamText`.
- **Użycie**: `await agent.generate({ prompt })` → `GenerateTextResult` (`result.text`,
  `result.steps`, `result.output` gdy ustawiony `output`, `result.staticToolCalls`).
  Jest też `agent.stream({ prompt })`.
- **Pętla** (`building-agents.mdx:82-102`): w każdym kroku model generuje tekst (koniec)
  albo woła narzędzie; po wykonaniu narzędzia odpala się nowa generacja. Pętla kończy się
  gdy: finish reason ≠ tool-calls, LUB wywołane narzędzie nie ma `execute`, LUB tool call
  wymaga approvala, LUB spełniony warunek `stopWhen`.

### Narzędzia: `tool({ inputSchema, execute })`

Z `03-ai-sdk-core/15-tools-and-tool-calling.mdx:9-45`:

- `tool({ description, inputSchema: z.object({...}), execute: async (input) => result })`.
- `description` wpływa na to, kiedy model wybierze narzędzie; `inputSchema` (zod/JSON
  schema) jest konsumowany przez LLM **i** waliduje argumenty wywołania.
- `execute` jest **opcjonalny** — brak `execute` = sygnał zakończenia (patrz wzorzec
  "done tool" niżej) albo forwardowanie wywołania gdzie indziej.
- `strict: true` (opcjonalnie) wymusza walidne tool-calle u providerów, które to wspierają.

Dla code-reviewera narzędzia-kandydaci (do decyzji w planie): `readFile(path)`,
`listFiles(glob)`, `searchCode(query)`, `runLint`/`runTypecheck` — coś, co pozwala
agentowi *dociągnąć kontekst* zanim wyda werdykt, zamiast oceniać ślepo wklejony snippet.

### Kontrola pętli: `stopWhen`, `prepareStep`, wzorzec "done"

Z `03-agents/04-loop-control.mdx`:

- **Domyślnie** `stopWhen: stepCountIs(20)` — bezpiecznik przeciw runaway-loop/kosztom.
- Wbudowane warunki: `stepCountIs(n)`, `hasToolCall(toolName)`, `isLoopFinished()`
  (brak limitu — używać ostrożnie). Można podać tablicę warunków (stop na pierwszym).
- Warunki własne: `StopCondition<typeof tools>` dostaje `{ steps }` — np. budżet tokenów
  /kosztu (`loop-control.mdx:130-145`).
- `prepareStep({ stepNumber, steps, messages, model })` — modyfikacja ustawień między
  krokami: dynamiczny dobór modelu, przycinanie kontekstu, `activeTools`, wymuszony
  `toolChoice`.
- **Wzorzec "forced tool calling / done"** (`loop-control.mdx:339-381`): `toolChoice:
  'required'` + narzędzie `done` bez `execute`; finalny wynik czyta się z
  `result.staticToolCalls`. Alternatywa dla łączenia pętli ze structured output.

### Structured output w agencie

`reviewSchema` można zachować jako finalny kontrakt: `ToolLoopAgent({ output:
Output.object({ schema: reviewSchema }) })` (`building-agents.mdx:159-181`); wynik w
`result.output` jest typowany. Uwaga: dwa miejsca w docsach pokazują lekko różny zapis
(`Output.object({ schema })` vs `output: { schema }`) — w planie trzymać się formy
`Output.object(...)`, spójnej z dzisiejszym `src/index.ts:75`.

### Obserwowalność (opcjonalnie, dev-only)

`02-getting-started/09-coding-agents.mdx` i `references/devtools.md`: `onStepFinish`
loguje kroki/usage/tool-results bez UI; `@ai-sdk/devtools` + `wrapLanguageModel(...,
devToolsMiddleware())` daje lokalny podgląd na `localhost:4983`. To kandydat na "nice to
have" do debugowania pętli, nie rdzeń zmiany.

## Code References

- `packages/code-reviewer/src/index.ts:61-86` — `createReviewer()` + jednorazowy `generateText`/`Output.object` (punkt wpięcia agenta)
- `packages/code-reviewer/src/index.ts:15-32` — `reviewSchema` (finalny kontrakt werdyktu)
- `packages/code-reviewer/src/index.ts:52-58` — `loadEnv()` przez natywny loader env
- `packages/code-reviewer/src/check.ts:9-41` — wzorzec e2e-check do skopiowania dla agenta
- `packages/code-reviewer/package.json:8-24` — skrypty + pinned deps (`ai@^6.0.212`)
- `packages/code-reviewer/skills-lock.json` — przypięty skill `ai-sdk` (źródło: vercel/ai)
- `packages/code-reviewer/.claude/skills/ai-sdk/SKILL.md` — reguły: czytaj `node_modules/ai/docs|src`, nie ufaj pamięci, `ToolLoopAgent`
- `packages/code-reviewer/.claude/skills/ai-sdk/references/common-errors.md` — przemianowane API v6 (krytyczne dla planu)
- `node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx` — pełna referencja `ToolLoopAgent`
- `node_modules/ai/docs/03-agents/02-building-agents.mdx` — przewodnik budowy agentów
- `node_modules/ai/docs/03-agents/04-loop-control.mdx` — `stopWhen`/`prepareStep`/wzorzec "done"/pętla manualna
- `node_modules/ai/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx` — `tool()`/`inputSchema`/`strict`

## Architecture Insights

- **Mały, import-safe rdzeń.** Dzisiejszy moduł celowo nie ma efektów ubocznych przy
  imporcie. Agent powinien tę własność zachować — najlepiej osobny `createReviewAgent()`
  (ewentualnie `src/agent.ts` + `src/tools/`), żeby `reviewCode()` dalej działał jako
  prosty one-shot dla konsumentów, którzy nie chcą pętli.
- **`reviewSchema` jako wspólny kontrakt.** Trzymanie tego samego schematu jako `output`
  agenta utrzymuje spójny kształt werdyktu między one-shotem a agentem i pozwala
  re-użyć e2e-check.
- **Bezpiecznik pętli jest domyślny, ale świadomy.** `stepCountIs(20)` chroni budżet;
  przy realnych (płatnych) wywołaniach OpenRouter dobór `stopWhen` to decyzja
  koszt/jakość, nie detal — wynieść do planu.
- **Wersjonowana dokumentacja w repo.** Bundlowane docsy + przypięty skill oznaczają, że
  plan i implementacja mają lokalne, dokładne API pod rękę — to mocno obniża ryzyko
  "halucynacji API".
- **Lessons.md** (`context/foundation/lessons.md`) zawiera tylko regułę o routingu web
  app — nie dotyczy tego standalone pakietu; brak priorów wiążących tę zmianę.

## Historical Context (from prior changes)

- `context/changes/tool-loop-agent/change.md` — tożsamość tej zmiany; etapy
  eksploracja → decyzja/plan → implementacja.
- Geneza pakietu (git log): `e58bacb feat(m5l2): add standalone code-reviewer package
  (AI SDK + OpenRouter + zod)` oraz `7fc9000 docs(m5l2)` (dodanie ai-sdk.dev) i
  `77bb85c feat(m5l2): add end-to-end integration check`. Ta zmiana to m5 dalszy ciąg
  (tool-loop nad istniejącym reviewerem).
- `context/changes/refactor-opportunities/` — wzorzec change'a etapowego
  (eksploracja→plan→implementacja) zastosowany tu analogicznie.

## Źródła dokumentacji (AI SDK)

Użyto **lokalnych, przypiętych** docsów `node_modules/ai/docs/` (wersja `ai@6.0.212`),
zgodnie z regułą skilla `ai-sdk` ("nie ufaj pamięci, czytaj bundlowane docsy/źródła").
Context7 nie był potrzebny: przypięta dokumentacja w repo jest wersjonowana i pewniejsza
niż zewnętrzny indeks dla tej konkretnej wersji. Jeśli na etapie planu pojawi się temat
spoza zainstalowanej wersji (np. nowszy `@ai-sdk/*`), wtedy warto sięgnąć po Context7 /
ai-sdk.dev.

## Open Questions (do rozstrzygnięcia w /10x-plan)

1. **Jakie narzędzia** dostaje agent? (read-only kontekst: `readFile`/`searchCode`/
   `listFiles`, czy też `runLint`/`runTypecheck`?) — zakres = koszt + złożoność.
2. **Co agent realnie recenzuje** — wklejony snippet (jak dziś) czy ścieżki w repo, które
   sam dociąga narzędziami? To zmienia projekt narzędzi i promptu.
3. **`stopWhen`** — zostać przy domyślnym `stepCountIs(20)`, obniżyć, czy dodać warunek
   budżetowy/`hasToolCall('done')`?
4. **Structured output vs wzorzec "done"** — finalny werdykt przez `output:
   Output.object({ schema: reviewSchema })`, czy przez narzędzie `done` + `staticToolCalls`?
5. **Kształt API** — rozszerzyć `createReviewer` o tryb agentowy, czy dodać osobny
   `createReviewAgent()` (+ `src/agent.ts`, `src/tools/`)? Zachować one-shot `reviewCode()`.
6. **E2E-check** — analogiczny `check:agent` z realnym wywołaniem i asercją na `output`/
   przejściu pętli (≥1 tool call)?
7. **DevTools/`onStepFinish`** — czy w zakresie tej zmiany, czy odłożyć?

## Related Research

- `context/changes/account-retention-write-lock/research.md` — wcześniejszy research w repo (inny temat; wzorzec dokumentu).
- `context/changes/refactor-opportunities/research.md` — research etapowej zmiany.

## Next step

`/10x-plan tool-loop-agent` — rozstrzygnąć Open Questions 1–7 i rozpisać fazy
implementacji (najpewniej: szkielet agenta + narzędzia → pętla/`stopWhen` → structured
output/werdykt → e2e-check). Patrz też `/10x-frame` jeśli zakres narzędzi/celu recenzji
okaże się sporny.
