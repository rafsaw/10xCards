# How to do: 10x workflow dla nowego pomysłu w istniejącym projekcie

Przewodnik: jak prowadzić **pojedynczą zmianę** (change) od pomysłu do wdrożenia,
gdy projekt już istnieje. Spisany na bazie realnego przykładu `tool-loop-agent`.

> TL;DR pętli per-change:
> `/10x-new` → (`/10x-frame`?) → (`/10x-research`?) → `/10x-plan` → `/10x-plan-review`
> → `/10x-implement` | `/10x-tdd` | `/10x-e2e` → `/10x-impl-review` → `/10x-archive`

---

## 1. Dwa poziomy 10x workflow

10x workflow ma **dwa poziomy**, które łatwo pomylić:

### Poziom A — Fundament projektu (robisz rzadko)

To Twój dotychczasowy flow. Ustawia projekt jako całość; artefakty lądują w
`context/foundation/`:

```
pomysł
  └─ /10x-shape        → shape-notes.md        (rozmowa odkrywcza)
       └─ /10x-prd     → prd.md                (holistyczny PRD)
            └─ /10x-tech-stack-selector → tech-stack.md   (greenfield)
                 └─ /10x-bootstrapper          (scaffold projektu)
            └─ /10x-roadmap → roadmap.md        (lista slice'ów = przyszłe zmiany)
```

`roadmap.md` to lista **vertical slices** — i każdy slice bierzesz potem jako
osobną zmianę przez `/10x-new`. To dokładnie to, co nazywasz „10x-new workflow".

Ten poziom przechodzisz **raz na projekt** (albo gdy robisz duży pivot / nowy moduł).

### Poziom B — Pojedyncza zmiana (robisz przy każdym pomyśle)

Tu jesteś teraz z `tool-loop-agent`: **projekt już stoi, masz kolejny pomysł**.
NIE wracasz do `/10x-prd` ani `/10x-roadmap`. Otwierasz **jedną zmianę** i prowadzisz
ją przez pętlę per-change. Artefakty lądują w `context/changes/<change-id>/`.

**Kiedy który poziom?**

| Sytuacja | Poziom |
| --- | --- |
| Nowy projekt od zera | A (pełny łańcuch) |
| Nowy duży moduł / pivot kierunku produktu | A (od `/10x-shape` lub `/10x-prd`) |
| Slice z istniejącego `roadmap.md` | B (start od `/10x-new`) |
| Nowy pomysł/feature/refactor niebędący w roadmap (np. `tool-loop-agent`) | B (start od `/10x-new`) |
| Pojedynczy bugfix | B, często skrócone (patrz §4) |

---

## 2. Pętla per-change (Poziom B) — krok po kroku

Wszystko dla jednej zmiany żyje w `context/changes/<change-id>/`, spięte plikiem
tożsamości `change.md`.

### Krok 1 — `/10x-new <change-id>` — załóż zmianę

Tworzy `context/changes/<change-id>/change.md` (frontmatter + sekcja Notes z intencją).
`change-id` musi być kebab-case i unikalny.

```
/10x-new tool-loop-agent
```

> Wskazówka: dorzuć intencję w jednej linii, np.
> `/10x-new tool-loop-agent rozbuduj code-reviewer w agenta z pętlą narzędziową`
> — trafia wprost do Notes jako seed.

### Krok 2 (opcjonalny) — `/10x-frame <change-id>` — zakwestionuj framing

Używasz **tylko** gdy pomysł jest w kształcie „bug + proponowana naprawa" albo gdy nie
jesteś pewien *co* właściwie budować (spór o zakres/cel). Wyzwalacze: „fix", „broken",
„root cause", „should we even", „is this the right". Przy jasnym zadaniu — **pomiń**.

### Krok 3 (zwykle tak) — `/10x-research <change-id>` — zbadaj grunt

Równoległe sub-agenty czytają kod i historię; wynik to `research.md` z konkretnymi
referencjami `plik:linia`, wnioskami architektonicznymi i **otwartymi pytaniami** do
rozstrzygnięcia w planie. Rób, gdy zmiana dotyka istniejącego kodu albo wymaga
świeżej dokumentacji biblioteki.

> W `tool-loop-agent` research ustalił punkt wyjścia (`code-reviewer`), docelowy
> mechanizm (`ToolLoopAgent` z AI SDK) i 7 otwartych decyzji do planu.

### Krok 4 — `/10x-plan <change-id>` — rozpisz plan

Tworzy `plan.md` (+ `plan-brief.md`) z fazami implementacji i sekcją `## Progress`
(jedyne źródło prawdy o stanie wykonania). Tu zapadają decyzje zostawione przez research.

### Krok 5 — `/10x-plan-review <change-id>` — recenzja planu

Sprawdza plan pod kątem substancji, wykonalności i dopasowania architektonicznego,
**zanim** napiszesz kod. Tani krok, który łapie błędy gdy są najtańsze do naprawy.
Po recenzji zwykle wracasz raz do `/10x-plan`, by nanieść poprawki.

### Krok 6 — wykonanie planu (wybierz tryb wg faz)

Plan może mieszać fazy różnego typu — dobierasz narzędzie do fazy:

