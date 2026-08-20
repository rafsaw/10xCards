# Raport: kandydaci na pierwszą realną zmianę produktową

- **Data:** 2026-08-20
- **Repo:** 10xCards
- **Branch bazowy:** `main` (czysty, `4ced102`)
- **Typ:** analiza read-only — nic nie zaimplementowano
- **Cel:** wybrać pierwszą realną zmianę produktową po zakończeniu konfiguracji OM Skills, tak by po raz pierwszy przejść pipeline na prawdziwym zadaniu (w tym `needs-qa` + `om-auto-qa-pr`)

---

## 1. Stan repo (fakty zweryfikowane w kodzie)

| Obszar | Ustalenie | Źródło |
| --- | --- | --- |
| Roadmapa | Wszystkie slice'y **F-01…S-06 mają status `done`** — nie ma gotowego "następnego slice'a do wzięcia" | `context/foundation/roadmap.md` |
| Powierzchnie UI | `/dashboard`, `/generate`, `/library`, `/review`, `/settings` + nawigacja `Topbar.astro` | `src/pages/`, `src/components/` |
| Pipeline | `qaGate: true`, browser provider `playwright`, labelki `needs-qa` / `qa-approved` / `qa-failed` skonfigurowane | `.ai/agentic.config.json` |
| Validation gate | `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` | `.ai/agentic.config.json` |
| Pokrycie E2E | Cienkie — tylko `seed.spec.ts` i `review-persistence.spec.ts` (+ auth setup/teardown) | `tests/e2e/` |

**Wniosek:** kandydatów trzeba szukać w realnym kodzie, nie w planie. Poniższe trzy pozycje to konkretne dziury znalezione podczas przeglądu powierzchni UI.

---

## 2. Kandydat A — Dashboard bez żadnej treści

### Fakt z kodu

`src/pages/dashboard.astro:7-19` to dziś ~12 linii: nagłówek, `Welcome, {user.email}` i zdanie *"Use the navigation above to generate, review, or browse your cards."* Zero danych.

Jednocześnie jest to **landing po zalogowaniu** — `src/pages/index.astro:5` robi twardy redirect zalogowanego usera na `/dashboard`.

Przyczyna: slice S-06 wyniósł akcje z boxa na dashboardzie do `Topbar.astro`, ale nie zastąpił ich niczym. Dashboard został pustą skorupą.

### Ocena

| Kryterium | Ocena |
| --- | --- |
| Wartość dla użytkownika | Pierwszy ekran po logowaniu odpowiada na pytanie "co mam teraz zrobić": ile kart czeka na powtórkę, ile mam kart, czy wiszą niezaakceptowane drafty |
| Przybliżony scope | 1 plik strony + ewentualnie mały komponent; 3 zapytania `count` do Supabase (wzorzec już istnieje w `src/pages/library.astro:40`); CTA-linki do `/review` i `/generate` |
| Dotyka UI? | Tak — czysto UI + dane read-only |
| Wymaga `needs-qa`? | Tak, modelowo — cała wartość jest wizualna, screenshot jest dowodem |
| OM capabilities | `om-prepare-issue` → `om-auto-fix-issue` (feature route), wewnątrz: `om-auto-review-pr` + `om-auto-qa-pr` → handoff do `om-approve-merge-pr` |
| Ryzyko / złożoność | **Niskie.** Same odczyty, żadnych mutacji, brak kontaktu z RLS i atomic-save. Jedyna pułapka: stan `isReadOnly` (konto w retencji) musi się poprawnie renderować |

---

## 3. Kandydat B — "All caught up!" jest ślepym zaułkiem

### Fakt z kodu

`src/components/review/ReviewSession.tsx:87-95` — gdy `dueCards.length === 0`, user dostaje *"You have no cards due for review right now. Come back later."* i przycisk powrotu. Nie wie **kiedy** wrócić ani ile kart ma w rotacji.

### Ocena

| Kryterium | Ocena |
| --- | --- |
| Wartość dla użytkownika | Zamiast "wróć kiedyś" — "następna karta: jutro 14:20, masz 37 kart w rotacji". Zmniejsza szansę porzucenia nawyku powtórek |
| Przybliżony scope | `review.astro` dokłada zapytanie o `min(next_due_at)`; `ReviewSession.tsx` renderuje datę. Mały |
| Dotyka UI? | Tak |
| Wymaga `needs-qa`? | Tak, ale QA jest trudniejsze — trzeba zainscenizować stan "zero due cards" u efemerycznego QA usera |
| OM capabilities | Jak w kandydacie A |
| Ryzyko / złożoność | **Średnio-niskie.** Główne ryzyko to scope creep: z tym ekranem wiąże się odłożone pytanie o tryb "practice/cram" (czy oceny w trybie ćwiczeniowym mają przesuwać harmonogram). To osobna, większa decyzja produktowa — trzeba jej tutaj świadomie **nie** wciągać |