| Skill | Kiedy |
| --- | --- |
| `/10x-implement <change-id>` | Domyślny. Faza implementowana wprost, z weryfikacją. |
| `/10x-tdd <change-id>` | Fazy, które da się prowadzić test-first (red→green→refactor). |
| `/10x-e2e <change-id>` | Fazy wymagające realnej przeglądarki (Playwright), gdy feature już stoi. |

Te trzy dzielą ten sam `plan.md` i tę samą sekcję `## Progress` — możesz je przeplatać.

### Krok 7 — `/10x-impl-review <change-id>` — recenzja wykonania

Porównuje implementację z planem: dryf, niebezpieczne decyzje, zgodność ze wzorcami.

### Krok 8 — `/10x-archive <change-id>` — zamknij zmianę

Przenosi folder do `context/archive/` i stempluje `change.md` statusem archived.

> Na Windowsie `/10x-archive` potrafi się wyłożyć na `git mv` folderu
> (Permission denied) — wtedy fallback: `Move-Item` + ręczne `git add`.

---

## 3. Mapa: Twój stary flow ↔ nowy flow

```
STARY (raz na projekt, Poziom A)
  idea → /10x-prd → /10x-roadmap → [slice 1, slice 2, ...]
                                        │
                                        └─ każdy slice: /10x-new + pętla per-change

NOWY pomysł w gotowym projekcie (Poziom B) — np. tool-loop-agent
  idea → /10x-new → (/10x-frame?) → /10x-research → /10x-plan
         → /10x-plan-review → /10x-implement|tdd|e2e → /10x-impl-review → /10x-archive
```

Różnica: **nie ruszasz `prd.md` ani `roadmap.md`**. Nowy pomysł to po prostu kolejna
zmiana — wchodzisz od `/10x-new` i idziesz pętlą. (Identyczna pętla jak dla slice'a z
roadmapy — tylko źródło pomysłu jest inne.)

---

## 4. Skalowanie procesu do wielkości zmiany

Pętla to nie sztywny rytuał — dobierasz głębokość do ryzyka:

- **Mały, oczywisty bugfix** → `/10x-new` → `/10x-plan` (krótki) → `/10x-implement`
  → `/10x-archive`. Research/frame/plan-review pomijasz.
- **Zmiana w istniejącym kodzie z niewiadomymi** (jak `tool-loop-agent`) → pełna pętla
  z `/10x-research` i `/10x-plan-review`.
- **Pomysł w kształcie „bug + gotowa naprawa" lub spór o zakres** → zacznij od
  `/10x-frame`, zanim w ogóle zaplanujesz.

Zasada: im więcej niewiadomych i im większy blast radius, tym więcej kroków robisz
świadomie. Domyślnie: research → plan → plan-review → implement.

---

## 5. Gdzie co leży

```
context/
  foundation/        # Poziom A — fundament projektu (prd.md, roadmap.md, tech-stack.md, lessons.md, ...)
    lessons.md       # reguły/wzorce re-czytane przez frame/research/plan/implement/review
  changes/
    <change-id>/     # Poziom B — jedna zmiana w toku
      change.md      # tożsamość zmiany (status, daty)
      research.md    # wynik /10x-research
      plan.md        # wynik /10x-plan (+ sekcja ## Progress = stan wykonania)
      plan-brief.md
  archive/
    <change-id>/     # zmiany zamknięte przez /10x-archive
```

Zasady (z AGENTS.md): nie nadpisuj ręcznie `context/` poza tym, co tworzą skille;
`context/archive/**` i `context/foundation/archive/**` są niezmienne.

---

## 6. Worked example: `tool-loop-agent`

Realny przebieg z tej sesji (Poziom B, projekt już istniał):

1. `/10x-new tool-loop-agent` → `change.md` (status `new`), Notes z intencją.
2. `/10x-research tool-loop-agent` → `research.md`: punkt wyjścia (`code-reviewer`
   robi jednorazowy `generateText`), cel (`ToolLoopAgent` z AI SDK), 7 otwartych decyzji;
   status zmiany podbity `new` → `preparing`. Źródło docsów: przypięte
   `node_modules/ai/docs/` (wersja `ai@6.0.212`), nie pamięć modelu.
3. **Następny krok**: `/10x-plan tool-loop-agent` → rozstrzygnąć te 7 decyzji i rozpisać
   fazy (szkielet agenta + narzędzia → pętla/`stopWhen` → structured output → e2e-check).
4. Dalej: `/10x-plan-review` → `/10x-implement` (pakiet TS, nie web → raczej nie e2e)
   → `/10x-impl-review` → `/10x-archive`.

---

## Ściąga (jedno spojrzenie)

| Skill | Output | Kiedy |
| --- | --- | --- |
| `/10x-new` | `change.md` | Start każdej zmiany |
| `/10x-frame` | (analiza) | Bug+naprawa / spór o zakres — opcjonalnie |
| `/10x-research` | `research.md` | Gdy trzeba zrozumieć kod/docsy — zwykle tak |
| `/10x-plan` | `plan.md` | Zawsze przed kodem |
| `/10x-plan-review` | (recenzja) | Przed implementacją — zalecane |
| `/10x-implement` | kod | Domyślny tryb wykonania |
| `/10x-tdd` | kod+testy | Fazy test-first |
| `/10x-e2e` | testy Playwright | Fazy przeglądarkowe (gdy feature stoi) |
| `/10x-impl-review` | (recenzja) | Po implementacji |
| `/10x-archive` | przenosi do `archive/` | Po zakończeniu |