---

## 4. Kandydat C — Drafty gniją bez limitu i bez higieny

### Fakt z kodu

`src/pages/generate.astro:20-32` ładuje **wszystkie** drafty użytkownika — bez `limit` i bez informacji o wieku — i przekazuje je hurtem do `DraftReviewList`.

Roadmapa sama nazywa to nierozstrzygniętym Unknown: S-01, *"polityka czyszczenia wiszących draftów"* — nigdy nie rozstrzygnięta.

### Ocena

| Kryterium | Ocena |
| --- | --- |
| Wartość dla użytkownika | User, który wygenerował i porzucił kilka partii, wraca na `/generate` i widzi ścianę starych kandydatów pomieszanych z nowymi |
| Przybliżony scope | Grupowanie/oznaczenie wieku draftów albo "odrzuć wszystkie stare" + limit zapytania |
| Dotyka UI? | Tak |
| Wymaga `needs-qa`? | Tak |
| OM capabilities | Jak wyżej, ale prawdopodobnie z `om-brainstorm` na starcie — najpierw trzeba rozstrzygnąć politykę (TTL? tylko UI-grouping? bulk discard?) |
| Ryzyko / złożoność | **Najwyższe z trójki.** Dotyka `status=draft`, czyli tej samej powierzchni co atomic save (S-02, north star). Jeśli w grę wejdzie automatyczne kasowanie draftów — to destrukcyjna operacja na danych użytkownika |

---

## 5. Rekomendacja: **Kandydat A (dashboard)**

Uzasadnienie wyboru jako *pierwszej* zmiany przepuszczonej przez pipeline:

1. **Jest realny, nie demo.** Dashboard to landing po logowaniu i dziś nie niesie żadnej informacji — obiektywna dziura, nie wymyślony pretekst.
2. **Idealny dla `needs-qa`.** Cała wartość zmiany jest wizualna i deterministyczna: QA user się loguje, ląduje na `/dashboard`, screenshot pokazuje liczby. Nie trzeba inscenizować egzotycznego stanu (jak w B) ani niczego kasować (jak w C).
3. **Zero ryzyka dla danych.** Same odczyty. Potknięcie pipeline'u nie zniszczy niczego — a celem jest obserwowanie pipeline'u, nie ratowanie bazy.
4. **Zmusza do pełnego przebiegu.** UI + dane + edge case read-only (retencja) to dość, by review miało co powiedzieć, a QA co sfotografować — i za mało, by PR rozlał się na kilkanaście plików.

### Dlaczego nie B i nie C teraz

- **C** odłożone świadomie: dobry *drugi* kandydat, ale zaczyna się od decyzji produktowej, nie od implementacji — i dotyka north-star surface.
- **B** jest dobre, ale QA byłoby uciążliwsze niż sama zmiana.

---

## 6. Proponowany następny krok

Start od **`om-prepare-issue`**, nie od razu od `om-auto-fix-issue`.

**Powód:** `om-prepare-issue` tworzy jedno dobrze sformułowane issue z SDLC-labelkami, dedupem i opisanym zakresem — i to jest moment, w którym **człowiek** decyduje, co dokładnie ma być na dashboardzie, zanim automat zacznie kodować.

Dopiero potem `om-auto-fix-issue` bierze numer issue i sam wywołuje niższe skille:

```
om-prepare-issue
  └─ om-auto-fix-issue (feature route)
       ├─ om-auto-write-spec / om-auto-implement-spec
       ├─ om-auto-review-pr
       ├─ om-auto-qa-pr        (bo needs-qa + qaGate: true)
       └─ handoff → om-approve-merge-pr
```

Niższych skilli nie odpalamy osobno — orchestrator woła je sam.

### Otwarte pytanie do rozstrzygnięcia przed `om-prepare-issue`

Czy dashboard ma pokazywać dokładnie te trzy metryki:

- kart due dzisiaj (`status=saved` + `next_due_at <= now`)
- wszystkich zapisanych kart (`status=saved`)
- niezaakceptowanych draftów (`status=draft`)

— czy inny zestaw.

---

## 7. Zasada pracy przyjęta w tej sesji

> Najpierw wybieramy realny problem lub realną zmianę w 10xCards, a dopiero potem dobieramy właściwy OM skill.

Nie odpalamy skilli po to, żeby je zobaczyć. Nie dublujemy niższych skilli, jeśli wyższy orchestrator już je wywołuje.
